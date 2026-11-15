import type { BoneName, Clip, Euler3, PlayerAnims } from '../types.ts'
import { mirrorClip, poseOf } from './pose.ts'

type PartialBones = Partial<Record<BoneName, Euler3>>

function clip(duration: number, loop: boolean, frames: [number, PartialBones, [number, number, number]?][]): Clip {
  return {
    duration,
    loop,
    keys: frames.map(([t, bones, offset]) => ({
      t,
      pose: poseOf(bones, offset ?? [0, 0, 0]),
    })),
  }
}

const ready: PartialBones = {
  hips: [6, 0, 0],
  spine: [4, 0, 0],
  thighL: [-16, 4, -2],
  thighR: [-16, -4, 2],
  shinL: [24, 0, 0],
  shinR: [24, 0, 0],
  shoulderL: [-8, 0, 12],
  shoulderR: [-8, 0, -12],
  elbowL: [12, 0, 0],
  elbowR: [12, 0, 0],
}

/** 투구 릴리스는 클립의 74% 지점. */
export const PITCH_RELEASE = 0.74
/** 타격 임팩트는 스윙 클립의 52% 지점. */
export const SWING_CONTACT = 0.52

export function idleClip(): Clip {
  return clip(1.6, true, [
    [0, ready, [0, -0.04, 0]],
    [0.5, { ...ready, spine: [6, 2, 1], head: [4, -2, 0] }, [0, -0.02, 0]],
    [1, ready, [0, -0.04, 0]],
  ])
}

export function readyClip(): Clip {
  return clip(1.2, true, [
    [0, { ...ready, hips: [12, 0, 0], thighL: [-24, 0, 0], thighR: [-24, 0, 0], shinL: [36, 0, 0], shinR: [36, 0, 0] }, [0, -0.1, 0]],
    [0.5, { ...ready, hips: [10, 0, 0], thighL: [-20, 0, 0], thighR: [-22, 0, 0], shinL: [32, 0, 0], shinR: [34, 0, 0] }, [0, -0.08, 0]],
    [1, { ...ready, hips: [12, 0, 0], thighL: [-24, 0, 0], thighR: [-24, 0, 0], shinL: [36, 0, 0], shinR: [36, 0, 0] }, [0, -0.1, 0]],
  ])
}

export function jogClip(): Clip {
  return clip(0.62, true, [
    [0, { thighL: [-32, 0, 0], shinL: [48, 0, 0], thighR: [18, 0, 0], shinR: [8, 0, 0], shoulderL: [20, 0, 8], shoulderR: [-28, 0, -8], spine: [8, 0, 0] }, [0, 0.02, 0]],
    [0.5, { thighR: [-32, 0, 0], shinR: [48, 0, 0], thighL: [18, 0, 0], shinL: [8, 0, 0], shoulderR: [20, 0, -8], shoulderL: [-28, 0, 8], spine: [8, 0, 0] }, [0, 0.05, 0]],
    [1, { thighL: [-32, 0, 0], shinL: [48, 0, 0], thighR: [18, 0, 0], shinR: [8, 0, 0], shoulderL: [20, 0, 8], shoulderR: [-28, 0, -8], spine: [8, 0, 0] }, [0, 0.02, 0]],
  ])
}

export function runClip(): Clip {
  return clip(0.42, true, [
    [0, { thighL: [-48, 0, 0], shinL: [70, 0, 0], thighR: [28, 0, 0], shinR: [12, 0, 0], shoulderL: [30, 0, 6], shoulderR: [-42, 0, -10], spine: [14, 0, 0] }, [0, 0.04, 0]],
    [0.5, { thighR: [-48, 0, 0], shinR: [70, 0, 0], thighL: [28, 0, 0], shinL: [12, 0, 0], shoulderR: [30, 0, -6], shoulderL: [-42, 0, 10], spine: [14, 0, 0] }, [0, 0.08, 0]],
    [1, { thighL: [-48, 0, 0], shinL: [70, 0, 0], thighR: [28, 0, 0], shinR: [12, 0, 0], shoulderL: [30, 0, 6], shoulderR: [-42, 0, -10], spine: [14, 0, 0] }, [0, 0.04, 0]],
  ])
}

