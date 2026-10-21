# Akdital Atlas: handoff (21 Oct 2026)

Read this first when you pick the project up again, whoever you are. No secrets are written here: the site password,
the Vercel token and the GitHub token are with Mounsef (and in Vercel's environment variables).

## Where things are

| | Link / ref | State |
|---|---|---|
| **Production** | https://akdital-atlas.vercel.app | `main` @ `02905fe`. Sign-in gate, datasets v1.3 and v2.3, tours, finances. Stable. |
| **Work in progress** | branch `wip/humans-casablanca-bridge` | Preview link: see the last section. Not merged. |
| Repo | github.com/mounseflit/akdital-atlas (private) | Vercel project `akdital-atlas`, team `mounseflits-projects` |

## Decisions taken (keep them)

**Product and content**
- Akdital is the client and the main brand: the zoomed-out logo is the Akdital lockup, centred, with « mibtech × JABB » smaller underneath. The top-left brand is the same (AKDITAL, then mibtech × JABB).
- No invented numbers anywhere, 3D screens included. Every figure comes from the data files.
- Say « Expériences IA », never « avatar » or « hôte ». JABB is pronounced « jab ».
- Morocco is drawn with the Sahara and no internal border.
- The guided tours use ONE voice, saved audio (never generated live), storytelling first; the voice gives the key metric and what happened, never the source.

**Two datasets behind a sign-in** (21 Oct)
- A shared password is checked on the server (`proxy.ts`, `lib/auth.ts`, signed HttpOnly cookie; env `ATLAS_PASSWORD`, `ATLAS_SESSION_SECRET`). Then `/choisir`: « Données d'origine » (v1.3: 302 / 160 / 142 MDH, 2026 → 2029) or « Chiffres actualisés » (v2.3: the client's case-by-case business case, 2027 → 2031). Cookie `atlas_ds`.
- v2.3 data is built by `../_source/v23/build_v23.py` from the client's workbooks 03 and 04 (on the Desktop). The build asserts that the cases add up to the Synthèse, flow by flow and year by year. The PDF audit (`_source/v23/coverage.json`) is merged; nothing from the five documents may go missing on screen.
- The 2031 headline (v2.3): ① 272,7 + ② 158,5 = 431,2 gains bruts − ③ 154,9 = 276,3 MDH net a year; 695,5 cumulated 2027-2031; VAN 466,3.
- Never hard-code 302, 2029 or « plein régime » in the UI: use `HEAD`, `LBL`, `FINAL_YEAR` and `YEARS` from `lib/model.ts`.
- v2.3 adds a Finances section (`components/sections/finance/`), the « Chiffres actualisés v2.3 » block in each case dossier, and its own tours « Le même mardi » (`lib/ai/tour-v23-*.json`, audio in `public/audio/tour-v23/`, cast in `components/scenes/story/`).

**City and look**
- The hospital square stays white and highlighted. As the camera rises, the city blends into the Morocco map's blue.
- Street level should look like the real Casablanca: white and cream façades, Art Deco downtown, medina grain, roof terraces, the port, El Hank, the Corniche, the Arab League park, the Anfa racetrack, the Twin Center. Reference: satellite view plus the founder's map link https://maps.app.goo.gl/TLNbuiWaMj3ucTpm9.
- The city must not end in a circle: buildings get smaller and sparser toward the outskirts, following the coast and the roads.
- CC0 photo textures were approved by Mounsef (Poly Haven / ambientCG only). They are in `public/textures/city/` with their credits.

**Characters**
- Every person (hospital staff and patients, visitors, porters, city pedestrians, the six tour characters, the walk-mode visitor) must look like the reference Mounsef shared: properly proportioned stylised humans with hair, a neck, shaped torsos, sleeves with hands, trousers and shoes, and a natural gait. No capsule figures.
- The walk-mode character is modelled on Mounsef's photo: navy suit, white shirt, grey and gold tie, gold pocket square, blue glasses, beard, curly hair, watch.
- Seated people sit exactly on chairs; bed patients lie in beds.
- In the Express tour's « chambre libérée » scene, a cleaning agent must push the bionettoyage cart (never a cart moving alone).

## What is on the WIP branch

- **Done:** a walkable skybridge at floor 1 between the main building and the head office, with sliding glass doors at both ends, colliders, camera limits and cut-away. The round-trip walk test passed (`walk/plan.ts`, `walk/colliders.ts`, `hospital/Site.tsx`, `Facade.tsx`, `Openings.tsx`).
- **Partial:** a shared human kit, `components/scenes/people/human.ts` + `useHumans.ts`, already used by `People.tsx`, `props/Crowd.tsx`, `Ambient.tsx`, `city/Pedestrians.tsx`, `story/StoryStage.tsx` / `cast.ts` / `StoryProps.tsx` (with the cart pusher) and `walk/Visitor.tsx`. It has NOT been visually checked against the reference yet.
- **Partial:** the Casablanca rework: `city/geography.ts`, `cityTex.ts`, `cityMats.ts`, `Sites.tsx`, the organic edge and the CC0 textures. **It is too heavy:** about 7.7 M triangles per frame were measured before its LOD pass.

## Next steps, in order

1. **City performance:** distance LOD for trees, palms and roof props; limit shadow casters; check the frame time on a GPU laptop.
2. **Characters:** take screenshots and compare them with the reference (department close-up, waiting room, corridor porter, sidewalk, the six cast members, the walk character, the cart before and after). Fix seating and placement.
3. **Bridge:** re-run the walk test, and look at first-person view on the bridge (partitions rise to ceiling height on floor 1).
4. **City:** check the organic edge at 6 km and the hand-off into the map at 15–30 km.
5. **Merge and deploy:** merge into `main` and deploy to production only when Mounsef says so.

## How to work on it

- **Dev:** `npm run dev -- -p 3333`. In development the gate is open unless `ATLAS_GATE=on`. Test v2.3 in dev with `document.cookie="atlas_ds=v23; path=/"` and reload.
- **Typecheck:** `npx tsc --noEmit -p .`
- **Screenshots** (headless Edge, slow, about 1 fps):
  - `node scripts/shots.cjs <url> <prefix> '<json steps [{js,wait,name}]>' WxH <initWaitMs>`
  - Dev globals: `__atlas` (store), `__rig`, `__frame`, `__walk`, `__city`, `__sky`.
- **Rebuild the v2.3 data:** `python ../_source/v23/build_v23.py`
- **Rebuild the tours:**
  - v1.3: `TTS_MODEL=gemini-2.5-flash-preview-tts node scripts/build-tour.mjs && node scripts/gen-narration.mjs --uniform`
  - v2.3: `node scripts/build-tour-v23.mjs && node scripts/gen-narration.mjs --set v23` (`--check` verifies the audio).
- **Deploy:** from a clean worktree of the commit (never the live folder), copy `.vercel` + `.vercelignore` into it, then:
  - `vercel deploy --prod --yes --token=<token> --scope mounseflits-projects` for production;
  - the same without `--prod` for a preview link.
- **Gotchas:**
  - `vercel link` overwrites `.env.local`.
  - The dev server can serve a stale `globals.css`; trust the production build.
  - Turbopack won't build from a copy whose `node_modules` is a junction.

## Preview link of this branch

- https://akdital-atlas-wip.vercel.app (alias of the branch preview; same password as production)
