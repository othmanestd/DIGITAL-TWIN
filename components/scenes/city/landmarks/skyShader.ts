// Sky shader of <CitySky/>: a Preetham / Rayleigh–Mie single-scattering sky in the manner of three's Sky (Preetham 1999), then
// graded to sit above the soft-blue city: pale lavender horizon haze, calm zenith, warm sunrise / sunset, procedural stars and
// moon at night, a cheap layer of soft clouds. Pure strings and numbers (no three.js) so the shader can also be tuned offline.
//
// The sky is drawn as one full-screen triangle at the far plane (depth 1), BEFORE the world, with depth test on: pixels the
// city, the map or the globe cover are rejected early, and nothing here depends on the 1:1 m world scale or the log depth.

export const SKY_VERT = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

/** Horizon haze colour of a view direction: pale lavender by day (the colour of the city's ground far away), peach near the sun
 *  at dusk, deep blue at night. Needs `uniform vec3 uSun`. Shared by the sky and by the haze layers that melt the far ground into it. */
const HAZE_FN = /* glsl */ `
vec3 hazeColor(vec3 dir) {
  float sunUp = smoothstep(-0.12, 0.12, uSun.y);
  float twilight = smoothstep(-0.2, 0.0, uSun.y) * smoothstep(0.38, 0.0, uSun.y);
  vec3 haze = mix(vec3(0.06, 0.08, 0.17), vec3(0.80, 0.84, 0.95), sunUp);
  vec2 hs = normalize(uSun.xz + 1e-4), hd = normalize(dir.xz + 1e-4);
  float towardSun = pow(max(dot(hs, hd), 0.0), 3.0);
  haze = mix(haze, vec3(0.98, 0.70, 0.55), twilight * (0.35 + 0.65 * towardSun) * 0.85);
  return mix(haze, vec3(0.62, 0.52, 0.72), twilight * (1.0 - towardSun) * 0.35);
}
`;

export const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec2 vNdc;
uniform mat4 uInvProj;
uniform mat3 uCamRot;
uniform vec3 uCamPos;
uniform vec3 uSun;
uniform vec3 uBetaR;
uniform vec3 uBetaM;
uniform float uSunE;
uniform float uSunFade;
uniform float uMieG;
uniform float uDay;
uniform float uAlt;
uniform float uOpacity;
uniform float uTime;
uniform float uCover;
uniform float uExposure;
uniform sampler2D uNoise;

const float PI = 3.141592653589793;
const float RAY_ZENITH = 8.4e3;
const float MIE_ZENITH = 1.25e3;
const float SUN_COS = 0.99995;
const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
const float ONE_OVER_FOURPI = 0.07957747154594767;

float hgPhase(float cosTheta, float g) {
  float g2 = g * g;
  return ONE_OVER_FOURPI * ((1.0 - g2) / pow(1.0 - 2.0 * g * cosTheta + g2, 1.5));
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

${HAZE_FN}

vec3 atmosphere(vec3 dir) {
  float zenith = acos(max(0.0, dir.y));
  float inv = 1.0 / (cos(zenith) + 0.15 * pow(93.885 - (zenith * 180.0) / PI, -1.253));
  float sR = RAY_ZENITH * inv, sM = MIE_ZENITH * inv;
  vec3 Fex = exp(-(uBetaR * sR + uBetaM * sM));
  float cosTheta = dot(dir, uSun);
  float rPhase = THREE_OVER_SIXTEENPI * (1.0 + pow(cosTheta * 0.5 + 0.5, 2.0));
  vec3 betaRT = uBetaR * rPhase;
  vec3 betaMT = uBetaM * hgPhase(cosTheta, uMieG);
  vec3 ratio = (betaRT + betaMT) / (uBetaR + uBetaM);
  vec3 Lin = pow(uSunE * ratio * (1.0 - Fex), vec3(1.5));
  Lin *= mix(vec3(1.0), pow(uSunE * ratio * Fex, vec3(0.5)), clamp(pow(1.0 - uSun.y, 5.0), 0.0, 1.0));
  vec3 L0 = vec3(0.1) * Fex;
  vec3 tex = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);
  return pow(tex, vec3(1.0 / (1.2 + 1.2 * uSunFade)));
}