export function crouchClip(): Clip {
  return clip(1.4, true, [
    [0, {
      hips: [18, 0, 0],
      spine: [16, 0, 0],
      thighL: [-48, 8, -4],
      thighR: [-48, -8, 4],
      shinL: [78, 0, 0],
      shinR: [78, 0, 0],
      shoulderL: [-36, 10, 18],
      elbowL: [55, 0, 0],
      shoulderR: [-20, -10, -8],
      elbowR: [24, 0, 0],
    }, [0, -0.42, 0]],
    [1, {
      hips: [16, 0, 0],
      spine: [14, 0, 0],
      thighL: [-46, 8, -4],
      thighR: [-46, -8, 4],
      shinL: [74, 0, 0],
      shinR: [74, 0, 0],
      shoulderL: [-34, 8, 16],
      elbowL: [50, 0, 0],
      shoulderR: [-18, -8, -6],
      elbowR: [20, 0, 0],
    }, [0, -0.4, 0]],
  ])
}

export function bowClip(): Clip {
  return clip(1.5, false, [
    [0, ready, [0, -0.04, 0]],
    [0.45, { spine: [38, 0, 0], chest: [16, 0, 0], head: [18, 0, 0], shoulderL: [10, 0, 8], shoulderR: [10, 0, -8] }, [0, -0.08, 0.04]],
    [0.7, { spine: [38, 0, 0], chest: [16, 0, 0], head: [18, 0, 0] }, [0, -0.08, 0.04]],
    [1, ready, [0, -0.04, 0]],
  ])
}

export function dejectedClip(): Clip {
  return clip(2.2, true, [
    [0, { spine: [22, 0, 0], chest: [12, 0, 0], head: [28, 0, 0], shoulderL: [16, 0, 10], shoulderR: [18, 0, -6], thighL: [-8, 0, 0], thighR: [-8, 0, 0], shinL: [10, 0, 0], shinR: [10, 0, 0] }, [0, -0.06, 0]],
    [0.5, { spine: [26, 4, 2], chest: [10, 0, 0], head: [32, 6, 0], shoulderL: [20, 0, 14], shoulderR: [8, 0, -4] }, [0, -0.07, 0]],
    [1, { spine: [22, 0, 0], chest: [12, 0, 0], head: [28, 0, 0], shoulderL: [16, 0, 10], shoulderR: [18, 0, -6] }, [0, -0.06, 0]],
  ])
}

export function pumpClip(): Clip {
  return clip(1.5, false, [
    [0, ready],
    [0.35, { shoulderR: [-150, -10, -20], elbowR: [18, 0, 0], spine: [-8, -12, 0], head: [-10, -8, 0], thighL: [-10, 0, 0], shinL: [12, 0, 0] }, [0, 0.04, 0]],
    [0.55, { shoulderR: [-158, -6, -16], elbowR: [8, 0, 0], spine: [-12, -18, 0], head: [-16, -10, 0] }, [0, 0.06, 0]],
    [1, { shoulderR: [-120, 0, -12], elbowR: [16, 0, 0], spine: [-4, -6, 0], head: [-6, 0, 0] }],
  ])
}

export function celebrateClip(): Clip {
  return clip(1.3, true, [
    [0, { shoulderL: [-145, 15, 24], shoulderR: [-145, -15, -24], elbowL: [12, 0, 0], elbowR: [12, 0, 0], spine: [-8, 0, 0], head: [-12, 0, 0] }, [0, 0.05, 0]],
    [0.5, { shoulderL: [-158, 8, 18], shoulderR: [-150, -20, -30], spine: [-4, 8, 0], head: [-8, 6, 0] }, [0, 0.08, 0]],
    [1, { shoulderL: [-145, 15, 24], shoulderR: [-145, -15, -24], spine: [-8, 0, 0], head: [-12, 0, 0] }, [0, 0.05, 0]],
  ])
}

