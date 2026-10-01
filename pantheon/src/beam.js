// Screen-space volumetric sunbeam through the oculus. Marches the view ray (clipped by scene depth),
// and at each sample asks: "does the ray from here toward the sun pass through the 8.92 m oculus disc?"
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { DIM } from './pantheon.js';

const frag = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse; uniform sampler2D tDepth;
uniform mat4 uInvProj; uniform mat4 uCamWorld;
uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform float uIntensity; uniform float uTime; uniform float uActive; uniform float uDensity;
uniform vec3 uCamPos;
varying vec2 vUv;
const float R = ${DIM.R.toFixed(3)};
const float RO = ${DIM.oculusR.toFixed(3)};
const float YO = ${DIM.oculusY.toFixed(3)};
const float CY = ${DIM.R.toFixed(3)};

float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z); }

bool insideRotunda(vec3 p){
  if (p.y < 0.0) return false;
  if (p.y <= CY) return dot(p.xz,p.xz) < R*R;
  vec3 d = p - vec3(0.0, CY, 0.0); return dot(d,d) < R*R;
}
float exitRotunda(vec3 ro, vec3 rd){
  float tmax = 1e5;
  if (rd.y < -1e-4) tmax = min(tmax, (0.0-ro.y)/rd.y);
  vec3 oc = ro - vec3(0.0, CY, 0.0); float b = dot(oc,rd), c = dot(oc,oc)-R*R, h = b*b-c;
  if (h > 0.0) { float t = -b + sqrt(h); if (ro.y + rd.y*t >= CY) tmax = min(tmax, t); }
  float a = dot(rd.xz,rd.xz);
  if (a > 1e-6) { float bb = dot(ro.xz,rd.xz), cc = dot(ro.xz,ro.xz)-R*R, hh = bb*bb-a*cc;
    if (hh > 0.0) { float t = (-bb+sqrt(hh))/a; if (ro.y + rd.y*t <= CY) tmax = min(tmax, t); } }
  return tmax;
}
float hg(float c, float g){ float g2=g*g; return (1.0-g2)/(12.566371*pow(1.0+g2-2.0*g*c,1.5)); }

void main(){
  vec4 base = texture2D(tDiffuse, vUv);
  if (uActive < 0.5 || uIntensity < 0.001) { gl_FragColor = base; return; }
  float depth = texture2D(tDepth, vUv).x;
  vec4 ndc = vec4(vUv*2.0-1.0, depth*2.0-1.0, 1.0);
  vec4 v = uInvProj * ndc; v /= v.w;
  vec3 wp = (uCamWorld * v).xyz;
  vec3 ro = uCamPos; vec3 rd = normalize(wp - ro);
  float tEnd = min(length(wp - ro), 80.0);
  if (insideRotunda(ro)) tEnd = min(tEnd, exitRotunda(ro, rd));
  const int N = 56;
  float dt = tEnd / float(N);
  float j = hash13(vec3(gl_FragCoord.xy, uTime*7.0));
  float acc = 0.0;
  for (int i = 0; i < N; i++) {
    float t = (float(i) + j) * dt;
    vec3 p = ro + rd * t;
    if (!insideRotunda(p)) continue;
    float s = (YO - p.y) / uSunDir.y;
    if (s <= 0.0) continue;
    vec2 q = p.xz + uSunDir.xz * s;
    float inside = 1.0 - smoothstep(RO - 0.06, RO + 0.04, length(q));
    float dust = 0.55 + 0.9 * vnoise(p*0.42 + vec3(0.0, uTime*0.06, uTime*0.03)) + 0.35*vnoise(p*1.7 - uTime*0.05);
    acc += inside * dust;
  }
  acc *= dt;
  float ph = hg(dot(rd, uSunDir), 0.55) + 0.04;
  vec3 scatter = uSunColor * (acc * uDensity * ph * uIntensity);
  gl_FragColor = vec4(base.rgb + scatter, base.a);
}`;

export class BeamPass extends Pass {
  constructor(camera) {
    super();
    this.camera = camera;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null },
        uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color(1, 0.9, 0.75) },
        uIntensity: { value: 0 }, uTime: { value: 0 }, uActive: { value: 0 }, uDensity: { value: 0.32 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: frag, depthTest: false, depthWrite: false,
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture; u.tDepth.value = readBuffer.depthTexture;
    u.uInvProj.value.copy(this.camera.projectionMatrixInverse); u.uCamWorld.value.copy(this.camera.matrixWorld);
    u.uCamPos.value.setFromMatrixPosition(this.camera.matrixWorld);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }
  dispose() { this.material.dispose(); this.fsQuad.dispose(); }
}
