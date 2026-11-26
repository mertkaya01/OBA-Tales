/**
 * KUTADA'NIN SESLERİ — adada olup biteni duyurur (Web Audio, kodla üretilir; ses dosyası yok).
 *
 *   sürekli  ocak (uğultu ve çıtırtı), rüzgâr, gece cırcır böcekleri
 *   olay     balta "tok"u, kuş cıvıltısı, yayın tıngırtısı, okun saplanması
 *
 * Seviye ve sağ-sol dengesi sahneden gelir (KutadaSoundDirector): ses, kameranın baktığı yere yakınsa duyulur,
 * ekranın solundaysa soldan gelir. Tarayıcılar sesi ancak bir tıklamadan sonra başlatır: hep bir düğmeyle açılır.
 */

export interface SoundBeds {
  /** Ocak (0–1) ve ekrandaki yeri (−1 sol … 1 sağ). */
  fire: number;
  firePan: number;
  wind: number;
  crickets: number;
}

export function soundSupported(): boolean {
  return typeof window !== "undefined" && typeof window.AudioContext === "function";
}

export class KutadaSound {
  readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly noise: AudioBuffer;
  private readonly fireGain: GainNode;
  private readonly firePan: StereoPannerNode;
  private readonly windGain: GainNode;
  private readonly cricketGain: GainNode;
  private readonly timers: number[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private closed = false;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.6);
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 5;
    this.master.connect(limiter);
    limiter.connect(this.ctx.destination);

    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Ocak: alçak uğultu + rastgele çıtırtılar, ikisi de aynı seviye ve sağ-sol düğümünden.
    this.firePan = this.ctx.createStereoPanner();
    this.firePan.connect(this.master);
    this.fireGain = this.gainNode(0, this.firePan);
    const rumble = this.loopNoise();
    const rumbleFilter = this.filter("lowpass", 260, 0.7);
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(this.gainNode(0.5, this.fireGain));
    this.every(70, () => {
      if (Math.random() < 0.38) this.crackle();
    });

    // Rüzgâr: bant geçiren gürültü, frekansı yavaşça gezinir.
    this.windGain = this.gainNode(0, this.master);
    const wind = this.loopNoise();
    const windFilter = this.filter("bandpass", 420, 0.6);
    wind.connect(windFilter);
    windFilter.connect(this.windGain);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = this.gainNode(180, windFilter.frequency);
    lfo.connect(lfoDepth);
    lfo.start();
    this.sources.push(lfo);

    // Cırcır böcekleri: tiz bir ton, üçlü vuruşlarla açılıp kapanır.
    this.cricketGain = this.gainNode(0, this.master);
    const tone = this.ctx.createOscillator();
    tone.frequency.value = 4400;
    const chirpGate = this.gainNode(0, this.cricketGain);
    tone.connect(chirpGate);
    tone.start();
    this.sources.push(tone);
    this.every(620, () => {
      const t = this.ctx.currentTime + 0.02;
      for (let k = 0; k < 3; k++) {
        const s = t + k * 0.055 + Math.random() * 0.01;
        chirpGate.gain.setValueAtTime(0, s);
        chirpGate.gain.linearRampToValueAtTime(0.05, s + 0.012);
        chirpGate.gain.linearRampToValueAtTime(0, s + 0.04);
      }
    });
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  /** Sesi yavaşça kısıp kapatır. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.timers.forEach((t) => window.clearInterval(t));
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    await new Promise((r) => window.setTimeout(r, 450));
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // zaten durmuş
      }
    });
    await this.ctx.close();
  }

  /** Sürekli seslerin seviyeleri (her karede çağrılabilir; geçiş yumuşaktır). */
  setBeds(beds: SoundBeds): void {
    const t = this.ctx.currentTime;
    this.fireGain.gain.setTargetAtTime(beds.fire * 0.55, t, 0.25);
    this.firePan.pan.setTargetAtTime(Math.max(-1, Math.min(1, beds.firePan)), t, 0.25);
    this.windGain.gain.setTargetAtTime(beds.wind * 0.18, t, 0.8);
    this.cricketGain.gain.setTargetAtTime(beds.crickets, t, 0.8);
  }

