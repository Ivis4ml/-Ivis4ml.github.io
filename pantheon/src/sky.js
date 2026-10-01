// Sky, sun/moon, stars, clouds, fog and image-based lighting for Rome (41.8986°N, 12.4769°E).
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { DEG, TAU, clamp, lerp, smoothstep, mulberry32, makeCanvas, mix3 } from './util.js';

export const LAT = 41.8986 * DEG;

/** Solar position (ignores equation of time; `hours` = local *solar* time). Returns world-space unit vector to the sun. */
export function solarPosition(dayOfYear, hours) {
  const decl = 23.44 * DEG * Math.sin(TAU * (284 + dayOfYear) / 365);
  const h = (hours - 12) * 15 * DEG;
  const sinAlt = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(h);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  const azS = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(LAT) - Math.tan(decl) * Math.cos(LAT)); // from south, +west
  const az = azS + Math.PI; // from north, clockwise
  return {
    alt, az, decl,
    dir: new THREE.Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)),
  };
}

export function dayOfYear(month, day) {
  const dm = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let n = day; for (let i = 0; i < month - 1; i++) n += dm[i]; return n;
}

const WARM = [1.0, 0.5, 0.25], WHITE = [1.0, 0.96, 0.9];

export class SkySystem {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.moonDir = new THREE.Vector3(0, -1, 0);
    this.state = { sunAlt: 1, daylight: 1, night: 0, weather: 'clear' };
    this.envTime = -1e9;

    // --- sky dome (Preetham + clouds)
    const sky = new Sky(); sky.scale.setScalar(450000); sky.renderOrder = -10;
    const u = sky.material.uniforms;
    u.turbidity.value = 3.2; u.rayleigh.value = 1.25; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
    u.cloudCoverage.value = 0.32; u.cloudDensity.value = 0.45; u.cloudElevation.value = 0.55; u.cloudSpeed.value = 0.00006;
    scene.add(sky); this.sky = sky;

    // --- twilight / night-sky dome (the Preetham sky goes black right after sunset)
    this.twilight = this.makeTwilight(); scene.add(this.twilight);
    // --- stars
    this.stars = this.makeStars(); scene.add(this.stars);
    // --- moon
    this.moon = this.makeMoon(); scene.add(this.moon);

    // --- key light (sun by day, moon by night) with a big shadow map aimed at the Pantheon
    const key = new THREE.DirectionalLight(0xffffff, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    const c = key.shadow.camera; const E = 105;
    c.left = -E; c.right = E; c.top = E; c.bottom = -E; c.near = 1; c.far = 600;
    key.shadow.bias = -0.0003; key.shadow.normalBias = 0.06; key.shadow.radius = 2.5;
    key.target.position.set(0, 12, -30);
    scene.add(key, key.target); this.key = key;

    this.hemi = new THREE.HemisphereLight(0xaec6ea, 0x8a7a66, 0.25); scene.add(this.hemi);

    // --- IBL from the sky
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(sky.geometry, sky.material); this.envSky.scale.setScalar(450000); this.envScene.add(this.envSky);
    const gnd = new THREE.Mesh(new THREE.SphereGeometry(5000, 24, 8, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4a4236, side: THREE.BackSide }));
    this.envScene.add(gnd); this.envGround = gnd;
    this.envRT = null; this.envBoost = 0.34;

