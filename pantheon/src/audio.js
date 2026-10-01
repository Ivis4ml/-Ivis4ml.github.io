// Procedural soundscape (WebAudio, no assets): piazza murmur, fountain, wind, swifts, rain, footsteps,
// and a ~6.5 s convolution reverb that swells when you stand under the dome.
export class AudioScape {
  constructor() { this.ctx = null; this.enabled = false; this.nextChirp = 0; }
  async toggle() {
    if (!this.ctx) this.init();
    this.enabled = !this.enabled;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, this.ctx.currentTime, 0.3);
    return this.enabled;
  }
  noiseBuffer(type, secs = 4) {
    const c = this.ctx, n = c.sampleRate * secs, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  loop(buf) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
  init() {
    const c = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);
    const white = this.noiseBuffer('white'), brown = this.noiseBuffer('brown');
    // reverb (Pantheon RT60 ≈ 6–7 s)
    const irLen = c.sampleRate * 6.5, ir = c.createBuffer(2, irLen, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-(i / c.sampleRate) / 1.05) * (1 - Math.exp(-i / 800)); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.revGain = c.createGain(); this.revGain.gain.value = 0.0; this.rev.connect(this.revGain); this.revGain.connect(this.master);
    this.dry = c.createGain(); this.dry.connect(this.master);
    const src = (buf, filters, gainNode, wet = 0) => {
      const s = this.loop(buf); let n = s;
      for (const f of filters) { const b = c.createBiquadFilter(); b.type = f[0]; b.frequency.value = f[1]; if (f[2]) b.Q.value = f[2]; n.connect(b); n = b; }
      n.connect(gainNode); gainNode.connect(this.dry); if (wet) { const w = c.createGain(); w.gain.value = wet; gainNode.connect(w); w.connect(this.rev); }
      return s;
    };
    this.gCrowd = c.createGain(); this.gFount = c.createGain(); this.gWind = c.createGain(); this.gRain = c.createGain(); this.gInside = c.createGain();
    src(brown, [['bandpass', 520, 0.5]], this.gCrowd, 0.4);
    src(white, [['highpass', 900], ['lowpass', 7000]], this.gFount);
    src(brown, [['lowpass', 220]], this.gWind);
    src(white, [['highpass', 2500], ['lowpass', 9000]], this.gRain);
    src(brown, [['bandpass', 320, 0.9]], this.gInside, 1.0);
    // slow modulation on crowd
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 0.02; lfo.connect(lg); lg.connect(this.gCrowd.gain); lfo.start();
  }
  chirp(t0, vol = 0.05) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); const f0 = 3200 + Math.random() * 2400;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * (1.2 + Math.random() * 0.5), t0 + 0.07);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g); g.connect(this.dry); o.start(t0); o.stop(t0 + 0.14);
  }
  step(inside, run) {
    if (!this.enabled) return; const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.stepBuf || (this.stepBuf = this.noiseBuffer('white', 0.2)); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = inside ? 1400 : 900; f.Q.value = 1.2;
    const g = c.createGain(); g.gain.setValueAtTime(inside ? 0.28 : 0.2, t); g.gain.exponentialRampToValueAtTime(0.0005, t + (inside ? 0.09 : 0.07));
    s.connect(f); f.connect(g); g.connect(this.dry); if (inside) { const w = c.createGain(); w.gain.value = 0.8; g.connect(w); w.connect(this.rev); }
    s.start(t, Math.random() * 0.1, 0.12);
  }
  update(dt, { inside, fountainDist, daylight, night, rain, wind = 0.3 }) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime, k = 0.25;
    const out = 1 - inside;
    this.gCrowd.gain.setTargetAtTime((0.05 + 0.10 * daylight) * out, t, k);
    this.gFount.gain.setTargetAtTime(Math.min(0.12, 2.2 / (fountainDist + 6)) * out * (1 - rain * 0.3), t, k);
    this.gWind.gain.setTargetAtTime((0.05 + wind * 0.1) * (0.4 + 0.6 * out), t, k);
    this.gRain.gain.setTargetAtTime(rain * (0.05 + 0.1 * out), t, k);
    this.gInside.gain.setTargetAtTime(inside * (0.13 + 0.12 * daylight), t, k);
    this.revGain.gain.setTargetAtTime(0.12 + inside * 0.85, t, k);
    if (t > this.nextChirp && daylight > 0.3 && rain < 0.2) {
      const n = 2 + ((Math.random() * 4) | 0); for (let i = 0; i < n; i++) this.chirp(t + i * 0.11, 0.025 * (0.4 + out) );
      this.nextChirp = t + 1.5 + Math.random() * 4;
    }
  }
}
