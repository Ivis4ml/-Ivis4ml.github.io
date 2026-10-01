// World-space, triplanar micro-detail for stone-like materials: adds centimetre/millimetre grain to
// albedo, roughness and the shading normal, so surfaces never read as a smooth plastic skin
// even where the baked texture is stretched or seen up close.
import * as THREE from 'three';
import { makeCanvas } from './util.js';
import { mulberry32 } from './util.js';

let tex = null;
function detailTexture() {
  if (tex) return tex;
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'); const img = g.createImageData(S, S); const d = img.data;
  const h = (x, y, p, s) => { // seamless value noise
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const H = (a, b) => { const r = mulberry32(((((a % p) + p) % p) * 73856093) ^ ((((b % p) + p) % p) * 19349663) ^ s)(); return r; };
    return (H(xi, yi) * (1 - u) + H(xi + 1, yi) * u) * (1 - v) + (H(xi, yi + 1) * (1 - u) + H(xi + 1, yi + 1) * u) * v;
  };
  for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i += 4) {
    let a = 0, b = 0, k = 1, amp = 0.5, n = 0;
    for (let o = 0; o < 4; o++) { const p = 8 * k; a += amp * h(x / S * p, y / S * p, p, 11 + o); b += amp * h(x / S * p * 2, y / S * p * 2, p * 2, 71 + o); n += amp; amp *= 0.5; k *= 2; }
    d[i] = (a / n) * 255; d[i + 1] = (b / n) * 255; d[i + 2] = h(x / 2, y / 2, S / 2, 5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/**
 * opts: s1 (coarse scale, 1/m), s2 (fine scale, 1/m), albedo (±), bump (normal strength), rough (± roughness)
 */
export function applyDetail(mat, { s1 = 2.2, s2 = 23, albedo = 0.16, bump = 0.9, rough = 0.18, macro = 0 } = {}) {
  const prev = mat.onBeforeCompile;
  const t = detailTexture();
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.tDetail = { value: t }; sh.uniforms.uD = { value: new THREE.Vector4(s1, s2, albedo, bump) }; sh.uniforms.uDR = { value: rough }; sh.uniforms.uMac = { value: macro };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDPos; varying vec3 vDNor;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 dp = vec4(transformed, 1.0); vec3 dn = objectNormal;
          #ifdef USE_INSTANCING
            dp = instanceMatrix * dp; dn = mat3(instanceMatrix) * dn;
          #endif
          vDPos = (modelMatrix * dp).xyz; vDNor = normalize(mat3(modelMatrix) * dn); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDPos; varying vec3 vDNor; uniform sampler2D tDetail; uniform vec4 uD; uniform float uDR; uniform float uMac;
        vec3 triD(vec3 p, vec3 n, float s) {
          vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
          return texture2D(tDetail, p.zy * s).rgb * w.x + texture2D(tDetail, p.xz * s).rgb * w.y + texture2D(tDetail, p.xy * s).rgb * w.z;
        }
        vec3 bumpD(vec3 N, vec3 p, float hh, float faceDir) {
          vec3 sx = dFdx(p), sy = dFdy(p); float dhx = dFdx(hh), dhy = dFdy(hh);
          vec3 R1 = cross(sy, N), R2 = cross(N, sx); float det = dot(sx, R1);
          if (abs(det) < 1e-12) return N;
          vec3 grad = sign(det * faceDir) * (dhx * R1 + dhy * R2);
          return normalize(abs(det) * N - grad);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 dNn = normalize(vDNor);
        vec3 dA = triD(vDPos, dNn, uD.x), dB = triD(vDPos, dNn, uD.y);
        float dMix = (dA.r - 0.5) * 0.9 + (dB.r - 0.5) * 0.6;
        diffuseColor.rgb *= 1.0 + dMix * uD.z * 2.0;
        if (uMac > 0.0) { vec3 dM = triD(vDPos, dNn, 0.045), dM2 = triD(vDPos, dNn, 0.17); float mv = (dM.r - 0.5) * 1.1 + (dM2.g - 0.5) * 0.7; diffuseColor.rgb *= 1.0 + mv * uMac; }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (dB.g - 0.5) * uDR * 2.0 + (dA.g - 0.5) * uDR, 0.06, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = bumpD(normal, -vViewPosition, (dA.g * 0.35 + dB.r * 0.65) * uD.w * 0.012, faceDirection);`);
  };
  mat.customProgramCacheKey = () => 'detail' + (prev ? prev.toString() : '');
  return mat;
}