export function slideClip(): Clip {
  return clip(0.7, false, [
    [0, runClip().keys[0]?.pose.bones ?? ready],
    [0.45, { hips: [40, 0, 0], spine: [30, 0, 0], thighL: [-20, 0, 0], thighR: [10, 0, 0], shinL: [70, 0, 0], shinR: [20, 0, 0], shoulderL: [-20, 0, 20], shoulderR: [10, 0, -10] }, [0, -0.55, 0.2]],
    [1, { hips: [48, 0, 0], spine: [24, 0, 0], thighL: [-10, 0, 0], shinL: [80, 0, 0], shinR: [16, 0, 0] }, [0, -0.62, 0.25]],
  ])
}

const ump: PartialBones = {
  spine: [4, 0, 0],
  thighL: [-8, 6, 0],
  thighR: [-8, -6, 0],
  shinL: [10, 0, 0],
  shinR: [10, 0, 0],
}

export function umpIdleClip(): Clip {
  return clip(2, true, [
    [0, ump],
    [1, ump],
  ])
}

export function umpStrikeClip(): Clip {
  return clip(0.9, false, [
    [0, ump],
    [0.35, { ...ump, shoulderR: [-70, -20, -10], elbowR: [20, 0, 0] }],
    [0.55, { ...ump, shoulderR: [-100, 10, -16], elbowR: [8, 0, 0], spine: [-4, -8, 0] }],
    [1, { ...ump, shoulderR: [-88, 6, -12], elbowR: [10, 0, 0] }],
  ])
}

export function umpBallClip(): Clip {
  return clip(0.8, false, [
    [0, ump],
    [0.4, { ...ump, shoulderL: [-20, 0, 55], elbowL: [8, 0, 0] }],
    [1, { ...ump, shoulderL: [8, 0, 20] }],
  ])
}

export function umpOutClip(): Clip {
  return clip(0.95, false, [
    [0, ump],
    [0.4, { ...ump, shoulderR: [-168, 0, -8], elbowR: [6, 0, 0], spine: [-6, 0, 0] }, [0, 0.04, 0]],
    [1, { ...ump, shoulderR: [-150, 0, -8], elbowR: [8, 0, 0] }],
  ])
}

export function umpSafeClip(): Clip {
  return clip(0.9, false, [
    [0, ump],
    [0.35, { ...ump, shoulderL: [-16, 0, 78], shoulderR: [-16, 0, -78], elbowL: [6, 0, 0], elbowR: [6, 0, 0] }],
    [1, { ...ump, shoulderL: [-10, 0, 70], shoulderR: [-10, 0, -70] }],
  ])
}

export function umpReviewClip(): Clip {
  return clip(1.4, true, [
    [0, { ...ump, shoulderR: [-78, -30, -36], elbowR: [86, 0, 0], head: [6, -12, 0] }],
    [1, { ...ump, shoulderR: [-74, -28, -34], elbowR: [82, 0, 0], head: [8, -10, 0] }],
  ])
}

export function umpOverturnClip(): Clip {
  return clip(1.2, false, [
    [0, ump],
    [0.4, { ...ump, shoulderL: [-150, 20, 20], shoulderR: [-150, -20, -20], elbowL: [8, 0, 0], elbowR: [8, 0, 0] }, [0, 0.03, 0]],
    [1, { ...ump, shoulderL: [-130, 10, 16], shoulderR: [-130, -10, -16] }],
  ])
}