    scene.fog = new THREE.FogExp2(0xbfd0e6, 0.00055);
  }

  makeTwilight() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, -1, 0) }, uTw: { value: 0 }, uNight: { value: 0 }, uMoonUp: { value: 0 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `varying vec3 vD; uniform vec3 uSun, uMoon; uniform float uTw, uNight, uMoonUp;
        void main(){
          vec3 d = normalize(vD); float h = d.y;
          vec2 sa = normalize(uSun.xz + vec2(1e-5)), da = normalize(d.xz + vec2(1e-5));
          float az = dot(sa, da) * 0.5 + 0.5;
          float horizon = exp(-max(h, 0.0) * 4.2);
          vec3 warm = mix(vec3(0.55, 0.18, 0.14), vec3(1.0, 0.52, 0.2), pow(az, 3.0));
          vec3 cool = mix(vec3(0.03, 0.05, 0.16), vec3(0.2, 0.22, 0.5), horizon);
          vec3 tw = mix(cool, warm, pow(az, 2.0) * horizon) * (0.55 + horizon * 1.6);
          vec3 col = tw * uTw * 0.16;
          col += mix(vec3(0.004, 0.008, 0.024), vec3(0.016, 0.02, 0.04), horizon) * uNight;
          float md = max(dot(d, normalize(uMoon)), 0.0);
          col += (vec3(0.45, 0.55, 0.9) * pow(md, 120.0) * 0.06 + vec3(0.3, 0.38, 0.65) * pow(md, 7.0) * 0.012) * uMoonUp * uNight;
          gl_FragColor = vec4(col * smoothstep(-0.06, 0.01, h), 1.0);
        }`,
      side: THREE.BackSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, fog: false,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), mat); m.scale.setScalar(5500); m.renderOrder = -9.5; m.frustumCulled = false; return m;
  }

  makeStars() {
    const rnd = mulberry32(99), N = 5200;
    const pos = new Float32Array(N * 3), size = new Float32Array(N), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let x, y, z;
      if (i < N * 0.35) { // milky-way band: great circle tilted 62°
        const a = rnd() * TAU, spread = (rnd() + rnd() + rnd() - 1.5) * 0.18;
        x = Math.cos(a); y = spread; z = Math.sin(a);
        const t = 62 * DEG; const y2 = y * Math.cos(t) - z * Math.sin(t), z2 = y * Math.sin(t) + z * Math.cos(t); y = y2; z = z2;
      } else { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; }
      const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      pos.set([x * 6000, y * 6000, z * 6000], i * 3);
      const m = Math.pow(rnd(), 5.0); // few bright, many faint
      size[i] = 1.0 + m * 3.2;
      const temp = rnd();
      const c = mix3([1.0, 0.82, 0.68], [0.7, 0.8, 1.0], temp);
      const b = 0.25 + m * 0.9;
      col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.ShaderMaterial({
      uniforms: { uNight: { value: 0 }, uScale: { value: 1 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; uniform float uNight;
        void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); float a=smoothstep(0.5,0.0,r); gl_FragColor=vec4(vC*a*uNight*2.2, a*uNight); }`,
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m); pts.renderOrder = -9; pts.frustumCulled = false;
    const grp = new THREE.Group(); grp.add(pts); grp.userData.mat = m; grp.renderOrder = -9;
    return grp;
  }

  makeMoon() {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
    const rnd = mulberry32(5);
    g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.3, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(120,118,112,${0.12 + rnd() * 0.18})`; const a = rnd() * TAU, d = Math.sqrt(rnd()) * S * 0.26; g.beginPath(); g.arc(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 6 + rnd() * 22, 0, TAU); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    const gr = g.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(210,225,255,0.35)'); gr.addColorStop(1, 'rgba(210,225,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true, fog: false, toneMapped: false, color: 0xffffff });
    const sp = new THREE.Sprite(mat); sp.scale.setScalar(150); sp.renderOrder = -8; return sp;
  }

  /** day: day-of-year, hours: solar time 0..24. weather: 'clear'|'cloudy'|'overcast' */
  setTime(day, hours, weather = 'clear') {
    const sp = solarPosition(day, hours);
    this.sunDir.copy(sp.dir);
    const sunAlt = sp.alt, s = Math.sin(sunAlt);
    const daylight = smoothstep(-0.10, 0.18, s);        // 0 night .. 1 full day
    const twilight = smoothstep(-0.28, -0.02, s) * (1 - smoothstep(0.02, 0.3, s));
    const night = 1 - smoothstep(-0.26, -0.06, s);
    // moon: roughly opposite the sun, slightly offset
    this.moonDir.copy(sp.dir).multiplyScalar(-1);
    this.moonDir.applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.12).normalize();
    const moonUp = smoothstep(-0.02, 0.12, this.moonDir.y);
    const lamps = 1 - smoothstep(-0.14, 0.03, s);
    Object.assign(this.state, { sunAlt, daylight, night, twilight, weather, sunS: s, lamps });

    // weather
    const u = this.sky.material.uniforms;
    const wx = { clear: [0.28, 0.4], cloudy: [0.55, 0.6], overcast: [0.92, 0.9] }[weather] || [0.3, 0.4];
    u.cloudCoverage.value = wx[0]; u.cloudDensity.value = wx[1];
    u.sunPosition.value.copy(this.sunDir).multiplyScalar(400000);
    u.turbidity.value = weather === 'overcast' ? 9 : 4.2; u.rayleigh.value = lerp(0.95, 0.7, twilight);
    const overcast = weather === 'overcast' ? 0.55 : weather === 'cloudy' ? 0.15 : 0;

    // key light
    const sunWarm = mix3(WARM, WHITE, smoothstep(0.02, 0.5, s));
    const sunI = 5.2 * smoothstep(-0.01, 0.12, s) * (1 - overcast);
    const moonI = 0.85 * moonUp * night;
    this.sunI = sunI; this.moonI = moonI; this.state.overcast = overcast;
    if (sunI > 0.01 || moonI < 0.01) {
      this.key.position.copy(this.sunDir).multiplyScalar(300).add(this.key.target.position);
      this.key.color.setRGB(sunWarm[0], sunWarm[1], sunWarm[2]); this.key.intensity = sunI;
    } else {
      this.key.position.copy(this.moonDir).multiplyScalar(300).add(this.key.target.position);
      this.key.color.setRGB(0.62, 0.72, 1.0); this.key.intensity = moonI;
    }
    this.hemi.intensity = lerp(0.55, 0.34, daylight) * (1 + overcast * 0.6);
    const skyC = mix3([0.15, 0.14, 0.17], [0.82, 0.86, 0.95], daylight);
    this.hemi.color.setRGB(skyC[0], skyC[1], skyC[2]);
    const grC = mix3([0.16, 0.11, 0.07], [0.62, 0.5, 0.36], daylight);
    this.hemi.groundColor.setRGB(grC[0], grC[1], grC[2]);

    // fog
    const hz = mix3(mix3([0.01, 0.015, 0.035], [0.72, 0.8, 0.9], daylight), [0.95, 0.55, 0.38], twilight * 0.7);
    this.scene.fog.color.setRGB(hz[0], hz[1], hz[2]);
    this.scene.fog.density = lerp(0.0006, 0.00042, daylight) * (1 + overcast * 1.2);

    // stars / moon
    this.stars.userData.mat.uniforms.uNight.value = night * (1 - overcast * 0.9);
    this.starAxis = this.starAxis || new THREE.Vector3(0, Math.sin(LAT), -Math.cos(LAT));
    this.stars.setRotationFromAxisAngle(this.starAxis, -hours * 15 * DEG);
    const tu = this.twilight.material.uniforms; tu.uSun.value.copy(this.sunDir); tu.uMoon.value.copy(this.moonDir); tu.uTw.value = twilight; tu.uNight.value = night * (1 - overcast * 0.4); tu.uMoonUp.value = moonUp;
    this.moon.material.opacity = moonUp * (0.25 + 0.75 * night);
    this.moon.visible = this.moon.material.opacity > 0.01;

    // env tint (ground bounce brightness)
    const g = mix3([0.01, 0.01, 0.012], [0.62, 0.52, 0.4], daylight);
    this.envGround.material.color.setRGB(g[0], g[1], g[2]);
  }

  /** Re-bake sky IBL (throttled by caller). */
  updateEnvironment() {
    const u = this.sky.material.uniforms; const prev = u.showSunDisc.value; u.showSunDisc.value = 0;
    const rt = this.pmrem.fromScene(this.envScene, 0, 1, 10000000);
    u.showSunDisc.value = prev;
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt; this.scene.environment = rt.texture;
    const d = this.state.daylight, n = this.state.night;
    this.scene.environmentIntensity = lerp(0.9, 0.5, 1 - d) * (this.state.weather === 'overcast' ? 1.1 : 1) * this.envBoost;
  }

  update(t, camera) {
    this.sky.material.uniforms.time.value = t;
    this.moon.position.copy(camera.position).addScaledVector(this.moonDir, 4800); this.twilight.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.stars.userData.mat.uniforms.uScale.value = this.renderer.getPixelRatio() * (this.renderer.domElement.height / 900) * 0.9;
  }
}
