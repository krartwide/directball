import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from 'mediabunny'
import type { BroadcastEngine } from '../engine/broadcast.ts'

export type ExportOptions = {
  engine: BroadcastEngine
  gl: HTMLCanvasElement
  overlay: HTMLCanvasElement
  ranges: Array<[number, number]>
  width: number
  height: number
  fps: number
  bitrate: number
  onProgress: (ratio: number) => void
  signal: AbortSignal
}

export async function exportMp4(options: ExportOptions): Promise<Blob> {
  const { engine, gl, overlay, fps, width, height, bitrate, signal } = options
  const ranges = options.ranges.filter(([a, b]) => b - a > 0.05)
  if (ranges.length === 0) throw new Error('저장할 장면이 없습니다')
  const seconds = ranges.reduce((sum, [a, b]) => sum + (b - a), 0)
  const quality = new Quality({ bitrate, bitrateMode: 'variable' })
  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height, quality, frameRate: fps })
  if (!videoCodec) throw new Error('이 브라우저는 MP4 인코딩을 지원하지 않습니다. Chrome 또는 Edge에서 다시 시도하세요.')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('합성 캔버스를 만들지 못했습니다')

  const target = new BufferTarget()
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  })
  const video = new CanvasSource(canvas, { codec: videoCodec, quality, keyFrameInterval: 2 })
  output.addVideoTrack(video, { frameRate: fps })

  let audio: AudioBufferSource | null = null
  const audioCodec = await getFirstEncodableAudioCodec(['aac', 'opus'], {
    numberOfChannels: 1,
    sampleRate: 48000,
    quality: new Quality({ bitrate: 64000 }),
  })
  if (audioCodec) {
    audio = new AudioBufferSource({ codec: audioCodec, quality: new Quality({ bitrate: 64000 }) })
    output.addAudioTrack(audio)
  }

  const previous = engine.playing
  engine.pause()
  engine.exporting = true
  engine.resize(width, height, 1)
  await output.start()
  try {
    if (audio) {
      const audioCtx = new AudioContext()
      const buffer = audioCtx.createBuffer(1, Math.ceil(seconds * 48000) + 4800, 48000)
      const data = buffer.getChannelData(0)
      let hold = 0
      for (let i = 0; i < data.length; i += 1) {
        hold = hold * 0.96 + (Math.random() * 2 - 1) * 0.04
        data[i] = hold * 0.35
      }
      await audio.add(buffer)
      await audioCtx.close()
    }
    let frameIndex = 0
    const total = Math.max(1, Math.round(seconds * fps))
    for (const [start, end] of ranges) {
      const count = Math.max(1, Math.round((end - start) * fps))
      for (let i = 0; i < count; i += 1) {
        if (signal.aborted) throw new Error('저장을 취소했습니다')
        const t = start + (i / count) * (end - start)
        engine.renderAt(t)
        ctx.drawImage(gl, 0, 0, width, height)
        ctx.drawImage(overlay, 0, 0, width, height)
        await video.add(frameIndex / fps, 1 / fps)
        frameIndex += 1
        if (frameIndex % 4 === 0) options.onProgress(frameIndex / total)
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
    await output.finalize()
    const buffer = target.buffer
    if (!buffer) throw new Error('영상 버퍼가 비었습니다')
    return new Blob([buffer], { type: 'video/mp4' })
  } finally {
    engine.exporting = false
    engine.resize()
    engine.renderAt(engine.time)
    if (previous) engine.play()
  }
}
