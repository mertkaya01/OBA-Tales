/**
 * OBA SESİ — kodla üretilen müzik ve akın efektleri (Web Audio). Hiçbir ses dosyası yok, lisans derdi yok.
 *
 *   müzik    Hicaz makamında (Re) aksak 9/8 davul (dum · tek), kopuz teli (Karplus-Strong) ve alçak bir dem
 *   efekt    nara, ayaz dalgası, kalkan çınlaması, ok vızıltısı, ocak çanı, büyük patlama, zafer arpeji
 *
 * Ses hem hoparlöre hem de kayıt akışına (`stream`) gider: stüdyo videoyu sesiyle kaydeder. Tarayıcılar sesi ancak bir
 * tıklamadan sonra başlatır; ObaSound bu yüzden hep bir düğmeyle açılır.
 */
import { RAID_DAY_LENGTH } from "../world3d/living/raidDay";
import { cuesBetween, raidCues, type RaidCueId } from "./raidCues";

/** Hicaz dizisi, Re'den (D3): Re · Mi♭ · Fa♯ · Sol · La · Si♭ · Do · Re · Mi♭ · Fa♯. */
const HICAZ = [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 261.63, 293.66, 311.13, 369.99];
/** Sekizlik süre (saniye): 9/8'lik bir ölçü 1,8 sn. */
const EIGHTH = 0.2;
const BAR = 9;
/** Davul: 2+2+2+3 aksak (D = dum, T = tek, t = hafif tek). */
const DRUM: readonly [number, "D" | "T" | "t"][] = [[0, "D"], [2, "T"], [4, "D"], [6, "T"], [8, "t"]];
/** Kopuz ezgisi: dört ölçü (36 sekizlik), [sekizlik, dizideki derece, uzunluk çarpanı]. */
const MELODY: readonly [number, number, number][] = [
  [0, 4, 1], [2, 3, 1], [4, 2, 1], [6, 1, 0.6], [7, 2, 0.6], [8, 0, 1.4],
  [9, 4, 1], [11, 5, 1], [13, 4, 1], [15, 3, 0.6], [16, 2, 0.6], [17, 1, 1.2],
  [18, 7, 1], [20, 6, 1], [22, 5, 1], [24, 4, 0.6], [25, 5, 0.6], [26, 4, 1.4],
  [27, 3, 1], [29, 2, 1], [31, 1, 1], [33, 2, 0.6], [34, 1, 0.6], [35, 0, 1.6],
];
const LOOKAHEAD = 0.3;
/** Müziğin seviyesi: efektler (ok, kalkan, ocak) üstünde duyulsun. */
const MUSIC_LEVEL = 0.4;