  /** Balta gövdeye iner: kuru, tok bir vuruş. */
  axe(level: number, pan: number): void {
    if (level < 0.01) return;
    const t = this.ctx.currentTime + 0.005;
    const out = this.voice(level, pan);
    const thump = this.ctx.createOscillator();
    thump.frequency.setValueAtTime(170, t);
    thump.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    thump.connect(this.env(t, 0.9, 0.002, 0.14, out));
    thump.start(t);
    thump.stop(t + 0.2);
    const crack = this.burst(t, 0.06);
    const band = this.filter("bandpass", 900 + Math.random() * 300, 1.4);
    crack.connect(band);
    band.connect(this.env(t, 0.7, 0.001, 0.07, out));
  }

  /** Kuş cıvıltısı: iki-dört kısa, kayan nota. */
  chirp(level: number, pan: number): void {
    if (level < 0.01) return;
    const out = this.voice(level * 0.35, pan);
    const notes = 2 + Math.floor(Math.random() * 3);
    let t = this.ctx.currentTime + 0.01;
    const base = 2600 + Math.random() * 1400;
    for (let k = 0; k < notes; k++) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      const f = base * (0.9 + Math.random() * 0.3);
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * (1.2 + Math.random() * 0.4), t + 0.07);
      osc.connect(this.env(t, 0.6, 0.005, 0.08, out));
      osc.start(t);
      osc.stop(t + 0.1);
      t += 0.09 + Math.random() * 0.05;
    }
  }

  /** Yay bırakılır: kirişin tıngırtısı ve okun vızıltısı. */
  bow(level: number, pan: number): void {
    if (level < 0.01) return;
    const t = this.ctx.currentTime + 0.005;
    const out = this.voice(level, pan);
    const string = this.ctx.createOscillator();
    string.type = "triangle";
    string.frequency.setValueAtTime(210, t);
    string.frequency.exponentialRampToValueAtTime(180, t + 0.25);
    string.connect(this.env(t, 0.5, 0.002, 0.25, out));
    string.start(t);
    string.stop(t + 0.3);
    const whoosh = this.burst(t + 0.02, 0.3);
    const band = this.filter("bandpass", 1800, 2);
    band.frequency.setValueAtTime(2400, t);
    band.frequency.exponentialRampToValueAtTime(900, t + 0.3);
    whoosh.connect(band);
    band.connect(this.env(t + 0.02, 0.35, 0.03, 0.25, out));
  }

  /** Ok saplanır (toprağa ya da ava): boğuk bir vuruş. */
  thud(level: number, pan: number): void {
    if (level < 0.01) return;
    const t = this.ctx.currentTime + 0.005;
    const out = this.voice(level, pan);
    const hit = this.burst(t, 0.08);
    const low = this.filter("lowpass", 500, 0.8);
    hit.connect(low);
    low.connect(this.env(t, 0.9, 0.001, 0.09, out));
  }

  // ── yardımcılar ──
  private gainNode(value: number, to: AudioNode | AudioParam): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(to as AudioNode);
    return g;
  }

  private filter(type: BiquadFilterType, frequency: number, q: number): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
  }

  private loopNoise(): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random();
    src.start(0, Math.random() * 1.5);
    this.sources.push(src);
    return src;
  }

  private burst(t: number, length: number): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 1.5, length + 0.05);
    return src;
  }

  private env(t: number, level: number, attack: number, decay: number, out: AudioNode): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return g;
  }

  /** Tek seferlik bir ses için seviye ve sağ-sol düğümü (kısa sürede kendiliğinden atılır). */
  private voice(level: number, pan: number): AudioNode {
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(this.master);
    return this.gainNode(Math.min(1, level), panner);
  }

  private crackle(): void {
    const t = this.ctx.currentTime + Math.random() * 0.05;
    const tick = this.burst(t, 0.03);
    const high = this.filter("highpass", 1800 + Math.random() * 2500, 0.8);
    tick.connect(high);
    high.connect(this.env(t, 0.25 + Math.random() * 0.6, 0.001, 0.02 + Math.random() * 0.04, this.fireGain));
  }

  private every(ms: number, fn: () => void): void {
    this.timers.push(window.setInterval(fn, ms));
  }
}
