// Light photographic grade applied before tone mapping: removes the cold CG cast of the sky ambient
// (simple white balance), slightly lowers saturation and adds a touch of vignette. Deliberately subtle.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export class GradePass extends ShaderPass {
  constructor() {
    super({
      uniforms: { tDiffuse: { value: null }, uWB: { value: new THREE.Vector3(1.08, 1.0, 0.9) }, uSat: { value: 0.9 }, uVig: { value: 0.18 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uWB; uniform float uSat; uniform float uVig; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb * uWB;
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, uSat);
          vec2 d = vUv - 0.5; col *= 1.0 - uVig * dot(d, d) * 1.6;
          gl_FragColor = vec4(col, c.a); }`,
    });
  }
}
