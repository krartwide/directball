import type { Position } from '../types.ts'

export const FT = 0.3048
export const BASE_M = 90 * FT
export const MOUND_M = 60.5 * FT
export const PLATE_W = (17 / 12) * FT
export const BALL_R = 0.0366

const DIAG = BASE_M / Math.SQRT2

export const BASES = {
  home: { x: 0, z: 0 },
  first: { x: DIAG, z: DIAG },
  second: { x: 0, z: BASE_M * Math.SQRT2 },
  third: { x: -DIAG, z: DIAG },
}

export function yawToward(x: number, z: number, tx = 0, tz = 0): number {
  return Math.atan2(tx - x, tz - z)
}

export type Spot = { x: number; z: number; yaw: number }

function spot(x: number, z: number, faceHome = true): Spot {
  return { x, z, yaw: faceHome ? yawToward(x, z) : 0 }
}

export const DEFENSE: Record<Exclude<Position, 'DH'>, Spot> = {
  P: spot(0, MOUND_M + 0.35),
  C: spot(0, -2.15, false),
  '1B': spot(15.5, 20.5),
  '2B': spot(11.5, 33.5),
  '3B': spot(-14.8, 20.2),
  SS: spot(-11.2, 31.5),
  LF: spot(-36, 72),
  CF: spot(0, 92),
  RF: spot(38, 70),
}

export function basePoint(base: 0 | 1 | 2 | 3 | 4): { x: number; z: number } {
  if (base === 0 || base === 4) return BASES.home
  if (base === 1) return BASES.first
  if (base === 2) return BASES.second
  return BASES.third
}

/** 베이스라인을 따라 from에서 to까지. 1루→2루→3루→홈 순서. */
export function alongBases(from: number, to: number, u: number): { x: number; z: number; yaw: number } {
  const start = Math.max(0, Math.min(4, from))
  const end = Math.max(start, Math.min(4, to))
  const span = end - start
  if (span <= 0) {
    const p = basePoint(start as 0 | 1 | 2 | 3 | 4)
    return { ...p, yaw: yawToward(p.x, p.z) }
  }
  let remain = u * span
  let cursor = start
  while (remain > 1 && cursor < end - 1) {
    remain -= 1
    cursor += 1
  }
  const a = basePoint(cursor as 0 | 1 | 2 | 3)
  const b = basePoint((cursor + 1) as 1 | 2 | 3 | 4)
  const k = Math.max(0, Math.min(1, remain))
  const x = a.x + (b.x - a.x) * k
  const z = a.z + (b.z - a.z) * k
  return { x, z, yaw: Math.atan2(b.x - a.x, b.z - a.z) }
}

export function dugoutAnchor(side: 'first' | 'third'): { x: number; z: number } {
  return side === 'first' ? { x: 11.5, z: -2.2 } : { x: -11.5, z: -2.2 }
}

export function introSpot(side: 'first' | 'third', index: number): { x: number; z: number; yaw: number } {
  const sign = side === 'first' ? 1 : -1
  const x = sign * (5.2 + index * 0.78)
  const z = 3.4 + index * 0.42
  return { x, z, yaw: sign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5 }
}

export function greetSpot(side: 'first' | 'third', index: number, closed: number): { x: number; z: number; yaw: number } {
  const sign = side === 'first' ? 1 : -1
  const open = introSpot(side, index)
  const x = open.x * (1 - closed) + sign * 1.15 * closed
  const z = open.z * (1 - closed) + (4.6 + (index % 5) * 0.15) * closed
  return { x, z, yaw: sign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5 }
}

export function batterSpot(bats: 'R' | 'L' | 'S', pitcherThrows: 'R' | 'L'): { x: number; z: number; yaw: number } {
  const hand = bats === 'S' ? (pitcherThrows === 'R' ? 'L' : 'R') : bats
  if (hand === 'L') return { x: 0.78, z: -0.42, yaw: -0.35 }
  return { x: -0.78, z: -0.42, yaw: 0.35 }
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function smooth(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

export function zoneFor(heightCm: number): { top: number; bot: number; halfW: number } {
  const h = heightCm / 100
  return {
    bot: h * 0.265,
    top: h * 0.54,
    halfW: PLATE_W / 2,
  }
}

export function pitchInZone(x: number, y: number, heightCm: number): boolean {
  const zone = zoneFor(heightCm)
  const half = zone.halfW + BALL_R
  return Math.abs(x) <= half && y >= zone.bot - BALL_R && y <= zone.top + BALL_R
}