function routineRight(): Clip {
  return clip(2.4, true, [
    [0, {
      hips: [8, 18, 0],
      spine: [6, 22, 0],
      chest: [4, 16, 0],
      head: [6, -28, 0],
      thighL: [-18, 6, -2],
      thighR: [-22, -4, 2],
      shinL: [28, 0, 0],
      shinR: [34, 0, 0],
      shoulderL: [-78, 20, 18],
      shoulderR: [-86, -24, -22],
      elbowL: [62, 0, 0],
      elbowR: [58, 0, 0],
      wristR: [10, 0, -20],
    }, [0, -0.06, 0]],
    [0.5, {
      hips: [10, 22, 0],
      spine: [8, 26, 0],
      chest: [4, 18, 0],
      head: [8, -30, 0],
      thighR: [-28, -6, 2],
      shinR: [40, 0, 0],
      shoulderL: [-84, 18, 16],
      shoulderR: [-92, -28, -20],
      elbowL: [66, 0, 0],
      elbowR: [64, 0, 0],
    }, [0, -0.05, -0.02]],
    [1, {
      hips: [8, 18, 0],
      spine: [6, 22, 0],
      chest: [4, 16, 0],
      head: [6, -28, 0],
      thighL: [-18, 6, -2],
      thighR: [-22, -4, 2],
      shinL: [28, 0, 0],
      shinR: [34, 0, 0],
      shoulderL: [-78, 20, 18],
      shoulderR: [-86, -24, -22],
      elbowL: [62, 0, 0],
      elbowR: [58, 0, 0],
    }, [0, -0.06, 0]],
  ])
}

function swingRight(): Clip {
  return clip(0.86, false, [
    [0, {
      hips: [8, 24, 0],
      spine: [6, 30, 0],
      chest: [4, 22, 0],
      head: [4, -36, 0],
      thighL: [-12, 4, 0],
      thighR: [-30, -8, 0],
      shinL: [16, 0, 0],
      shinR: [42, 0, 0],
      shoulderL: [-70, 24, 10],
      shoulderR: [-96, -36, -18],
      elbowL: [70, 0, 0],
      elbowR: [74, 0, 0],
    }, [0, -0.05, 0]],
    [0.28, {
      hips: [4, 10, 0],
      spine: [2, 8, 0],
      thighL: [-36, 0, 0],
      shinL: [28, 0, 0],
      thighR: [-8, 0, 0],
      shoulderL: [-60, 10, 8],
      shoulderR: [-80, -10, -8],
      elbowL: [48, 0, 0],
      elbowR: [40, 0, 0],
    }, [0, -0.04, 0.06]],
    [0.52, {
      hips: [-4, -28, 0],
      spine: [-6, -36, 0],
      chest: [-4, -24, 0],
      head: [2, -10, 0],
      thighL: [-18, 0, 0],
      shinL: [20, 0, 0],
      shoulderL: [-46, -20, 6],
      shoulderR: [-52, 16, -8],
      elbowL: [18, 0, 0],
      elbowR: [16, 0, 0],
      wristR: [-8, 0, 10],
    }, [0, 0, 0.1]],
    [0.78, {
      hips: [-8, -48, 0],
      spine: [-10, -40, 0],
      chest: [8, -20, 0],
      head: [8, 6, 0],
      shoulderL: [10, -10, 16],
      shoulderR: [-20, 30, -28],
      elbowL: [24, 0, 0],
      elbowR: [36, 0, 0],
    }, [0, -0.02, 0.04]],
    [1, {
      hips: [0, -36, 0],
      spine: [4, -20, 0],
      head: [10, 0, 0],
      shoulderR: [-10, 16, -16],
      elbowR: [28, 0, 0],
    }, [0, -0.04, 0]],
  ])
}

function ceremonyRight(): Clip {
  return clip(1.8, false, [
    [0, ready],
    [0.35, { shoulderR: [-130, -20, -30], elbowR: [20, 0, 0], shoulderL: [-40, 10, 16], head: [-8, -16, 0], spine: [-6, -10, 0] }, [0, 0.04, 0]],
    [0.6, { shoulderL: [-150, 16, 22], shoulderR: [-156, -8, -18], elbowL: [10, 0, 0], elbowR: [8, 0, 0], head: [-18, 0, 0], spine: [-10, 0, 0] }, [0, 0.08, 0]],
    [1, { shoulderL: [-140, 12, 18], shoulderR: [-146, -12, -16], head: [-12, 4, 0] }, [0, 0.05, 0]],
  ])
}

