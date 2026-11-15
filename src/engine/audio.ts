import type { SfxId } from './api.ts'

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1
    last = last * 0.94 + white * 0.06
    data[i] = last
  }
  return buffer
}

export class ParkAudio {
  private ctx: AudioContext | null = null
  private crowd: GainNode | null = null
  private master: GainNode | null = null
  muted = false

  unlock() {
    if (this.ctx) return
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = 0.7
    master.connect(ctx.destination)
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx, 2.5)
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    const crowd = ctx.createGain()
    crowd.gain.value = 0.12
    source.connect(filter)
    filter.connect(crowd)
    crowd.connect(master)
    source.start()
    this.ctx = ctx
    this.master = master
    this.crowd = crowd
  }

  setEnergy(energy: number) {
    if (!this.crowd || !this.ctx) return
    const now = this.ctx.currentTime
    this.crowd.gain.cancelScheduledValues(now)
    this.crowd.gain.linearRampToValueAtTime(this.muted ? 0 : 0.05 + energy * 0.28, now + 0.12)
  }

  play(id: SfxId) {
    if (this.muted || !this.ctx || !this.master) return
    const ctx = this.ctx
    const now = ctx.currentTime
    if (id === 'crack' || id === 'pop') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(id === 'crack' ? 180 : 240, now)
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.12)
      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(now)
      osc.stop(now + 0.2)
      return
    }
    if (id === 'organ') {
      ;[262, 330, 392, 523].forEach((freq, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.05, now + 0.05 + index * 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4)
        osc.connect(gain)
        gain.connect(this.master!)
        osc.start(now)
        osc.stop(now + 1.5)
      })
      return
    }
    if (id === 'cheer') this.setEnergy(1)
  }

  speak(text: string) {
    if (this.muted || !text || !window.speechSynthesis) return
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ko-KR'
    utter.rate = 1.04
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }

  dispose() {
    void this.ctx?.close()
    this.ctx = null
  }
}
