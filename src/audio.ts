// All sounds are synthesised with Web Audio (no files). The context starts on
// the first tap/key (iOS and Safari require a gesture).
const MUTE_KEY = 'ojek-rush.mute'

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  muted = readMuted()

  constructor() {
    const unlock = () => this.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
  }

  private unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.7
      this.master.connect(this.ctx.destination)
    }
    void this.ctx.resume()
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0')
    } catch {
      /* ignore */
    }
    return this.muted
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, at = 0, endFreq = freq): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime + at
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  /** Two-tone "tin tin" horn. */
  honk(): void {
    this.tone(420, 0.18, 'square', 0.12)
    this.tone(520, 0.18, 'square', 0.1)
    this.tone(420, 0.22, 'square', 0.12, 0.2)
    this.tone(520, 0.22, 'square', 0.1, 0.2)
  }
  crash(): void {
    this.tone(160, 0.35, 'sawtooth', 0.25, 0, 40)
    this.tone(90, 0.3, 'square', 0.2, 0, 30)
  }
  plus(): void {
    this.tone(660, 0.09, 'triangle', 0.2)
    this.tone(990, 0.14, 'triangle', 0.2, 0.08)
  }
  boost(): void {
    this.tone(200, 0.5, 'sawtooth', 0.15, 0, 900)
  }
  gameOver(): void {
    this.tone(440, 0.3, 'triangle', 0.25)
    this.tone(330, 0.3, 'triangle', 0.25, 0.3)
    this.tone(220, 0.7, 'triangle', 0.25, 0.6)
  }
}