// two layers of stars on a 3-D cell grid over the direction: sparse, small, pale, a slow twinkle
float stars(vec3 dir) {
  float s = 0.0;
  for (int k = 0; k < 2; k++) {
    float f = k == 0 ? 40.0 : 80.0;
    vec3 p = dir * f, ip = floor(p), fp = fract(p) - 0.5;
    float h = hash13(ip + float(k) * 17.0);
    if (h > (k == 0 ? 0.955 : 0.975)) {
      vec3 off = vec3(hash13(ip + 3.1), hash13(ip + 7.7), hash13(ip + 11.3)) - 0.5;
      float d = length(fp - off * 0.6);
      float tw = 0.75 + 0.25 * sin(uTime * (0.8 + h * 2.0) + h * 60.0);
      s += smoothstep(0.17, 0.0, d) * (0.4 + 0.9 * fract(h * 91.7)) * tw;
    }
  }
  return s;
}

void main() {
  vec4 v = uInvProj * vec4(vNdc, 0.0, 1.0);
  vec3 dir = normalize(uCamRot * normalize(v.xyz / v.w));
  float up = dir.y;
  float sunUp = smoothstep(-0.12, 0.12, uSun.y);              // daylight in the sky (not the same as uDay: follows the sun)
  float night = smoothstep(0.05, -0.2, uSun.y);
  float twilight = smoothstep(-0.2, 0.0, uSun.y) * smoothstep(0.38, 0.0, uSun.y); // 0 night / noon, 1 at the horizon

  // physical sky, graded: a calmer, slightly lavender blue
  vec3 c = pow(aces(atmosphere(dir) * uExposure), vec3(1.0 / 2.2));
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, 1.02);
  c *= vec3(0.985, 0.995, 1.04);
  // a clearer, deeper blue overhead by day (the pure Preetham sky stays milky at moderate elevations)
  c *= mix(vec3(1.0), vec3(0.74, 0.86, 1.07), smoothstep(0.05, 0.7, up) * smoothstep(0.1, 0.5, uSun.y));

  // twilight and night body: indigo at dusk, deep navy at night (the physical model is too dark and grey there)
  float tw = smoothstep(-0.22, 0.0, uSun.y);
  vec3 dark = mix(vec3(0.022, 0.032, 0.085), vec3(0.085, 0.105, 0.22), pow(1.0 - clamp(up, 0.0, 1.0), 2.0));
  vec3 dusk = mix(vec3(0.10, 0.14, 0.36), vec3(0.50, 0.40, 0.60), pow(1.0 - clamp(up, 0.0, 1.0), 1.5));
  c = mix(mix(dark, dusk, tw), c, smoothstep(-0.06, 0.045, uSun.y));

  // horizon haze (see hazeColor)
  float hz = pow(1.0 - clamp(up, 0.0, 1.0), 5.0);
  vec3 haze = hazeColor(dir);
  c = mix(c, haze, hz * 0.55);
  c = mix(c, haze * 0.92, smoothstep(0.0, -0.12, up));           // below the horizon (far edge of the map): stay in the haze

  // stars and moon at night; they fade where the haze thickens
  float starK = smoothstep(-0.07, -0.22, uSun.y) * smoothstep(0.0, 0.22, up) * 0.95;
  if (starK > 0.001) c += vec3(0.78, 0.84, 1.0) * stars(dir) * starK;
  vec3 moonDir = normalize(vec3(0.36, 0.5, -0.78));
  float mAng = acos(clamp(dot(dir, moonDir), -1.0, 1.0));
  float moonR = 0.0085;
  float moonDisc = smoothstep(moonR, moonR * 0.93, mAng);
  float moonShade = smoothstep(moonR * 0.35, moonR * 1.25, acos(clamp(dot(dir, normalize(moonDir + vec3(0.012, 0.004, 0.0))), -1.0, 1.0)));
  c += vec3(0.92, 0.95, 1.0) * (moonDisc * (0.35 + 0.55 * moonShade) + exp(-mAng * 70.0) * 0.18) * night;

  // sun: a small disc and a soft glow, warm near the horizon
  float cs = dot(dir, uSun);
  vec3 sunCol = mix(vec3(1.0, 0.72, 0.46), vec3(1.0, 0.97, 0.9), smoothstep(0.0, 0.5, uSun.y));
  float sunVis = smoothstep(-0.045, 0.02, uSun.y);
  c += sunCol * (smoothstep(SUN_COS, SUN_COS + 0.00003, cs) * 3.0 + pow(max(cs, 0.0), 80.0) * 0.1 + pow(max(cs, 0.0), 900.0) * 0.6) * sunVis;

  // soft clouds: a thin layer 2.6 km up, projected from the camera so they drift and have parallax; none once we rise through it
  float cloudH = 2600.0, camH = max(uCamPos.y, 0.0);
  float cloudK = (1.0 - smoothstep(cloudH - 1100.0, cloudH - 150.0, camH)) * smoothstep(0.035, 0.2, up);
  if (cloudK > 0.002) {
    float t = (cloudH - camH) / max(up, 0.035);
    vec2 uv = (uCamPos.xz + dir.xz * t) / 22000.0 + uTime * vec2(0.0011, 0.0004);
    vec4 n = texture2D(uNoise, uv);
    float shape = n.r * 0.5 + n.g * 0.27 + n.b * 0.15 + n.a * 0.08;
    vec4 n2 = texture2D(uNoise, uv * 2.9 + 0.37);
    shape = mix(shape, n2.r * 0.5 + n2.g * 0.3 + n2.b * 0.2, 0.28);
    float d = smoothstep(uCover, uCover + 0.22, shape);
    vec4 nl = texture2D(uNoise, uv + normalize(uSun.xz + 1e-4) * 0.011);
    float sl = nl.r * 0.5 + nl.g * 0.27 + nl.b * 0.15 + nl.a * 0.08;
    float lit = clamp(0.62 + (shape - sl) * 5.5, 0.0, 1.0);
    vec3 lightCol = mix(vec3(1.0, 0.7, 0.55), vec3(1.0, 0.985, 0.97), smoothstep(0.02, 0.4, uSun.y));
    vec3 shadowCol = mix(vec3(0.34, 0.37, 0.5), vec3(0.66, 0.72, 0.86), smoothstep(-0.05, 0.4, uSun.y));
    vec3 cc = mix(shadowCol, lightCol, lit);
    cc = mix(cc * 0.22 + vec3(0.02, 0.03, 0.07), cc, smoothstep(-0.14, 0.14, uSun.y));   // night: faint, cold
    float a = d * 0.86 * cloudK * (1.0 - 0.45 * night);
    c = mix(c, mix(cc, haze, 0.35 * (1.0 - smoothstep(0.0, 0.35, up))), a);
  }

  // thinning with altitude: the zenith goes deep navy (the app's space), the limb keeps its band
  float thin = smoothstep(1500.0, 30000.0, uAlt);
  vec3 deep = vec3(0.045, 0.070, 0.150);
  float limb = pow(1.0 - clamp(up, 0.0, 1.0), 3.0);
  c = mix(c, mix(deep, haze * 0.8, limb * (1.0 - 0.5 * thin)), thin * 0.92);

  // never let a NaN (a bad uniform at some time of day) turn into a flat colour: fall back to the haze
  if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = hazeColor(dir);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0) * uOpacity, uOpacity);
}
`;

/** CPU side of the Preetham model (same constants as three's Sky): returns the uniforms that depend on the sun. */
export function skyCoefficients(sunY: number, rayleigh = 1.6, turbidity = 3.2, mie = 0.004) {
  const lambda = [680e-9, 550e-9, 450e-9], K = [0.686, 0.678, 0.666];
  const n = 1.0003, N = 2.545e25, pn = 0.035, v = 4.0;
  const sunFade = Math.min(1, Math.exp((sunY * 400000) / 450000));
  const cutoff = Math.PI / 1.95, steep = 1.5;
  const sunE = 1000 * Math.max(0, 1 - Math.exp(-((cutoff - Math.acos(Math.max(-1, Math.min(1, sunY)))) / steep)));
  const rc = rayleigh - (1 - sunFade);
  const c = 0.2 * turbidity * 10e-18;
  const betaR = lambda.map((l) => ((8 * Math.PI ** 3 * (n * n - 1) ** 2 * (6 + 3 * pn)) / (3 * N * l ** 4 * (6 - 7 * pn))) * rc);
  const betaM = lambda.map((l, i) => 0.434 * c * Math.PI * ((2 * Math.PI) / l) ** (v - 2) * K[i] * mie);
  return { betaR, betaM, sunE, sunFade };
}

/** Ground haze (aerial perspective): one huge flat ring just above the ground, centred on the camera, that blends the far ground toward
 *  the horizon haze with the distance the view ray travels through the haze layer (below uH metres): smooth, no banding, and
 *  thinner as the camera climbs above the layer. Uses the log depth buffer so it sits correctly in the world. */
export const HAZE_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;
export const HAZE_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vW;
uniform vec3 uSun;
uniform float uK;
uniform float uP0;
uniform float uH;
uniform float uAmp;
${HAZE_FN}
void main() {
  #include <logdepthbuf_fragment>
  vec3 d = vW - cameraPosition;
  float dist = length(d);
  float path = dist * min(1.0, uH / max(cameraPosition.y, 1.0));
  float a = uAmp * (1.0 - exp(-uK * max(0.0, path - uP0)));
  vec3 hc = hazeColor(d / dist);
  if (!(a == a) || !(hc.r == hc.r)) { a = 0.0; hc = vec3(0.0); }
  gl_FragColor = vec4(hc * a, a);
}
`;
