// Materials of the procedural Casablanca: real colours and textures at street level (plaster façades, roof terraces with
// their clutter, worn asphalt, pavement tiles, beaches, the Atlantic, fields and scrub), and the hand-off to the Morocco
// map: every city material eases towards the map's blues as the camera rises (uniform `uMapK`, applied after tone mapping
// in output colours, so the city lands exactly on the map's palette), and the far ground does the same with distance.
// All patterns are computed in world or façade metres; textures come from cityTex.ts (CC0 photos, procedural fallback).
import * as THREE from "three";
import { CTEX, CTILE } from "./cityTex";
import { COAST, HANK, CORNICHE, PORT, LEAGUE } from "./geography";

/** Shared uniforms (one object for every city material): map blend, night tint, daylight, time, map hole. */
export const CU = {
  uMapK: { value: 0 },
  uNightMul: { value: new THREE.Vector3(1, 1, 1) },
  uNight: { value: 0 },
  uDay: { value: 1 },
  uTime: { value: 0 },
  uHole: { value: 1 },
};
// the map's palette in output (sRGB) values: ocean shelf, land, highlight
const MAP = { lo: "vec3(0.082, 0.118, 0.27)", mid: "vec3(0.196, 0.247, 0.439)", hi: "vec3(0.33, 0.40, 0.64)" };

export const NOISE_GLSL = /* glsl */ `
float h21(vec2 p) { p = mod(p, 1031.0); p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float h11(float x) { return h21(vec2(x, x * 1.618 + 7.0)); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm3(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 3; k++) { s += a * vn(p); p = p * 2.03 + vec2(17.3, -9.1); a *= 0.5; } return s / 0.875; }
`;
const BLEND_GLSL = /* glsl */ `
uniform float uMapK; uniform vec3 uNightMul; uniform float uNight; uniform float uDay; uniform float uTime; uniform float uHole;
vec3 mapRamp(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 b = l < 0.45 ? mix(${MAP.lo}, ${MAP.mid}, smoothstep(0.1, 0.45, l)) : mix(${MAP.mid}, ${MAP.hi}, smoothstep(0.45, 0.95, l));
  return b * mix(1.0, 0.8, uNight);
}
`;

type Hook = { vert?: (s: string) => string; frag?: (s: string) => string; uniforms?: Record<string, THREE.IUniform>; key: string };
/** Patch a built-in material: shared blend + night tint, plus the material's own vertex / fragment hooks. The fragment may
 *  set `mapK` (initialised to uMapK) before the blend. */
export function cityPatch<M extends THREE.Material>(m: M, h: Hook): M {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, CU, h.uniforms ?? {});
    let v = sh.vertexShader, f = sh.fragmentShader;
    if (h.vert) v = h.vert(v);
    f = f.replace("#include <common>", BLEND_GLSL + NOISE_GLSL + "\n#include <common>")
      .replace("#include <color_fragment>", "#include <color_fragment>\n  float mapK = uMapK;")
      .replace("#include <colorspace_fragment>", "#include <colorspace_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, mapRamp(gl_FragColor.rgb), clamp(mapK, 0.0, 1.0));");
    if (h.frag) f = h.frag(f);
    // the night tint, after the material's own colour work
    f = f.replace("#include <roughnessmap_fragment>", "diffuseColor.rgb *= uNightMul;\n#include <roughnessmap_fragment>");
    sh.vertexShader = v; sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => "city3-" + h.key;
  return m;
}
/** a plain city material (vertex / instance colours or a flat colour) with the shared blend */
export function plainMat(o: THREE.MeshStandardMaterialParameters, key: string) {
  return cityPatch(new THREE.MeshStandardMaterial(o), { key: "plain-" + key });
}

// ---------------------------------------------------------------- façades (instanced unit boxes)
/** Procedural façades and roofs. Per instance: colour (wall), aStyle = (shop, style, awning, seed). Styles: 0 punched windows,
 *  1 balconies, 2 ribbon windows, 3 Art Deco, 4 medina, 5 villa, 6 shed, 7 curtain wall, 9 beach club. */
