import type { FaceStyle } from '../types.ts'

function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return h >>> 0
}

function unit(n: number): number {
  return (n % 10000) / 10000
}

function blur(src: ImageData, radius: number): ImageData {
  const { width, height, data } = src
  const out = new ImageData(width, height)
  const r = Math.max(1, radius)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let rs = 0
      let gs = 0
      let bs = 0
      let n = 0
      for (let oy = -r; oy <= r; oy += 1) {
        const yy = Math.min(height - 1, Math.max(0, y + oy))
        for (let ox = -r; ox <= r; ox += 1) {
          const xx = Math.min(width - 1, Math.max(0, x + ox))
          const i = (yy * width + xx) * 4
          rs += data[i] ?? 0
          gs += data[i + 1] ?? 0
          bs += data[i + 2] ?? 0
          n += 1
        }
      }
      const o = (y * width + x) * 4
      out.data[o] = rs / n
      out.data[o + 1] = gs / n
      out.data[o + 2] = bs / n
      out.data[o + 3] = 255
    }
  }
  return out
}

function isSkin(r: number, g: number, b: number): boolean {
  return r > 90 && g > 40 && b > 24 && r > g && r > b && r - Math.min(g, b) > 12
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('사진을 읽지 못했습니다'))
    image.src = url
  })
}

function stylize(source: HTMLImageElement, style: FaceStyle): HTMLCanvasElement {
  const size = 320
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const scale = Math.max(size / source.width, size / source.height)
  const w = source.width * scale
  const h = source.height * scale
  ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h)
  const snap = ctx.getImageData(0, 0, size, size)
  let minX = size
  let minY = size
  let maxX = 0
  let maxY = 0
  let count = 0
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const i = (y * size + x) * 4
      if (!isSkin(snap.data[i] ?? 0, snap.data[i + 1] ?? 0, snap.data[i + 2] ?? 0)) continue
      count += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (count > 80) {
    const padX = (maxX - minX) * 0.18
    const padY = (maxY - minY) * 0.22
    const sx = Math.max(0, minX - padX)
    const sy = Math.max(0, minY - padY)
    const sw = Math.min(size - sx, maxX - minX + padX * 2)
    const sh = Math.min(size - sy, maxY - minY + padY * 2)
    const face = ctx.getImageData(sx, sy, sw, sh)
    ctx.fillStyle = '#c48b6a'
    ctx.fillRect(0, 0, size, size)
    ctx.putImageData(face, (size - sw) / 2, (size - sh) / 2 + size * 0.04)
  }
  const soft = blur(ctx.getImageData(0, 0, size, size), style === 'photo' ? 1 : 2)
  const data = soft.data
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] ?? 0
    let g = data[i + 1] ?? 0
    let b = data[i + 2] ?? 0
    if (style === 'card') {
      const levels = 5
      r = Math.round(r / 255 * levels) / levels * 255
      g = Math.round(g / 255 * levels) / levels * 255
      b = Math.round(b / 255 * levels) / levels * 255
    } else if (style === 'night') {
      r = Math.min(255, r * 1.08 + 18)
      g = g * 0.92 + 8
      b = b * 0.78
    } else {
      r = Math.min(255, (r - 128) * 1.12 + 128)
      g = Math.min(255, (g - 128) * 1.08 + 128)
      b = Math.min(255, (b - 128) * 1.05 + 128)
    }
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
  ctx.putImageData(soft, 0, 0)
  return canvas
}

function paintSynthFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  skin: string,
) {
  const n = hash(seed)
  ctx.fillStyle = skin
  ctx.fillRect(x, y, w, h)
  const eyeY = y + h * (0.38 + unit(n) * 0.04)
  const gap = w * (0.16 + unit(n >>> 3) * 0.05)
  const eyeR = w * 0.055
  ctx.fillStyle = '#f7f4ef'
  ctx.beginPath()
  ctx.ellipse(x + w / 2 - gap, eyeY, eyeR * 1.35, eyeR, 0, 0, Math.PI * 2)
  ctx.ellipse(x + w / 2 + gap, eyeY, eyeR * 1.35, eyeR, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `hsl(${20 + (n % 40)} 45% 22%)`
  ctx.beginPath()
  ctx.arc(x + w / 2 - gap, eyeY, eyeR * 0.62, 0, Math.PI * 2)
  ctx.arc(x + w / 2 + gap, eyeY, eyeR * 0.62, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a120e'
  ctx.fillRect(x + w * 0.22, eyeY - h * 0.09, w * 0.18, h * 0.018)
  ctx.fillRect(x + w * 0.6, eyeY - h * 0.09, w * 0.18, h * 0.018)
  ctx.strokeStyle = 'rgba(90, 40, 30, 0.35)'
  ctx.lineWidth = Math.max(2, w * 0.012)
  ctx.beginPath()
  ctx.moveTo(x + w * 0.5, eyeY + h * 0.08)
  ctx.lineTo(x + w * 0.46, eyeY + h * 0.2)
  ctx.stroke()
  ctx.fillStyle = '#8d3b3b'
  ctx.beginPath()
  ctx.ellipse(x + w / 2, y + h * 0.72, w * 0.12, h * 0.035, 0, 0, Math.PI)
  ctx.fill()
}

export function buildHeadTexture(options: {
  source?: string | null
  style: FaceStyle
  skin: string
  hair: string
  seed: string
}): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve('')
  ctx.fillStyle = options.skin
  ctx.fillRect(0, 0, 1024, 1024)
  const faceX = 1024 * 0.145
  const faceY = 1024 * 0.3
  const faceW = 1024 * 0.21
  const faceH = 1024 * 0.34
  ctx.fillStyle = options.hair
  ctx.fillRect(0, 0, 1024, 1024 * 0.34)
  ctx.fillStyle = options.skin
  ctx.fillRect(1024 * 0.08, 1024 * 0.28, 1024 * 0.34, 1024 * 0.42)

  const finish = (portrait: HTMLCanvasElement | null) => {
    if (portrait) ctx.drawImage(portrait, faceX, faceY, faceW, faceH)
    else paintSynthFace(ctx, faceX, faceY, faceW, faceH, options.seed, options.skin)
    ctx.fillStyle = options.hair
    ctx.fillRect(faceX - 8, faceY - 18, faceW + 16, 28)
    const grad = ctx.createLinearGradient(0, 760, 0, 1024)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(40, 18, 12, 0.45)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 760, 1024, 264)
    return canvas.toDataURL('image/jpeg', 0.82)
  }

  if (!options.source) return Promise.resolve(finish(null))
  return loadImage(options.source)
    .then((image) => finish(stylize(image, options.style)))
    .catch(() => finish(null))
}

export function skinFromSeed(seed: string): { skin: string; hair: string } {
  const n = hash(seed)
  const skins = ['#8d5a3c', '#a56b45', '#c48a62', '#6e4332', '#d7a888', '#9a6248']
  const hairs = ['#1c140f', '#3a2418', '#111111', '#5a341c', '#2a211c', '#6b4a2a']
  return {
    skin: skins[n % skins.length] ?? '#a56b45',
    hair: hairs[(n >>> 4) % hairs.length] ?? '#1c140f',
  }
}
