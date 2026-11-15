import type { Hud } from './api.ts'

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function drawOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, hud: Hud) {
  ctx.clearRect(0, 0, width, height)
  const s = Math.min(width / 1280, height / 720)
  ctx.save()
  ctx.scale(s, s)
  const w = width / s
  const h = height / s
  drawBug(ctx, hud)
  if (hud.lower) drawLower(ctx, w, hud)
  if (hud.pitch) drawPitch(ctx, w, hud)
  if (hud.zone) drawZone(ctx, h, hud)
  if (hud.banner) drawBanner(ctx, w, h, hud)
  if (hud.replay) drawReplay(ctx, w)
  if (hud.reviewTitle) drawReview(ctx, w, hud.reviewTitle)
  if (hud.callText) drawCall(ctx, w, h, hud.callText)
  ctx.restore()
}

function drawBug(ctx: CanvasRenderingContext2D, hud: Hud) {
  const x = 28
  const y = 24
  ctx.font = '700 18px Pretendard, sans-serif'
  round(ctx, x, y, 430, 78, 8)
  ctx.fillStyle = 'rgba(6, 14, 10, 0.82)'
  ctx.fill()
  ctx.fillStyle = hud.awayColor
  ctx.fillRect(x, y, 8, 78)
  ctx.fillStyle = hud.homeColor
  ctx.fillRect(x + 422, y, 8, 78)
  ctx.fillStyle = '#d7e6dc'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(hud.away, x + 20, y + 28)
  ctx.fillText(hud.home, x + 250, y + 28)
  ctx.font = '700 32px "Chivo Mono", Pretendard, sans-serif'
  ctx.fillStyle = '#f7f4ea'
  ctx.fillText(String(hud.awayScore), x + 150, y + 30)
  ctx.fillText(String(hud.homeScore), x + 380, y + 30)
  ctx.font = '700 16px Pretendard, sans-serif'
  ctx.fillStyle = '#f0b429'
  const arrow = hud.half === 'top' ? '▲' : '▼'
  ctx.fillText(`${arrow} ${hud.inning}회`, x + 20, y + 58)
  ctx.fillStyle = '#9eb5a6'
  ctx.fillText(`${hud.balls}-${hud.strikes}`, x + 118, y + 58)
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath()
    ctx.fillStyle = i < hud.outs ? '#f0b429' : 'rgba(255,255,255,0.18)'
    ctx.arc(x + 190 + i * 16, y + 58, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  const bx = x + 292
  const by = y + 58
  const diamond = [
    [bx, by - 10],
    [bx + 10, by],
    [bx, by + 10],
    [bx - 10, by],
  ]
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(diamond[0]![0], diamond[0]![1])
  diamond.forEach((p) => ctx.lineTo(p[0], p[1]))
  ctx.closePath()
  ctx.stroke()
  const spots = [diamond[1]!, diamond[0]!, diamond[3]!]
  hud.bases.forEach((on, i) => {
    if (!on) return
    const p = spots[i] ?? diamond[0]!
    ctx.fillStyle = '#f0b429'
    ctx.fillRect(p[0] - 3.5, p[1] - 3.5, 7, 7)
  })
}

function drawLower(ctx: CanvasRenderingContext2D, w: number, hud: Hud) {
  const lower = hud.lower
  if (!lower) return
  const x = 28
  const y = 560
  round(ctx, x, y, Math.min(520, w - 56), 92, 8)
  ctx.fillStyle = 'rgba(6, 14, 10, 0.84)'
  ctx.fill()
  ctx.fillStyle = '#f0b429'
  ctx.fillRect(x, y, 6, 92)
  ctx.textAlign = 'left'
  ctx.font = '700 14px Pretendard, sans-serif'
  ctx.fillStyle = '#f0b429'
  ctx.fillText(lower.kicker, x + 22, y + 24)
  ctx.font = '700 30px Pretendard, sans-serif'
  ctx.fillStyle = '#f7f4ea'
  ctx.fillText(lower.title, x + 22, y + 54)
  ctx.font = '600 16px Pretendard, sans-serif'
  ctx.fillStyle = '#b7cbbd'
  ctx.fillText(lower.detail, x + 22, y + 76)
}

function drawPitch(ctx: CanvasRenderingContext2D, w: number, hud: Hud) {
  const pitch = hud.pitch
  if (!pitch) return
  const x = w - 250
  const y = 24
  round(ctx, x, y, 214, 92, 8)
  ctx.fillStyle = 'rgba(6, 14, 10, 0.8)'
  ctx.fill()
  ctx.textAlign = 'left'
  ctx.font = '700 16px Pretendard, sans-serif'
  ctx.fillStyle = '#3ddecb'
  ctx.fillText(pitch.name, x + 16, y + 24)
  ctx.font = '700 36px "Chivo Mono", ui-monospace, monospace'
  ctx.fillStyle = '#f7f4ea'
  ctx.fillText(String(Math.round(pitch.velo)), x + 16, y + 62)
  ctx.font = '700 14px Pretendard, sans-serif'
  ctx.fillStyle = '#b7cbbd'
  ctx.fillText('km/h', x + 92, y + 58)
  ctx.fillText(`${Math.round(pitch.rpm)} rpm`, x + 16, y + 80)
}

function drawZone(ctx: CanvasRenderingContext2D, h: number, hud: Hud) {
  const zone = hud.zone
  if (!zone) return
  const x = 28
  const y = h - 250
  round(ctx, x, y, 150, 200, 8)
  ctx.fillStyle = 'rgba(6, 14, 10, 0.78)'
  ctx.fill()
  ctx.font = '700 12px Pretendard, sans-serif'
  ctx.fillStyle = '#3ddecb'
  ctx.textAlign = 'left'
  ctx.fillText('ABS', x + 12, y + 18)
  const zx = x + 75
  const zy = y + 108
  const scale = 150
  const half = zone.half * scale
  const top = (zone.top - 0.7) * scale
  const bot = (zone.bot - 0.7) * scale
  ctx.strokeStyle = 'rgba(61,222,203,0.9)'
  ctx.lineWidth = 2
  ctx.strokeRect(zx - half, zy - top, half * 2, top - bot)
  ctx.fillStyle = zone.call === '스트라이크' ? '#f0b429' : '#d7e6dc'
  ctx.beginPath()
  ctx.arc(zx + zone.x * scale, zy - (zone.y - 0.7) * scale, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = '700 14px Pretendard, sans-serif'
  ctx.fillStyle = '#f7f4ea'
  ctx.textAlign = 'center'
  ctx.fillText(zone.call, zx, y + 186)
}

function drawBanner(ctx: CanvasRenderingContext2D, w: number, h: number, hud: Hud) {
  ctx.textAlign = 'center'
  ctx.font = '700 64px "Black Han Sans", sans-serif'
  ctx.fillStyle = 'rgba(6,14,10,0.55)'
  const text = hud.banner ?? ''
  const width = Math.min(w - 80, ctx.measureText(text).width + 80)
  round(ctx, (w - width) / 2, h * 0.38, width, 96, 10)
  ctx.fill()
  ctx.fillStyle = '#f7f4ea'
  ctx.fillText(text, w / 2, h * 0.38 + 62)
  if (hud.sub) {
    ctx.font = '700 20px Pretendard, sans-serif'
    ctx.fillStyle = '#f0b429'
    ctx.fillText(hud.sub, w / 2, h * 0.38 + 118)
  }
}

function drawReplay(ctx: CanvasRenderingContext2D, w: number) {
  ctx.font = '700 18px "Chivo Mono", sans-serif'
  ctx.fillStyle = '#f0b429'
  ctx.textAlign = 'right'
  ctx.fillText('REPLAY', w - 36, 150)
}

function drawReview(ctx: CanvasRenderingContext2D, w: number, title: string) {
  ctx.textAlign = 'center'
  ctx.font = '700 22px Pretendard, sans-serif'
  round(ctx, w / 2 - 160, 150, 320, 42, 6)
  ctx.fillStyle = 'rgba(20, 40, 48, 0.9)'
  ctx.fill()
  ctx.strokeStyle = '#3ddecb'
  ctx.stroke()
  ctx.fillStyle = '#d9fff8'
  ctx.fillText(title, w / 2, 178)
}

function drawCall(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  ctx.textAlign = 'center'
  ctx.font = '700 28px Pretendard, sans-serif'
  ctx.fillStyle = '#f7f4ea'
  ctx.fillText(text, w / 2, h - 36)
}
