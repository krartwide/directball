import type { BuiltInClip } from '../lib/clips.ts'
import type { Half } from '../types.ts'

export type Place = {
  x: number
  y: number
  z: number
  yaw: number
  clip: BuiltInClip
  time: number
  bat?: boolean
  glove?: boolean
  hat?: 'cap' | 'helmet' | 'none'
}

export type BallDraw = {
  x: number
  y: number
  z: number
  ax: number
  ay: number
  az: number
  angle: number
  blur: number
}

export type Frame = {
  places: Map<string, Place>
  ball: BallDraw | null
  stickHand: { id: string; side: 'L' | 'R' } | null
  crowd: number
  zoneH: number | null
  water: { x: number; z: number } | null
}

export function emptyFrame(): Frame {
  return { places: new Map(), ball: null, stickHand: null, crowd: 0.25, zoneH: null, water: null }
}

export type CamFrame = {
  x: number
  y: number
  z: number
  lx: number
  ly: number
  lz: number
  fov: number
}

export type Hud = {
  away: string
  home: string
  awayColor: string
  homeColor: string
  awayScore: number
  homeScore: number
  inning: number
  half: Half
  outs: number
  balls: number
  strikes: number
  bases: [boolean, boolean, boolean]
  lower?: { kicker: string; title: string; detail: string }
  banner?: string
  sub?: string
  pitch?: { name: string; velo: number; rpm: number }
  zone?: { x: number; y: number; top: number; bot: number; half: number; call: string } | null
  replay: boolean
  reviewTitle?: string
  callText?: string
}

export type SfxId = 'pop' | 'crack' | 'cheer' | 'organ' | 'call'

export type Cue = {
  t0: number
  t1: number
  label: string
  highlight: boolean
  cut: boolean
  apply: (frame: Frame, local: number) => void
  camera: (local: number) => CamFrame
  hud: (local: number) => Hud
  sfx: { t: number; id: SfxId; text?: string }[]
  absWindow?: [number, number]
}

export function look(
  pos: [number, number, number],
  target: [number, number, number],
  fov: number,
): CamFrame {
  return { x: pos[0], y: pos[1], z: pos[2], lx: target[0], ly: target[1], lz: target[2], fov }
}