function pitchRight(): Clip {
  return clip(1.25, false, [
    [0, {
      hips: [10, 0, 0],
      spine: [8, 0, 0],
      thighL: [-20, 4, 0],
      thighR: [-20, -4, 0],
      shinL: [32, 0, 0],
      shinR: [32, 0, 0],
      shoulderL: [-42, 16, 12],
      shoulderR: [-46, -18, -14],
      elbowL: [48, 0, 0],
      elbowR: [52, 0, 0],
    }, [0, -0.08, 0]],
    [0.32, {
      hips: [6, 8, 0],
      spine: [-4, 10, 0],
      thighL: [-78, 6, 0],
      shinL: [70, 0, 0],
      thighR: [-16, 0, 0],
      shinR: [22, 0, 0],
      shoulderL: [-55, 10, 8],
      shoulderR: [-70, -20, -10],
      elbowL: [40, 0, 0],
      elbowR: [70, 0, 0],
    }, [0, 0.02, 0]],
    [0.56, {
      hips: [16, -8, 0],
      spine: [8, -12, 0],
      thighL: [-28, 0, 0],
      shinL: [18, 0, 0],
      thighR: [-8, 0, 0],
      shinR: [16, 0, 0],
      shoulderR: [-130, -30, -16],
      elbowR: [78, 0, 0],
      shoulderL: [-20, 8, 16],
      elbowL: [24, 0, 0],
    }, [0, -0.02, 0.08]],
    [0.74, {
      hips: [22, -16, 0],
      spine: [18, -8, 0],
      chest: [8, 0, 0],
      thighL: [-12, 0, 0],
      shinL: [14, 0, 0],
      shoulderR: [-78, 12, -6],
      elbowR: [12, 0, 0],
      wristR: [-6, 0, 8],
      shoulderL: [8, 0, 20],
    }, [0, -0.04, 0.16]],
    [1, {
      hips: [16, -8, 0],
      spine: [24, 6, 0],
      shoulderR: [12, 20, -18],
      elbowR: [28, 0, 0],
      thighL: [-6, 0, 0],
      head: [12, 8, 0],
    }, [0, -0.05, 0.1]],
  ])
}

export function defaultAnims(throws: 'R' | 'L', bats: 'R' | 'L' | 'S'): PlayerAnims {
  const batterHand = bats === 'S' ? 'L' : bats
  const routine = batterHand === 'L' ? mirrorClip(routineRight()) : routineRight()
  const swing = batterHand === 'L' ? mirrorClip(swingRight()) : swingRight()
  const hrCeremony = batterHand === 'L' ? mirrorClip(ceremonyRight()) : ceremonyRight()
  const pitch = throws === 'L' ? mirrorClip(pitchRight()) : pitchRight()
  return { routine, swing, hrCeremony, pitch }
}

export type BuiltInClip =
  | 'idle'
  | 'ready'
  | 'jog'
  | 'run'
  | 'crouch'
  | 'bow'
  | 'dejected'
  | 'pump'
  | 'celebrate'
  | 'slide'
  | 'routine'
  | 'swing'
  | 'pitch'
  | 'ceremony'
  | 'umpIdle'
  | 'umpStrike'
  | 'umpBall'
  | 'umpOut'
  | 'umpSafe'
  | 'umpReview'
  | 'umpOverturn'

const BUILTIN: Record<Exclude<BuiltInClip, 'routine' | 'swing' | 'pitch' | 'ceremony'>, () => Clip> = {
  idle: idleClip,
  ready: readyClip,
  jog: jogClip,
  run: runClip,
  crouch: crouchClip,
  bow: bowClip,
  dejected: dejectedClip,
  pump: pumpClip,
  celebrate: celebrateClip,
  slide: slideClip,
  umpIdle: umpIdleClip,
  umpStrike: umpStrikeClip,
  umpBall: umpBallClip,
  umpOut: umpOutClip,
  umpSafe: umpSafeClip,
  umpReview: umpReviewClip,
  umpOverturn: umpOverturnClip,
}

export function builtInClip(name: Exclude<BuiltInClip, 'routine' | 'swing' | 'pitch' | 'ceremony'>): Clip {
  return BUILTIN[name]()
}
