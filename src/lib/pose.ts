import { BONE_NAMES, type BoneName, type Clip, type Euler3, type Pose } from '../types.ts'

export function blankPose(): Pose {
  const bones = {} as Record<BoneName, Euler3>
  for (const name of BONE_NAMES) bones[name] = [0, 0, 0]
  return { bones, offset: [0, 0, 0] }
}

export function poseOf(
  partial: Partial<Record<BoneName, Euler3>>,
  offset: [number, number, number] = [0, 0, 0],
): Pose {
  const pose = blankPose()
  pose.offset = offset
  for (const name of BONE_NAMES) {
    const value = partial[name]
    if (value) pose.bones[name] = [value[0], value[1], value[2]]
  }
  return pose
}

function lerpAngle(a: number, b: number, t: number): number {
  const d = (((b - a + 540) % 360) + 360) % 360 - 180
  return a + d * t
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = blankPose()
  for (const name of BONE_NAMES) {
    const av = a.bones[name]
    const bv = b.bones[name]
    out.bones[name] = [lerpAngle(av[0], bv[0], t), lerpAngle(av[1], bv[1], t), lerpAngle(av[2], bv[2], t)]
  }
  out.offset = [
    a.offset[0] + (b.offset[0] - a.offset[0]) * t,
    a.offset[1] + (b.offset[1] - a.offset[1]) * t,
    a.offset[2] + (b.offset[2] - a.offset[2]) * t,
  ]
  return out
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export function sampleClip(clip: Clip, timeSec: number): Pose {
  const keys = clip.keys
  if (keys.length === 0) return blankPose()
  const dur = Math.max(0.05, clip.duration)
  const raw = clip.loop ? (timeSec % dur) / dur : Math.max(0, Math.min(1, timeSec / dur))
  const first = keys[0]
  if (!first) return blankPose()
  if (raw <= first.t) return first.pose
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i]
    const b = keys[i + 1]
    if (!a || !b) continue
    if (raw <= b.t) {
      const span = b.t - a.t || 1
      return lerpPose(a.pose, b.pose, smoothstep((raw - a.t) / span))
    }
  }
  return keys[keys.length - 1]?.pose ?? blankPose()
}

const SIDE: Record<string, string> = {
  shoulderL: 'shoulderR',
  elbowL: 'elbowR',
  wristL: 'wristR',
  thighL: 'thighR',
  shinL: 'shinR',
  footL: 'footR',
  shoulderR: 'shoulderL',
  elbowR: 'elbowL',
  wristR: 'wristL',
  thighR: 'thighL',
  shinR: 'shinL',
  footR: 'footL',
}

export function mirrorPose(pose: Pose): Pose {
  const out = blankPose()
  for (const name of BONE_NAMES) {
    const sourceName = (SIDE[name] ?? name) as BoneName
    const [x, y, z] = pose.bones[sourceName]
    out.bones[name] = [x, -y, -z]
  }
  out.offset = [-pose.offset[0], pose.offset[1], pose.offset[2]]
  return out
}

export function mirrorClip(clip: Clip): Clip {
  return {
    duration: clip.duration,
    loop: clip.loop,
    keys: clip.keys.map((key) => ({ t: key.t, pose: mirrorPose(key.pose) })),
  }
}