export class ObaSound {
  readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly music: GainNode;
  private readonly sfx: GainNode;
  private readonly recorder: MediaStreamAudioDestinationNode;
  private readonly noise: AudioBuffer;
  private readonly plucks = new Map<number, AudioBuffer>();
  private drone: { stop: (at: number) => void } | null = null;
  private timer: number | null = null;
  /** Bir sonraki sekizliğin zamanı ve sırası. */
  private nextNote = 0;
  private step = 0;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.music = this.gain(MUSIC_LEVEL, this.master);
    this.sfx = this.gain(0.9, this.master);
    // Hafif sıkıştırma: patlama ve nara birlikte gelince ses patlamasın.
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    this.master.connect(limiter);
    limiter.connect(this.ctx.destination);
    this.recorder = this.ctx.createMediaStreamDestination();
    limiter.connect(this.recorder);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Kayıt için ses akışı (MediaRecorder'a video ile birlikte verilir). */
  get stream(): MediaStream {
    return this.recorder.stream;
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  /** Müziği başlatır (davul, kopuz, dem); `fadeIn` saniyede yükselir. */
  startMusic(fadeIn = 1): void {
    if (this.timer !== null) return;
    const t = this.now + 0.05;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setValueAtTime(0.0001, t);
    this.music.gain.exponentialRampToValueAtTime(MUSIC_LEVEL, t + fadeIn);
    this.nextNote = t;
    this.step = 0;
    this.drone = this.startDrone(t);
    const tick = () => {
      while (this.nextNote < this.now + LOOKAHEAD) {
        this.scheduleStep(this.step, this.nextNote);
        this.step = (this.step + 1) % (BAR * 4);
        this.nextNote += EIGHTH;
      }
    };
    tick();
    this.timer = window.setInterval(tick, 80);
  }

  /** Müziği `fade` saniyede söndürür. */
  stopMusic(fade = 1.2): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const t = this.now;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setValueAtTime(Math.max(0.0001, this.music.gain.value), t);
    this.music.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    this.drone?.stop(t + fade);
    this.drone = null;
  }

  /** Her şeyi kapatır. */
  async close(): Promise<void> {
    this.stopMusic(0.2);
    await this.ctx.close();
  }

  /** Bir akın sesini `when` anında (ctx zamanı; verilmezse hemen) çalar. */
  play(cue: RaidCueId, when = this.now): void {
    const t = Math.max(this.now, when);
    switch (cue) {
      case "nara":
        return this.nara(t);
      case "ayaz":
        return this.iceWave(t);
      case "kalkan":
        return this.clang(t);
      case "ok":
        for (let k = 0; k < 4; k++) this.whoosh(t + k * 0.08 + Math.random() * 0.03);
        return;
      case "ocak":
        return this.chime(t);
      case "patlama":
        return this.boom(t);
      case "zafer":
        return this.victory(t);
    }
  }

  // ── Müzik ──────────────────────────────────────────────────────

  private scheduleStep(step: number, t: number): void {
    const inBar = step % BAR;
    for (const [at, kind] of DRUM) {
      if (at !== inBar) continue;
      if (kind === "D") this.dum(t);
      else this.tek(t, kind === "T" ? 1 : 0.55);
    }
    for (const [at, degree, length] of MELODY) if (at === step) this.pluck(HICAZ[degree], t, 0.32, length * 1.1);
  }

  private startDrone(t: number) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    const out = this.gain(0.0001, this.music);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.07, t + 2);
    filter.connect(out);
    const oscs = [73.42, 73.9, 110].map((f) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.connect(filter);
      osc.start(t);
      return osc;
    });
    return {
      stop: (at: number) => {
        out.gain.cancelScheduledValues(at - 0.01);
        oscs.forEach((o) => o.stop(at + 0.1));
      },
    };
  }

  private dum(t: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(46, t + 0.28);
    const env = this.envelope(t, 0.9, 0.005, 0.45, this.music);
    osc.connect(env);
    osc.start(t);
    osc.stop(t + 0.5);
    this.noiseHit(t, "highpass", 2500, 0.02, 0.25, this.music);
  }

  private tek(t: number, level: number): void {
    this.noiseHit(t, "bandpass", 1900, 0.11, 0.5 * level, this.music, 1.3);
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.08);
    const env = this.envelope(t, 0.25 * level, 0.002, 0.1, this.music);
    osc.connect(env);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /** Kopuz teli: Karplus-Strong ile önceden hesaplanmış tel sesi. */
  private pluck(freq: number, t: number, level: number, length = 1, out: AudioNode = this.music): void {
    let buffer = this.plucks.get(freq);
    if (!buffer) {
      const rate = this.ctx.sampleRate;
      buffer = this.ctx.createBuffer(1, Math.floor(rate * 1.6), rate);
      const data = buffer.getChannelData(0);
      const period = Math.round(rate / freq);
      for (let i = 0; i < period; i++) data[i] = Math.random() * 2 - 1;
      // Tel: her örnek, bir periyot önceki iki örneğin ortalaması (biraz sönerek).
      for (let i = period; i < data.length; i++) data[i] = 0.497 * (data[i - period] + data[Math.max(0, i - period - 1)]);
      this.plucks.set(freq, buffer);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const tone = this.ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2600;
    const env = this.envelope(t, level, 0.003, 0.9 * length, out);
    source.connect(tone);
    tone.connect(env);
    source.start(t);
    source.stop(t + 1.6);
  }

  // ── Efektler ───────────────────────────────────────────────────

  /** "Hey!" — birçok sesin bir ağızdan narası. */
  private nara(t: number): void {
    const formants = [620, 1750].map((f) => {
      const band = this.ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = f;
      band.Q.value = 5;
      return band;
    });
    const out = this.envelope(t, 0.5, 0.04, 0.55, this.sfx, 0.18);
    formants.forEach((b) => b.connect(out));
    for (let v = 0; v < 7; v++) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      const base = 150 + Math.random() * 110;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.linearRampToValueAtTime(base * 1.12, t + 0.2);
      osc.frequency.linearRampToValueAtTime(base * 0.95, t + 0.6);
      formants.forEach((b) => osc.connect(b));
      osc.start(t + Math.random() * 0.04);
      osc.stop(t + 0.85);
    }
    this.noiseHit(t, "bandpass", 1200, 0.4, 0.12, this.sfx, 0.8);
  }

  private iceWave(t: number): void {
    this.noiseHit(t, "lowpass", 520, 0.9, 1.5, this.sfx);
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(3200, t + 0.6);
    osc.connect(this.envelope(t, 0.22, 0.05, 0.6, this.sfx));
    osc.start(t);
    osc.stop(t + 0.8);
  }

  private clang(t: number): void {
    for (const [f, decay, level] of [[517, 0.7, 0.34], [1180, 0.5, 0.22], [1960, 0.35, 0.15], [2870, 0.22, 0.1]] as const) {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = f * (0.98 + Math.random() * 0.04);
      osc.connect(this.envelope(t, level, 0.002, decay, this.sfx));
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
    this.noiseHit(t, "bandpass", 3200, 0.05, 0.5, this.sfx, 1.5);
  }

  private whoosh(t: number): void {
    const source = this.noiseSource(t, 0.45);
    const band = this.ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(2600, t);
    band.frequency.exponentialRampToValueAtTime(600, t + 0.4);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1.1, t + 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    source.connect(band);
    band.connect(env);
    env.connect(this.sfx);
  }

  private chime(t: number): void {
    for (const [f, level] of [[587.33, 0.26], [880, 0.17], [1174.66, 0.1]] as const) {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = f;
      osc.connect(this.envelope(t, level, 0.01, 1.3, this.sfx));
      osc.start(t);
      osc.stop(t + 1.4);
    }
  }

  private boom(t: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.9);
    osc.connect(this.envelope(t, 0.9, 0.005, 1.1, this.sfx));
    osc.start(t);
    osc.stop(t + 1.2);
    this.noiseHit(t, "lowpass", 900, 1.4, 0.45, this.sfx);
    this.noiseHit(t + 0.02, "highpass", 5000, 1.2, 0.18, this.sfx);
  }

  private victory(t: number): void {
    [0, 2, 4, 7, 9].forEach((degree, k) => this.pluck(HICAZ[degree] * 2, t + k * 0.13, 0.6, 1.4, this.sfx));
    this.chime(t + 0.65);
  }

  // ── Yardımcılar ────────────────────────────────────────────────

  private gain(value: number, to: AudioNode): GainNode {
    const node = this.ctx.createGain();
    node.gain.value = value;
    node.connect(to);
    return node;
  }

  /** Hızlı yükselip üstel sönen zarf; `hold` kadar tepede kalır. */
  private envelope(t: number, level: number, attack: number, decay: number, to: AudioNode, hold = 0): GainNode {
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), t + attack);
    if (hold > 0) env.gain.setValueAtTime(Math.max(0.0002, level), t + attack + hold);
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
    env.connect(to);
    return env;
  }

  private noiseSource(t: number, length: number): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.start(t, Math.random() * 1.2);
    source.stop(t + length);
    return source;
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, decay: number, level: number, to: AudioNode, q = 0.8): void {
    const source = this.noiseSource(t, decay + 0.05);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    source.connect(filter);
    filter.connect(this.envelope(t, level, 0.003, decay, to));
  }
}

