// Jabby's brain. Streams NDJSON lines to the client:
//   {"type":"tool","name":"open_case","args":{"id":"A-02"}}   → the client drives the blue cursor, then the store
//   {"type":"text","delta":"…"}                               → answer tokens
//   {"type":"done","ms":1234} | {"type":"error","message":"…"}
// Round 1 lets the model call tools (they are sent to the client at once, so the cursor moves while round 2 writes).
// Round 2 answers with the tool results (detail of the case / department / section opened) in context.
import { knowledgePack, caseDetail, deptDetail, floorDetail, personDetail, xpDetail, sectionDetail, yearDetail, levelDetail } from "@/lib/ai/knowledge";
import { TOOL_DEFS } from "@/lib/ai/tools";
import { chatUrl, env } from "@/lib/ai/server";

export const maxDuration = 60;

type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: unknown[]; tool_call_id?: string };
type UiState = { level?: string; section?: string; sel?: { kind: string; id: string } | null; caseId?: string | null; year?: number; perSite?: boolean };

const PERSONA = `Tu es Jabby, l'assistant IA de JABB, dans « Akdital augmenté », le jumeau numérique interactif présenté par Mibtech × JABB au groupe Akdital (1er groupe hospitalier privé du Maroc). Le programme : des agents IA qui reprennent les tâches administratives répétitives, pour 302 MDH d'économie de masse salariale par an, 160 MDH de coût des agents, 142 MDH nets, sans aucun licenciement.

Règles de réponse :
- Verdict d'abord (une phrase, sans écrire le mot « Verdict »), puis 1 à 3 faits courts qui l'appuient. 70 mots maximum sauf si on te demande le détail.
- Chiffres exacts uniquement, tirés des données ci-dessous ou des résultats d'outils. N'invente jamais un chiffre, un nom, un site ou une date. Si tu ne sais pas, dis-le et propose ce que tu sais.
- À la première apparition d'une unité, explique-la entre parenthèses : « 19,6 MDH (millions de dirhams) », « 174 ETP (équivalents temps plein) », « ROI (retour sur investissement) de 1,91 ». Format français : virgule décimale, espace pour les milliers.
- Réponds dans la langue de l'utilisateur (français par défaut). Ton calme, assuré, chaleureux, jamais commercial. Pas de titres markdown. Gras **…** sur 2 éléments au plus (le chiffre clé du verdict).
- « Qu'est-ce qui a déjà marché ailleurs ? » : appelle open_case pour le cas concerné, puis cite UNIQUEMENT les résultats marqués MESURÉS : organisation, résultat chiffré, année, source (et « selon l'éditeur » pour le niveau C). Une référence non mesurée n'est jamais présentée comme un résultat ; si rien n'est mesuré, dis-le simplement. Les valeurs hors masse salariale sont indicatives et ne s'additionnent jamais aux 302 MDH.
- Vocabulaire : dis « Expériences IA » ou « guide » pour les écrans d'accueil, jamais « avatar » ni « hôte ».
- Le soin reste humain : les agents préparent, l'humain vérifie et signe l'irréversible. Zéro licenciement : non-remplacement des départs naturels, mobilité vers les ouvertures, recrutements évités.

Interface (outils) :
- Tu pilotes l'écran pendant que tu parles : dès que la question porte sur un cas, un service, un métier, un étage, une section, une année ou un niveau précis (même sans le mot « montre »), appelle D'ABORD l'outil qui l'affiche (1 ou 2 appels maximum), sans écrire de texte avant l'appel, puis réponds à partir du résultat. Ex. « que fait l'agent vocal ? » → open_case A-06 ; « et les infirmières ? » → select dept hospitalisation ; « combien en 2027 ? » → set_year 2027 ; « l'Agentic Command Center » → open_case T-02 (service siege-pilotage, annexe du siège) ; « la paie » → open_case S-06.
- Cas → open_case. Service → select kind=dept. Étage → select kind=floor (id main:0…). Section plein écran → open_section. Année → set_year. Niveau monde / Maroc / hôpital → navigate.
- Questions générales (chiffres globaux, définitions) : réponds directement, sans outil, sauf si un affichage aide vraiment.`;

const VOICE_RULES = `\nMode vocal : la réponse sera lue à voix haute. 45 mots maximum, phrases courtes, aucun gras, aucune liste, aucune parenthèse d'explication d'unité : écris « millions de dirhams » et « équivalents temps plein » en toutes lettres.`;

function stateLine(s: UiState | undefined) {
  if (!s) return "";
  const sel = s.sel ? `${s.sel.kind}:${s.sel.id}` : "aucune";
  return `\nÉtat actuel de l'écran : niveau ${s.level ?? "?"}, section ${s.section ?? "?"}, sélection ${sel}${s.caseId ? `, cas ouvert ${s.caseId}` : ""}, année ${s.year ?? "?"}, vue ${s.perSite ? "un établissement type" : "groupe"}.`;
}