export function facadeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.9 });
  return cityPatch(m, {
    key: "facade",
    uniforms: { tPlaster: { value: CTEX.plaster() }, tRoof: { value: CTEX.roof() }, uTilePl: CTILE("plaster"), uTileRoof: CTILE("roof") },
    vert: (s) => s
      .replace("#include <common>", "#include <common>\nattribute vec4 aStyle;\nvarying vec4 vFac;\nvarying float vRoof;\nvarying vec4 vSty;\nvarying float vSide;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 fsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
#else
  vec3 fsc = vec3(1.0);
#endif
  vec3 flp = position + 0.5;
  vec3 fan = abs(normal);
  vRoof = fan.y > 0.5 ? 1.0 : 0.0;
  vFac = vRoof > 0.5 ? vec4(flp.x * fsc.x, flp.z * fsc.z, fsc.x, fsc.z)
                     : vec4(fan.x > 0.5 ? flp.z * fsc.z : flp.x * fsc.x, flp.y * fsc.y, fan.x > 0.5 ? fsc.z : fsc.x, fsc.y);
  vSide = fan.x > 0.5 ? (normal.x > 0.0 ? 1.0 : 2.0) : (normal.z > 0.0 ? 3.0 : 4.0);
  vSty = aStyle;`),
    frag: (s) => s
      .replace("#include <common>", `#include <common>
uniform sampler2D tPlaster; uniform sampler2D tRoof; uniform float uTilePl; uniform float uTileRoof;
varying vec4 vFac; varying float vRoof; varying vec4 vSty; varying float vSide;
vec3 awningCol(float a) {
  return a < 1.5 ? vec3(0.3494, 0.0474, 0.0177) : a < 2.5 ? vec3(0.5789, 0.2793, 0.029) : a < 3.5 ? vec3(0.0177, 0.1483, 0.1056)
       : a < 4.5 ? vec3(0.029, 0.0872, 0.2684) : a < 5.5 ? vec3(0.3746, 0.0203, 0.0203) : vec3(0.7176, 0.6814, 0.5789);
}
vec3 signCol(float h) {
  return h < 0.2 ? vec3(0.531, 0.029, 0.023) : h < 0.38 ? vec3(0.0177, 0.1056, 0.325) : h < 0.55 ? vec3(0.7931, 0.7549, 0.6462)
       : h < 0.7 ? vec3(0.029, 0.2176, 0.0815) : h < 0.85 ? vec3(0.6994, 0.3494, 0.023) : vec3(0.023, 0.023, 0.029);
}
#define ST(x) (abs(style - (x)) < 0.5)`)
      .replace("float mapK = uMapK;", `float mapK = uMapK;
  float lit = 0.0;
  {
  float shop = vSty.x, style = vSty.y, acc = vSty.z, seed = vSty.w;
  vec3 wall = diffuseColor.rgb;
  float vd = length(vViewPosition);
  if (vRoof > 0.5) {
    float x = vFac.x, z = vFac.y, W = vFac.z, D = vFac.w;
    float fw = fwidth(x) + fwidth(z);
    float det = 1.0 - smoothstep(0.25, 1.4, fw);
    bool isFlat = !ST(6.0) && !ST(7.0);
    vec3 rbase = ST(6.0) ? vec3(0.4563, 0.4854, 0.5004) : ST(7.0) ? vec3(0.1812, 0.1989, 0.2176) : vec3(0.5156, 0.4707, 0.4009);
    vec3 c = mix(wall, rbase, isFlat ? 0.5 : 0.85);
    float along = W > D ? x : z, Lg = max(W, D);
    float ps = 7.0 + 6.0 * fract(seed * 13.7);
    float pi = Lg > ps * 1.5 ? floor(along / ps) : 0.0;
    float ph = h11(pi * 3.7 + seed * 91.0);
    if (isFlat) {
      c *= 0.82 + 0.26 * ph;
      if (ph > 0.8) c = mix(c, vec3(0.8727, 0.8524, 0.7931), 0.55);            // freshly whitewashed terrace
      else if (ph < 0.12) c = mix(c, vec3(0.325, 0.3017, 0.2684), 0.35);      // older, darker cement
    }
    float tx = texture2D(tRoof, vec2(x, z) / uTileRoof).r / 0.737;
    float tx2 = texture2D(tRoof, vec2(z, x) / (uTileRoof * 5.3) + 0.31).r / 0.737;
    c *= mix(1.0, tx * mix(1.0, tx2, 0.6), isFlat ? 0.85 : 0.4);
    if (ST(6.0)) c *= 1.0 - 0.07 * step(0.5, fract(along / 0.95)) * det;   // ribbed metal sheets
    if (ST(7.0)) { vec2 g = abs(fract(vec2(x, z) / 6.0) - 0.5); c *= 1.0 - 0.12 * step(0.46, max(g.x, g.y)) * det; }
    float e = min(min(x, W - x), min(z, D - z));
    if (isFlat) {
      if (e < 0.3) c = mix(c, wall * 1.05, 0.85);                      // parapet cap
      else if (e < 0.9) c *= mix(0.9, 0.78, det);                      // its shadow
      float pd = abs(fract(along / ps + 0.5) - 0.5) * ps;
      if (pi > 0.0 || Lg > ps * 1.5) if (pd < 0.2) c *= mix(0.9, 0.82, det); // party walls between plots
      // roof clutter seen from afar (the 3D props take over close to the camera)
      float far = smoothstep(220.0, 520.0, vd);
      vec2 cl = floor(vec2(x, z) / 3.4), cf = fract(vec2(x, z) / 3.4) - 0.5;
      float hh = h21(cl + seed * 37.0);
      if (e > 1.2 && far > 0.0) {
        float rr = length(cf);
        if (hh < 0.05) c = mix(c, vec3(0.0112, 0.0132, 0.0154), smoothstep(0.26, 0.17, rr) * far);
        else if (hh < 0.21) c = mix(c, vec3(0.9141, 0.9141, 0.8727), smoothstep(0.2, 0.12, rr) * far);
        else if (hh > 0.955) c = mix(c, wall * 0.78, step(max(abs(cf.x), abs(cf.y)), 0.42) * far);
      }
    }
    diffuseColor.rgb = c;
  } else {
    float u = vFac.x, v = vFac.y, L = vFac.z, H = vFac.w;
    float fw = max(fwidth(u), fwidth(v));
    float det = 1.0 - smoothstep(0.3, 1.3, fw);
    float side = vSide;
    // plots along long façades: each its own tone, sometimes a painted one
    float pw = 9.0 + 5.0 * fract(seed * 7.1);
    bool plots = (ST(0.0) || ST(1.0) || ST(3.0) || ST(4.0)) && L > pw * 1.6;
    float pi = plots ? floor(u / pw) : 0.0;
    float ph = h11(pi * 1.7 + seed * 53.0 + side * 11.0);
    if (plots) {
      wall *= 0.93 + 0.12 * ph;
      if (ph > 0.88) wall = mix(wall, ph > 0.95 ? vec3(0.7176, 0.3494, 0.1989) : vec3(0.7549, 0.531, 0.2373), 0.55);
    }
    float pl = texture2D(tPlaster, vec2(u, v) / uTilePl).r / 0.769;
    float pl2 = texture2D(tPlaster, vec2(u + side * 3.1, v) / (uTilePl * 4.3) + 0.37).r / 0.769;
    wall *= mix(1.0, pl * mix(1.0, pl2, 0.6), ST(7.0) ? 0.15 : ST(6.0) ? 0.4 : 0.9);
    wall *= mix(0.78, 1.0, smoothstep(0.0, 1.7, v));                  // splash and dust at the foot
    float stk = vn(vec2(u * 1.1 + seed * 40.0, v * 0.07));
    wall *= 1.0 - 0.08 * smoothstep(0.55, 0.92, stk) * smoothstep(H - 7.0, H - 0.5, v) * (ST(7.0) ? 0.0 : 1.0); // rain streaks
    vec3 col = wall;
    vec3 glassC = vec3(0.0);
    float fh = ST(3.0) ? 3.4 : ST(7.0) ? 3.6 : ST(4.0) ? 3.0 : ST(5.0) ? 3.3 : 3.1;
    float g0 = shop > 0.5 ? 4.3 : (ST(5.0) || ST(4.0) ? 0.0 : 3.4);
    if (ST(7.0)) {
      // curtain wall: mullions, spandrels, reflections of the sky
      float my = fract(v / 3.6), mx = fract(u / 1.5);
      float rf = vn(vec2(u * 0.05 + seed * 9.0, v * 0.02));
      vec3 gl = wall * mix(0.5, 1.0, smoothstep(0.0, H, v) * 0.6 + rf * 0.4) + vec3(0.0004, 0.0008, 0.0014);
      col = gl;
      if (my < 0.2) col = mix(col, wall * 0.62 + 0.06, det);
      if (mx < 0.05) col = mix(col, vec3(0.5789, 0.6121, 0.6462), det * 0.8);
      float hh = h21(vec2(floor(u / 1.5), floor(v / 3.6)) + seed * 11.0);
      lit = hh < 0.3 && my > 0.2 ? 0.45 + 0.5 * fract(hh * 9.1) : 0.0;
      if (v > H - 1.2) col = vec3(0.6121, 0.629, 0.6462);
    } else if (ST(6.0)) {
      col *= 0.93 + 0.07 * step(0.5, fract(u / 0.32)) * det;
      float db = fract(u / 18.0);
      if (v < 5.2 && db > 0.15 && db < 0.42) col = mix(col, vec3(0.1483, 0.1726, 0.1899) * (0.92 + 0.08 * step(0.5, fract(v * 4.0))), det);
      if (v > H - 2.4 && v < H - 1.5 && fract(u / 4.0) > 0.12) { col = mix(col, vec3(0.0707, 0.1056, 0.1483), det); lit = 0.3; }
    } else if (v > g0 && v < H - 0.95 && L > 3.0) {
      float fy = (v - g0) / fh, fi = floor(fy), fv = fract(fy);
      float cw = ST(3.0) ? 3.4 : ST(5.0) ? 4.2 : ST(2.0) ? 2.8 : 3.1;
      float n = max(1.0, floor((L - 1.2) / cw)); cw = (L - 1.2) / n;
      float cu = (u - 0.6) / cw, ci = floor(cu), fu = fract(cu);
      bool inCol = cu > 0.0 && cu < n;
      float wh = h21(vec2(ci + pi * 17.0, fi) + seed * 17.0 + side * 3.0);
      bool present = !ST(4.0) || wh < 0.34;
      float hw = ST(4.0) ? 0.17 : ST(3.0) ? 0.24 : ST(5.0) ? 0.3 : 0.23;
      float y0 = ST(4.0) ? 0.36 : 0.28, y1 = ST(4.0) ? 0.72 : ST(3.0) ? 0.88 : 0.82;
      bool win, frame;
      if (ST(2.0)) { win = fv > 0.32 && fv < 0.84 && u > 0.6 && u < L - 0.6; frame = false; }
      else {
        win = inCol && present && abs(fu - 0.5) < hw && fv > y0 && fv < y1;
        frame = inCol && present && abs(fu - 0.5) < hw + 0.045 && fv > y0 - 0.05 && fv < y1 + 0.035;
        if (ST(5.0) && win && fract(seed * 3.3) > 0.5) { vec2 a = vec2((fu - 0.5) / hw, (fv - y1 + hw * cw / fh) / (hw * cw / fh)); if (a.y > 0.0 && length(vec2(a.x, a.y)) > 1.0) win = false; } // arched villa windows
      }
      float avg = 0.86;
      if (frame && !win) col = mix(col, vec3(0.8933, 0.8727, 0.8126), 0.7 * det);
      if (win) {
        vec3 g = mix(vec3(0.0290, 0.0394, 0.0561), vec3(0.2474, 0.3371, 0.4143), smoothstep(y0, y1, fv) * 0.7 + 0.3 * wh);
        float sh = fract(wh * 13.37);
        if (!ST(3.0) && !ST(2.0) && sh < 0.36) {
          vec3 sc = sh < 0.1 ? vec3(0.0707, 0.1643, 0.0932) : sh < 0.18 ? vec3(0.1812, 0.0872, 0.0394) : sh < 0.25 ? vec3(0.0707, 0.1483, 0.2793) : vec3(0.7549, 0.7361, 0.6637);
          float cover = 0.3 + fract(sh * 7.9) * 0.7;
          if (fv > y1 - (y1 - y0) * cover) g = sc * (0.88 + 0.12 * step(0.5, fract(fv * 22.0)));
        }
        if (fi < 0.5 && !ST(5.0) && fract(fu * 9.0) < 0.16) g *= 0.6;   // window grilles on the first floor
        glassC = g;
        col = mix(col, g, det);
        lit = wh < 0.36 ? 0.55 + 0.45 * fract(wh * 7.3) : 0.0;
      }
      if (ST(1.0) && inCol && abs(fu - 0.5) < 0.4 && mod(ci + fi, 2.0) < 1.0) {
        if (fv > 0.17 && fv < 0.27) col = mix(col, wall * 1.08, det);
        else if (fv > 0.27 && fv < 0.46 && fract(fu * 18.0) < 0.3) col = mix(col, col * 0.62, det);
        else if (fv > 0.11 && fv < 0.17) col *= mix(1.0, 0.74, det);
      }
      if (ST(3.0)) {
        if (fu < 0.08 || fu > 0.92) col = mix(col, wall * 1.07, det);
        if (fv < 0.07) col = mix(col, wall * 1.1, det);
        else if (fv < 0.11) col *= mix(1.0, 0.85, det);
      }
      if (!win && !frame) col = mix(col * avg, col, det);
    } else if (v <= g0 && L > 3.5) {
      if (shop > 0.5) {
        float bay = fract(u / 4.6), bi = floor(u / 4.6);
        float bh = h11(bi * 2.3 + seed * 29.0 + side);
        if (v > 0.25 && v < g0 - 1.25 && bay > 0.07 && bay < 0.93) {
          vec3 sw = mix(vec3(0.0433, 0.0358, 0.0290), vec3(0.3746, 0.2793, 0.1726), smoothstep(0.25, g0 - 1.25, v) * 0.6);
          if (bh < 0.22) { sw = vec3(0.3494, 0.3619, 0.3494) * (0.85 + 0.15 * step(0.5, fract(v * 6.0))); } else lit = 0.7;
          col = mix(col, sw, det);
        }
        if (v > g0 - 1.25 && v < g0 - 0.85 && bay > 0.03 && bay < 0.97) col = mix(col, signCol(fract(bh * 5.7)), det * 0.95);
        if (acc > 0.5 && v > g0 - 0.85 && v < g0 - 0.3 && bay > 0.04 && bay < 0.96) {
          vec3 aw = awningCol(acc);
          col = mix(col, mix(aw, aw * 1.22, step(0.5, fract(u / 0.9))) * mix(0.82, 1.0, (v - g0 + 0.85) / 0.55), max(det, 0.5));
        }
      } else {
        float door = h11(seed * 41.0 + side) * max(1.0, L - 4.0) + 2.0;
        if (abs(u - door) < 0.85 && v < 2.5) {
          bool arch = ST(4.0) && v > 1.65 && length(vec2(u - door, v - 1.65)) > 0.85;
          if (!arch) col = mix(col, ST(4.0) ? vec3(0.0358, 0.0932, 0.1812) : vec3(0.0707, 0.0358, 0.0177), det);
        } else if (!ST(4.0)) {
          float cu = u / 3.1, fu = fract(cu);
          if (fu > 0.3 && fu < 0.7 && v > 1.1 && v < 2.5 && u > 1.0 && u < L - 1.0) col = mix(col, vec3(0.0177, 0.023, 0.029), det);
        }
        if (ST(4.0) && v < 0.9 && fract(seed * 9.7) > 0.6) col *= vec3(0.6121, 0.7549, 1);   // painted plinth
      }
    }
    // cornice / roof line, villa eaves of green tiles
    if (!ST(6.0) && !ST(7.0)) {
      if (v > H - 0.55) col = mix(col, wall * 1.07, 0.9);
      else if (v > H - 0.8) col *= mix(0.9, 0.8, det);
    }
    if (ST(5.0) && fract(seed * 5.3) > 0.45 && v > H - 1.1 && v < H - 0.3) col = vec3(0.029, 0.1643, 0.0993) * (0.86 + 0.14 * step(0.5, fract(u / 0.24)));
    diffuseColor.rgb = col;
  }
  }`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
  totalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * lit * uNight * 0.95;
  totalEmissiveRadiance += diffuseColor.rgb * vec3(0.05, 0.038, 0.024) * uDay * (1.0 - vRoof);`),
  });
}

// ---------------------------------------------------------------- streets (asphalt, pavements, country roads, plazas)
/** aRoad = (kind 0 pavement / 1 street / 2 boulevard / 3 country road / 4 plaza, lateral offset m, asphalt half width m, total half width m) */
export function streetMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.94, polygonOffset: true, polygonOffsetFactor: -1 });
  return cityPatch(m, {
    key: "street",
    uniforms: { tAsph: { value: CTEX.asphalt() }, tPave: { value: CTEX.pavement() }, uTileAs: CTILE("asphalt"), uTilePv: CTILE("pavement") },
    vert: (s) => s.replace("#include <common>", "#include <common>\nattribute vec4 aRoad;\nvarying vec4 vRoad;\nvarying vec2 vWp;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vRoad = aRoad; vWp = (modelMatrix * vec4(position, 1.0)).xz;"),
    frag: (s) => s.replace("#include <common>", "#include <common>\nuniform sampler2D tAsph; uniform sampler2D tPave; uniform float uTileAs; uniform float uTilePv;\nvarying vec4 vRoad; varying vec2 vWp;")
      .replace("float mapK = uMapK;", `float mapK = uMapK;
  {
    float kind = vRoad.x, lat = abs(vRoad.y), ah = vRoad.z, th = vRoad.w;
    vec2 p = vWp;
    vec3 c;
    if (kind < 0.5 || kind > 3.5) {
      float t = texture2D(tPave, p / uTilePv).r / 0.776;
      float t2 = texture2D(tPave, p.yx / (uTilePv * 7.3) + 0.4).r / 0.776;
      c = (kind > 3.5 ? vec3(0.6637, 0.6121, 0.5156) : vec3(0.4854, 0.442, 0.3746)) * mix(1.0, t * mix(1.0, t2, 0.5), 0.85);
      float e = lat - ah;
      if (kind < 0.5 && e < 0.32) {
        // kerb stones; painted red / white on the boulevards here and there
        c = vec3(0.5156, 0.5004, 0.4563) * mix(1.0, t, 0.4);
        if (ah > 10.0 && h21(floor(p / 24.0)) < 0.3 && length(vViewPosition) < 450.0) c = fract((p.x + p.y) / 2.2) < 0.5 ? vec3(0.4009, 0.029, 0.0203) : vec3(0.7931, 0.7739, 0.7176);
      }
      if (kind < 0.5) c *= mix(1.0, 0.88, smoothstep(th - 0.8, th, lat));   // dust along the building line
      if (kind < 0.5) c = mix(c, vec3(0.1899, 0.1812, 0.1643), smoothstep(1200.0, 4500.0, length(vViewPosition)) * 0.75); // from afar the street reads as one darker line
      if (kind > 3.5) {
        // esplanades and the promenade: large stone slabs on a grid aligned with the coast, darker bands
        vec2 cq = vec2(dot(p, vec2(0.70710678, -0.70710678)), dot(p, vec2(-0.70710678, -0.70710678)));
        vec2 bq = abs(fract(cq / 12.0) - 0.5);
        c *= 1.0 - 0.16 * step(0.46, max(bq.x, bq.y)) * (1.0 - smoothstep(400.0, 1500.0, length(vViewPosition)));
        c *= 0.96 + 0.06 * h21(floor(cq / 3.0));
      }
    } else {
      float t = texture2D(tAsph, p / uTileAs).r / 0.486;
      float t2 = texture2D(tAsph, p.yx / (uTileAs * 5.3) + 0.27).r / 0.486;
      c = kind > 2.5 ? vec3(0.119, 0.1056, 0.0872) : kind > 1.5 ? vec3(0.0495, 0.0495, 0.0538) : vec3(0.0657, 0.0657, 0.0682);
      c *= mix(1.0, t * mix(1.0, t2, 0.5), 0.85);
      float pf = fbm3(p / 9.0);
      c *= 1.0 - 0.1 * smoothstep(0.62, 0.66, pf);                        // patched repairs
      c *= 1.0 - 0.05 * smoothstep(0.4, 1.0, cos(lat * 3.49)) * step(lat, ah - 0.7); // tyre tracks
      if (kind < 2.5) c = mix(c, vec3(0.2684, 0.2578, 0.2273), smoothstep(ah - 0.55, ah - 0.35, lat));   // gutter
      else c = mix(c, vec3(0.3494, 0.2684, 0.1726), smoothstep(ah - 1.6, ah, lat) * 0.8);               // dusty shoulders
    }
    diffuseColor.rgb = c;
  }`),
  });
}

// ---------------------------------------------------------------- lawns (parks, gardens, racetrack infield)
export function lawnMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.96, polygonOffset: true, polygonOffsetFactor: -1 });
  return cityPatch(m, {
    key: "lawn",
    uniforms: { tGrass: { value: CTEX.grass() }, uTileGr: CTILE("grass"), tSoil: { value: CTEX.soil() }, uTileSo: CTILE("soil") },
    vert: (s) => s.replace("#include <common>", "#include <common>\nvarying vec2 vWp;").replace("#include <begin_vertex>", "#include <begin_vertex>\n  vWp = (modelMatrix * vec4(position, 1.0)).xz;"),
    frag: (s) => s.replace("#include <common>", "#include <common>\nuniform sampler2D tGrass; uniform float uTileGr; uniform sampler2D tSoil; uniform float uTileSo;\nvarying vec2 vWp;")
      .replace("float mapK = uMapK;", `float mapK = uMapK;
  {
    vec2 p = vWp;
    vec3 g = texture2D(tGrass, p / uTileGr).rgb;
    vec3 g2 = texture2D(tGrass, p.yx / (uTileGr * 6.7) + 0.3).rgb;
    float l = dot(g, vec3(0.333)) / 0.3;
    vec3 c = mix(vec3(0.0707, 0.1483, 0.029), vec3(0.1483, 0.1899, 0.0516), vn(p / 23.0)) * mix(1.0, l * dot(g2, vec3(0.333)) / 0.3, 0.6);
    c = mix(c, vec3(0.2793, 0.2176, 0.1056) * texture2D(tSoil, p / uTileSo).r / 0.627, smoothstep(0.62, 0.76, fbm3(p / 17.0)) * 0.3); // worn patches
    // the Arab League park: sand alleys on a grid, a wide central promenade
    vec2 lq = p - vec2(${LEAGUE.x.toFixed(1)}, ${LEAGUE.z.toFixed(1)});
    if (abs(lq.x) < ${(LEAGUE.w / 2).toFixed(1)} && abs(lq.y) < ${(LEAGUE.d / 2).toFixed(1)}) {
      float ax = abs(mod(lq.x + 1000.0, 50.0) - 25.0), az = abs(mod(lq.y + 1000.0, 60.0) - 30.0);
      if (ax < 2.2 || az < 2.2 || abs(lq.x) < 7.0) c = vec3(0.5156, 0.4009, 0.2373) * texture2D(tSoil, p / uTileSo).r / 0.627;
    }
    diffuseColor.rgb = c * diffuseColor.rgb;
  }`),
  });
}

// ---------------------------------------------------------------- ground (land, beaches, the Atlantic, fields, scrub)
const f1 = (n: number) => n.toFixed(1);
/** The ground: an urban / green / hard land-use map (tLand, ±12.8 km) over procedural fields and scrub, the coastline of
 *  plan.sea(), beaches, rocks, foam and the ocean. `far` = the transparent ring that fades into the Morocco map. */
export function groundMaterial(tLand: THREE.Texture, far: boolean) {
  const m = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.97, transparent: far, depthWrite: !far });
  return cityPatch(m, {
    key: far ? "ground-far" : "ground",
    uniforms: {
      tLand: { value: tLand }, tSand: { value: CTEX.sand() }, tSoil: { value: CTEX.soil() }, tRocks: { value: CTEX.rocks() }, tGrass: { value: CTEX.grass() },
      uTileSa: CTILE("sand"), uTileSo: CTILE("soil"), uTileRo: CTILE("rocks"), uTileGr: CTILE("grass"),
    },
    vert: (s) => s.replace("#include <common>", "#include <common>\nvarying vec2 vWp;").replace("#include <begin_vertex>", "#include <begin_vertex>\n  vWp = (modelMatrix * vec4(position, 1.0)).xz;"),
    frag: (s) => s.replace("#include <common>", `#include <common>
uniform sampler2D tLand; uniform sampler2D tSand; uniform sampler2D tSoil; uniform sampler2D tRocks; uniform sampler2D tGrass;
uniform float uTileSa; uniform float uTileSo; uniform float uTileRo; uniform float uTileGr;
varying vec2 vWp;
float gSea = 0.0, gRough = 0.97;`)
      .replace("float mapK = uMapK;", `float mapK = uMapK;
  {
    vec2 p = vWp;
    float vd = length(vViewPosition);
    float t = dot(p, vec2(0.70710678, -0.70710678)), nb = dot(p, vec2(-0.70710678, -0.70710678));
    float wig = 170.0 * sin(t / 1150.0) + 70.0 * sin(t / 430.0 + 1.3) + ${f1(HANK.h)} * exp(-pow((t - ${f1(HANK.t)}) / ${f1(HANK.w)}, 2.0));
    float s = nb - wig - ${f1(COAST)};
    vec2 luv = p / 25600.0 + 0.5;
    vec4 lu = (luv.x > 0.0 && luv.x < 1.0 && luv.y > 0.0 && luv.y < 1.0) ? texture2D(tLand, luv) : vec4(0.0);
    float dens = lu.r, green = lu.g, hard = lu.b;
    float near = 1.0 - smoothstep(900.0, 4000.0, vd), mid = 1.0 - smoothstep(4000.0, 16000.0, vd);
    // ---- countryside: parcels of fallow, ploughed soil, stubble, green crops, dark tirs; furrows, tracks, scrub, olive groves
    float ang = 0.35 + 0.6 * (vn(p / 9000.0) - 0.5);
    vec2 rp = vec2(cos(ang) * p.x - sin(ang) * p.y, sin(ang) * p.x + cos(ang) * p.y);
    vec2 q = rp / vec2(230.0, 150.0) + (vec2(vn(p / 800.0), vn(p / 800.0 + 7.3)) - 0.5) * 0.7;
    vec2 fi = floor(q), fq = fract(q);
    float fh = h21(fi);
    // parcels split into strips (1 … 3 per parcel), October tones: fallow, ploughed, stubble, a few green crops, dark tirs
    float ns = 1.0 + floor(fh * 3.0);
    float sid = floor(fq.y * ns);
    float sh2 = h21(fi * 1.7 + sid * 13.1);
    vec3 field = sh2 < 0.3 ? vec3(0.4707, 0.3619, 0.2176) : sh2 < 0.5 ? vec3(0.3250, 0.2176, 0.1332) : sh2 < 0.7 ? vec3(0.5468, 0.4420, 0.2474)
               : sh2 < 0.82 ? vec3(0.2684, 0.2793, 0.1332) : sh2 < 0.93 ? vec3(0.2373, 0.1643, 0.1056) : vec3(0.4009, 0.3250, 0.1899);
    field *= 0.92 + 0.16 * vn(fi * 3.1 + p / 300.0);
    field = mix(field, vec3(0.325, 0.2474, 0.1332), smoothstep(3500.0, 14000.0, vd) * 0.8);
    float fur = 0.5 + 0.5 * sin(fq.x * 6.2832 * 40.0);
    field *= mix(1.0, 0.9 + 0.1 * fur, (1.0 - smoothstep(150.0, 700.0, vd)) * step(0.26, fh) * step(fh, 0.62));
    vec2 eq = abs(fq - 0.5);
    field = mix(field, vec3(0.2176, 0.1899, 0.1056), smoothstep(0.475, 0.5, max(eq.x, eq.y)) * near);   // tracks and hedges
    if (fh > 0.9) { vec2 oc = fract(rp / 9.0) - 0.5; field = mix(field, vec3(0.0707, 0.0993, 0.0433), smoothstep(0.32, 0.2, length(oc)) * near); } // olive groves
    float so = texture2D(tSoil, p / uTileSo).r / 0.627, so2 = texture2D(tSoil, p.yx / (uTileSo * 9.1) + 0.2).r / 0.627;
    field *= mix(1.0, so * so2, 0.6 * mid);
    float sc = vn(p / 5.5) * vn(p / 37.0 + 3.0);
    vec3 land = mix(field, vec3(0.0707, 0.0872, 0.0358), smoothstep(0.4, 0.56, sc) * 0.75 * near);       // scrub (lentisk, palmetto)
    // ---- the city ground: dusty lots and courtyards, gardens, port / industrial concrete
    // courtyards and lots: concrete, dust, tiles, a little garden, bare earth (averaged with distance)
    float lh = h21(floor(p / 23.0) + 0.37);
    vec3 urb = lh < 0.3 ? vec3(0.3250, 0.3132, 0.2793) : lh < 0.6 ? vec3(0.4563, 0.3876, 0.2904) : lh < 0.75 ? vec3(0.5468, 0.4854, 0.4009) : lh < 0.86 ? vec3(0.1812, 0.2176, 0.0932) : vec3(0.2904, 0.2273, 0.1562);
    urb = mix(urb, vec3(0.4143, 0.3619, 0.2904), smoothstep(700.0, 2500.0, vd));
    urb *= mix(1.0, so, 0.45 * mid) * (0.94 + 0.08 * vn(p / 40.0));
    land = mix(land, urb, smoothstep(0.08, 0.4, dens));
    vec3 gard = mix(vec3(0.0561, 0.1122, 0.029), vec3(0.119, 0.1643, 0.0474), vn(p / 13.0)) * mix(1.0, dot(texture2D(tGrass, p / uTileGr).rgb, vec3(0.333)) / 0.3, 0.5 * near);
    land = mix(land, gard, green * 0.85);
    land = mix(land, vec3(0.325, 0.325, 0.3017) * (0.94 + 0.08 * vn(p / 25.0)), hard * 0.9);
    // ---- the shore: beaches (wide at Aïn Diab), rocks (El Hank, by the mosque), quays along the port
    bool cor = t > ${f1(CORNICHE.t0)} && t < ${f1(CORNICHE.t1)};
    float bw = cor ? 55.0 + 35.0 * sin(t / 610.0) * sin(t / 233.0) : 14.0;
    float rocky = max(smoothstep(520.0, 260.0, abs(t - ${f1(HANK.t)})), smoothstep(380.0, 200.0, abs(t + 260.0)));
    rocky = max(rocky, (cor ? 0.0 : 0.65) * smoothstep(0.55, 0.7, vn(vec2(t / 160.0, 1.0))));
    bool port = t > ${f1(PORT.root)} && t < ${f1(PORT.eastT)};
    vec3 c = land;
    if (s > -bw - 10.0) {
      vec3 sand = texture2D(tSand, p / uTileSa).rgb * vec3(1.1368, 1.0672, 0.9565);
      vec3 rk = texture2D(tRocks, p / uTileRo).rgb * 0.9;
      vec3 sh = mix(sand, rk, rocky);
      sh = mix(sh, sh * vec3(0.4854, 0.4854, 0.5156), smoothstep(-9.0, 0.0, s) * (1.0 - rocky * 0.5));   // wet sand
      float k = smoothstep(-bw - 10.0, -bw + 2.0, s);
      c = mix(c, sh, k);
      if (port) c = mix(c, vec3(0.3017, 0.3017, 0.2793) * (0.94 + 0.08 * vn(p / 20.0)), smoothstep(-115.0, -105.0, s));
    }
    // ---- the Atlantic: turquoise shallows, deep teal, foam lines rolling in, calm harbour water inside the jetty
    if (s > 0.0) {
      float depth = smoothstep(0.0, 1400.0, s + 60.0 * (vn(p / 300.0) - 0.5));
      vec3 w = mix(vec3(0.0707, 0.3017, 0.3017), vec3(0.0078, 0.0872, 0.1483), smoothstep(0.0, 0.2, depth));
      w = mix(w, vec3(0.0021, 0.029, 0.0707), smoothstep(0.2, 1.0, depth));
      w *= 0.94 + 0.1 * fbm3(p / 60.0 + uTime * 0.01);
      bool harb = port && nb < ${f1(PORT.jettyB)} - 14.0;
      if (harb) w = mix(vec3(0.0177, 0.0707, 0.0815), vec3(0.0078, 0.0433, 0.0608), smoothstep(0.0, 400.0, s)) * (0.95 + 0.07 * vn(p / 30.0 + uTime * 0.02));
      else {
        float sw = sin(s * 0.16 - uTime * 0.9 + vn(p / 45.0) * 5.0);
        float foam = smoothstep(0.86, 1.0, sw) * smoothstep(90.0, 8.0, s) * (0.5 + 0.5 * vn(p / 9.0));
        foam = max(foam, smoothstep(7.0, 1.0, s) * (0.65 + 0.35 * vn(p / 4.0 + uTime * 0.3)));
        w = mix(w, vec3(0.8524, 0.8933, 0.8727), foam * (cor ? 1.0 : 0.75) * near);
      }
      c = mix(c, w, smoothstep(0.0, 2.0, s));
      gSea = smoothstep(0.0, 4.0, s);
      if (rocky > 0.05 && s < 70.0 && !port) {
        float ro = vn(p / 13.0) * 0.7 + vn(p / 4.0) * 0.3 - s / 160.0;
        float rk = smoothstep(0.5, 0.56, ro) * rocky;
        vec3 rc = texture2D(tRocks, p / uTileRo).rgb * 0.85;
        c = mix(c, vec3(0.86, 0.88, 0.87), smoothstep(0.42, 0.5, ro) * (1.0 - smoothstep(0.5, 0.56, ro)) * rocky * 0.8 * near); // foam around the rocks
        c = mix(c, rc, rk);
        gSea *= 1.0 - rk;
      }
    }
    diffuseColor.rgb = c;
    // distant ground melts into the map's colours (aerial perspective of the "map")
    mapK = max(mapK, smoothstep(12000.0, 42000.0, vd));
${far ? `    float r = length(p);
    diffuseColor.a *= mix(1.0 - smoothstep(9000.0, 16000.0, r), 1.0 - smoothstep(30000.0, 75000.0, r), uHole);` : ""}
  }`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.32, gSea);"),
  });
}

/** Land-use map of the city ground (±12.8 km, 512 px): R = urban density, G = greenery, B = hard ground (port, industry). */
export function landTexture(fn: (x: number, z: number) => [number, number, number]) {
  const S = 512, data = new Uint8Array(S * S * 4);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = ((i + 0.5) / S - 0.5) * 25600, z = ((j + 0.5) / S - 0.5) * 25600;
    const [a, b, c] = fn(x, z), o = (j * S + i) * 4;
    data[o] = a * 255; data[o + 1] = b * 255; data[o + 2] = c * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.flipY = false; t.needsUpdate = true;
  return t;
}