/**
 * Akın Günü'nün saatini izleyip sesleri zamanında çalar ("Akını izle"). `dayAt` o anki Akın Günü saniyesini verir
 * (izleme yoksa null). Tur başa sarınca da devam eder; saat sıçrarsa (yeniden başlatma) kaçan sesleri atlar.
 * Döndürdüğü fonksiyon izlemeyi durdurur.
 */
export function followRaid(sound: ObaSound, dayAt: () => number | null): () => void {
  const cues = raidCues();
  let upTo: number | null = null;
  const tick = () => {
    const t = dayAt();
    if (t === null) {
      upTo = null;
      return;
    }
    const wrapped = upTo !== null && t < upTo && upTo - t > RAID_DAY_LENGTH - 2;
    if (upTo === null || (Math.abs(t - upTo) > 1.5 && !wrapped)) upTo = t;
    const end = (t + LOOKAHEAD) % RAID_DAY_LENGTH;
    for (const cue of cuesBetween(cues, upTo, end)) {
      let delay = cue.at - t;
      if (delay < -1) delay += RAID_DAY_LENGTH;
      sound.play(cue.id, sound.now + Math.max(0, delay));
    }
    upTo = end;
  };
  const timer = window.setInterval(tick, 100);
  return () => window.clearInterval(timer);
}

/** Akın reeli için: videonun `start` saniyesinden `length` saniye boyunca sesleri baştan zamanlar (t0: ctx zamanı). */
export function scheduleRaidReel(sound: ObaSound, t0: number, start: number, length: number): void {
  for (const cue of raidCues()) if (cue.at >= start && cue.at < start + length) sound.play(cue.id, t0 + (cue.at - start));
}

/** Bu tarayıcıda Web Audio var mı? */
export const soundSupported = () => typeof window !== "undefined" && typeof window.AudioContext !== "undefined";