function toolResult(name: string, args: Record<string, unknown>): string {
  try {
    switch (name) {
      case "open_case": return caseDetail(String(args.id ?? ""));
      case "select": {
        const k = String(args.kind), id = String(args.id ?? "");
        if (k === "dept") return deptDetail(id);
        if (k === "floor") return floorDetail(id);
        if (k === "person") return personDetail(id);
        if (k === "xp") return xpDetail(id);
        return `Sélection ${k} ${id} affichée.`;
      }
      case "open_section": return sectionDetail(String(args.section));
      case "set_year": return yearDetail(Number(args.year));
      case "navigate": return levelDetail(String(args.level));
      case "set_view": return args.perSite ? "Vue : un établissement type (groupe ÷ 45)." : "Vue : tout le groupe.";
    }
  } catch {}
  return "Fait.";
}

type Round = { text: string; calls: { id: string; name: string; args: string }[]; finish: string | null };

/** One streamed completion. Text deltas and finished tool calls are pushed to `emit` as they arrive. */
async function round(messages: Msg[], allowTools: boolean, emit: (o: object) => void, signal: AbortSignal): Promise<Round> {
  const body: Record<string, unknown> = {
    messages,
    stream: true,
    max_completion_tokens: 700,
    reasoning_effort: process.env.CHAT_REASONING || "minimal",
    tools: TOOL_DEFS,
    tool_choice: allowTools ? "auto" : "none",
  };
  const r = await fetch(chatUrl(), { method: "POST", headers: { "content-type": "application/json", "api-key": "atlas" }, body: JSON.stringify(body), signal });
  if (!r.ok || !r.body) throw new Error(`LLM ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
  const out: Round = { text: "", calls: [], finish: null };
  const rd = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let sent = 0; // tool calls already emitted
  const flushCalls = (upto: number) => {
    for (; sent < upto; sent++) {
      const c = out.calls[sent];
      let args: unknown = {};
      try { args = JSON.parse(c.args || "{}"); } catch { continue; }
      emit({ type: "tool", name: c.name, args });
    }
  };
  for (;;) {
    const { value, done } = await rd.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      let j: { choices?: { delta?: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[] };
      try { j = JSON.parse(d); } catch { continue; }
      const ch = j.choices?.[0];
      if (!ch) continue;
      const dl = ch.delta;
      if (dl?.content) { out.text += dl.content; emit({ type: "text", delta: dl.content }); }
      if (dl?.tool_calls) {
        for (const t of dl.tool_calls) {
          if (!out.calls[t.index]) { flushCalls(t.index); out.calls[t.index] = { id: t.id || `call_${t.index}`, name: "", args: "" }; }
          const c = out.calls[t.index];
          if (t.id) c.id = t.id;
          if (t.function?.name) c.name += t.function.name;
          if (t.function?.arguments) c.args += t.function.arguments;
        }
      }
      if (ch.finish_reason) out.finish = ch.finish_reason;
    }
  }
  flushCalls(out.calls.length);
  return out;
}

export async function POST(req: Request) {
  const t0 = Date.now();
  let payload: { messages?: { role: string; content: string }[]; state?: UiState; voice?: boolean };
  try { payload = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const history = (payload.messages || [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-10)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }));
  if (!history.length || history[history.length - 1].role !== "user") return Response.json({ error: "no question" }, { status: 400 });
  if (!env.azureBase()) return Response.json({ error: "AZURE_PROXY_BASE missing" }, { status: 500 });

  const messages: Msg[] = [
    { role: "system", content: PERSONA + "\n\n# Données\n" + knowledgePack() },
    { role: "system", content: stateLine(payload.state) + (payload.voice ? VOICE_RULES : "") },
    ...history,
  ];

  const enc = new TextEncoder();
  const ac = new AbortController();
  req.signal.addEventListener("abort", () => ac.abort());
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (o: object) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch {} };
      try {
        const r1 = await round(messages, true, emit, ac.signal);
        const calls = r1.calls.filter((c) => c.name);
        if (calls.length) {
          emit({ type: "tools_done", ms: Date.now() - t0 });
          messages.push({ role: "assistant", content: r1.text || null, tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } })) });
          for (const c of calls) {
            let a: Record<string, unknown> = {};
            try { a = JSON.parse(c.args || "{}"); } catch {}
            messages.push({ role: "tool", tool_call_id: c.id, content: toolResult(c.name, a) });
          }
          if (r1.text) emit({ type: "text", delta: "\n\n" });
          await round(messages, false, emit, ac.signal);
        }
        emit({ type: "done", ms: Date.now() - t0 });
      } catch (e) {
        if (!ac.signal.aborted) emit({ type: "error", message: String((e as Error).message || e).slice(0, 200) });
      } finally {
        try { controller.close(); } catch {}
      }
    },
    cancel() { ac.abort(); },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" } });
}

/** Debug: size of the knowledge pack (no secrets). */
export async function GET() {
  const p = knowledgePack();
  return Response.json({ chars: p.length, approxTokens: Math.round(p.length / 3.6) });
}
