import { fenceDistance, fenceHeight, type Stadium } from '../data/stadiums.ts'
import { MOUND_M, pitchInZone } from './field.ts'
import type { PitchType } from '../types.ts'

export type Vec3 = { x: number; y: number; z: number }

export type FlightSample = {
  t: number
  x: number
  y: number
  z: number
}

export type PitchFlight = {
  samples: FlightSample[]
  duration: number
  plate: { x: number; y: number; t: number }
  inZone: boolean
  timeToPlate: number
  /** 같은 조준의 무회전 공과 비교한 변화. 미터. +x는 1루 쪽, +y는 위. */
  breakX: number
  breakY: number
  release: Vec3
  axis: Vec3
  rpm: number
}

export type ContactFlight = {
  samples: FlightSample[]
  duration: number
  distance: number
  hang: number
  apex: number
  cleared: boolean
  foul: boolean
  wall: boolean
  /** 담장에 맞는 시각. 넘기지 못한 타구를 여기서 멈춘다. */
  blockedAt: number | null
  landing: { x: number; z: number; t: number }
  axis: Vec3
  rpm: number
}

const K_DRAG = 0.00315
const K_MAGNUS = 0.00033

function mag(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z)
}

function addScaled(v: Vec3, a: Vec3, s: number): void {
  v.x += a.x * s
  v.y += a.y * s
  v.z += a.z * s
}

function accel(v: Vec3, omega: Vec3, magnus: number): Vec3 {
  const speed = mag(v)
  const drag = -K_DRAG * speed
  return {
    x: drag * v.x + magnus * (omega.y * v.z - omega.z * v.y),
    y: drag * v.y + magnus * (omega.z * v.x - omega.x * v.z) - 9.81,
    z: drag * v.z + magnus * (omega.x * v.y - omega.y * v.x),
  }
}

const SPIN: Record<PitchType, Vec3> = {
  FF: { x: 0.94, y: -0.2, z: 0.16 },
  SI: { x: 0.62, y: -0.42, z: 0.48 },
  CT: { x: 0.62, y: 0.62, z: 0.28 },
  SL: { x: 0.12, y: 0.78, z: 0.48 },
  CB: { x: -0.48, y: 0.72, z: 0.32 },
  CH: { x: 0.78, y: 0.12, z: 0.32 },
  FS: { x: -0.22, y: 0.18, z: 0.72 },
  KN: { x: 0.08, y: 0.05, z: 0.12 },
}

function unit(v: Vec3): Vec3 {
  const m = mag(v) || 1
  return { x: v.x / m, y: v.y / m, z: v.z / m }
}

export function spinAxis(type: PitchType, throws: 'R' | 'L'): Vec3 {
  const base = SPIN[type]
  const flipped = throws === 'L' ? { x: base.x, y: -base.y, z: base.z } : base
  return unit(flipped)
}

function releasePoint(heightCm: number, throws: 'R' | 'L'): Vec3 {
  const height = heightCm / 100
  return {
    x: (throws === 'R' ? 1 : -1) * 0.38,
    y: height * 0.9,
    z: MOUND_M - 1.35,
  }
}

function simulateOnce(
  input: {
    type: PitchType
    velocityKmh: number
    rpm: number
    throws: 'R' | 'L'
    heightCm: number
  },
  aimX: number,
  aimY: number,
): { samples: FlightSample[]; plate: { x: number; y: number; t: number }; release: Vec3; axis: Vec3 } {
  const release = releasePoint(input.heightCm, input.throws)
  const plateZ = 0.2
  const speed = input.velocityKmh / 3.6
  const dir = unit({ x: aimX - release.x, y: aimY - release.y, z: plateZ - release.z })
  const v0 = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed }
  const axis = spinAxis(input.type, input.throws)
  const omega = (input.rpm * 2 * Math.PI) / 60
  const w = { x: axis.x * omega, y: axis.y * omega, z: axis.z * omega }
  const p = { ...release }
  const v = { ...v0 }
  const samples: FlightSample[] = [{ t: 0, x: p.x, y: p.y, z: p.z }]
  let plate: { x: number; y: number; t: number } | null = null
  let prev = { ...p }
  let t = 0
  const dt = 0.004
  for (let i = 0; i < 400; i += 1) {
    const a = accel(v, w, K_MAGNUS)
    addScaled(v, a, dt)
    prev = { ...p }
    addScaled(p, v, dt)
    t += dt
    if (i % 2 === 0) samples.push({ t, x: p.x, y: p.y, z: p.z })
    if (plate == null && prev.z > plateZ && p.z <= plateZ) {
      const k = (prev.z - plateZ) / (prev.z - p.z || 1)
      plate = { x: prev.x + (p.x - prev.x) * k, y: prev.y + (p.y - prev.y) * k, t }
    }
    if (p.z < -1.3 || t > 1.15 || p.y < 0) break
  }
  return {
    samples,
    plate: plate ?? { x: p.x, y: p.y, t },
    release,
    axis,
  }
}

export function simulatePitch(input: {
  type: PitchType
  velocityKmh: number
  rpm: number
  plateX: number
  plateY: number
  throws: 'R' | 'L'
  heightCm: number
}): PitchFlight {
  let aimX = input.plateX
  let aimY = input.plateY
  let spun = simulateOnce(input, aimX, aimY)
  for (let i = 0; i < 8; i += 1) {
    const errX = input.plateX - spun.plate.x
    const errY = input.plateY - spun.plate.y
    if (Math.abs(errX) < 0.005 && Math.abs(errY) < 0.008) break
    aimX += errX * 0.92
    aimY += errY * 0.92
    spun = simulateOnce(input, aimX, aimY)
  }
  const dead = simulateOnce({ ...input, rpm: 0 }, aimX, aimY)
  return {
    samples: spun.samples,
    duration: spun.samples[spun.samples.length - 1]?.t ?? 0.45,
    plate: spun.plate,
    inZone: pitchInZone(spun.plate.x, spun.plate.y, input.heightCm),
    timeToPlate: spun.plate.t,
    breakX: spun.plate.x - dead.plate.x,
    breakY: spun.plate.y - dead.plate.y,
    release: spun.release,
    axis: spun.axis,
    rpm: input.rpm,
  }
}

function contactAxis(sprayRad: number, launchDeg: number): Vec3 {
  const back = launchDeg >= 8
  const x = (back ? -1 : 1) * Math.cos(sprayRad)
  const z = (back ? 1 : -1) * Math.sin(sprayRad)
  return unit({ x, y: 0.08, z })
}

export function simulateContact(
  input: {
    exitVelocityKmh: number
    launchAngle: number
    sprayAngle: number
    hitRpm: number
    origin?: Vec3
  },
  stadium: Stadium,
  magnusScale = 1,
): ContactFlight {
  const spray = (input.sprayAngle * Math.PI) / 180
  const launch = (input.launchAngle * Math.PI) / 180
  const ev = input.exitVelocityKmh / 3.6
  const origin = input.origin ?? { x: 0.05, y: 1.05, z: 0.35 }
  const v0 = {
    x: Math.sin(spray) * Math.cos(launch) * ev,
    y: Math.sin(launch) * ev,
    z: Math.cos(spray) * Math.cos(launch) * ev,
  }
  const axis = contactAxis(spray, input.launchAngle)
  const omega = (Math.max(0, input.hitRpm) * 2 * Math.PI) / 60
  const w = { x: axis.x * omega, y: axis.y * omega, z: axis.z * omega }
  const p = { ...origin }
  const v = { ...v0 }
  const samples: FlightSample[] = [{ t: 0, x: p.x, y: p.y, z: p.z }]
  let t = 0
  let cleared = false
  let wall = false
  let blockedAt: number | null = null
  let foul = false
  let apex = origin.y
  let distance = 0
  let hang = 0
  let landing = { x: origin.x, z: origin.z, t: 0 }
  const dt = 0.006
  let bounces = 0
  const ground = input.launchAngle < 12

  for (let i = 0; i < 2200; i += 1) {
    const a = accel(v, w, K_MAGNUS * 0.62 * magnusScale)
    addScaled(v, a, dt)
    addScaled(p, v, dt)
    t += dt
    if (p.y > apex) apex = p.y
    const dist = Math.hypot(p.x, p.z)
    const ang = (Math.atan2(p.x, p.z) * 180) / Math.PI
    if (Math.abs(ang) <= 47 && dist > 8) {
      const fence = fenceDistance(Math.max(-45, Math.min(45, ang)), stadium)
      const height = fenceHeight(Math.max(-45, Math.min(45, ang)), stadium)
      if (!cleared && !wall && dist >= fence && p.y > 0.4) {
        if (p.y >= height) cleared = true
        else {
          wall = true
          blockedAt = t
        }
      }
    }
    if (i % 2 === 0) samples.push({ t, x: p.x, y: p.y, z: p.z })
    if (p.y <= 0.28 && v.y < 0 && !cleared) {
      distance = dist
      landing = { x: p.x, z: p.z, t }
      foul = Math.abs(ang) > 45
      hang = hang || t
      if (!ground || bounces >= 2) break
      p.y = 0.28
      v.y = Math.abs(v.y) * 0.38
      v.x *= 0.72
      v.z *= 0.72
      bounces += 1
    }
    if (cleared && (p.y < 1.2 || dist > fenceDistance(0, stadium) + 28 || t > 7.5)) {
      distance = Math.hypot(p.x, p.z)
      landing = { x: p.x, z: p.z, t }
      hang = hang || t
      foul = Math.abs((Math.atan2(p.x, p.z) * 180) / Math.PI) > 45
      break
    }
    if (t > 8) break
  }
  if (!hang) hang = t
  if (!distance) distance = Math.hypot(landing.x, landing.z)
  return {
    samples,
    duration: samples[samples.length - 1]?.t ?? t,
    distance,
    hang,
    apex,
    cleared,
    foul,
    wall,
    blockedAt,
    landing,
    axis,
    rpm: input.hitRpm,
  }
}

function matchDistance(
  input: {
    exitVelocityKmh: number
    launchAngle: number
    sprayAngle: number
    hitRpm: number
    origin?: Vec3
  },
  stadium: Stadium,
  target: number,
  mustClear = false,
): ContactFlight {
  let lo = 0.25
  let hi = 4
  let best = simulateContact(input, stadium, 1)
  let bestScore = Number.POSITIVE_INFINITY
  for (let i = 0; i < 14; i += 1) {
    const mid = (lo + hi) / 2
    const flight = simulateContact(input, stadium, mid)
    const usable = !mustClear || flight.cleared
    const dist = usable ? flight.distance : 0
    if (dist < target) lo = mid
    else hi = mid
    const score = usable ? Math.abs(flight.distance - target) : 10_000
    if (score < bestScore) {
      best = flight
      bestScore = score
    }
  }
  if (mustClear && !best.cleared) {
    return simulateContact(
      { ...input, launchAngle: input.launchAngle + 6, exitVelocityKmh: input.exitVelocityKmh * 1.08 },
      stadium,
      2.4,
    )
  }
  return best
}

const AIR_OUT = new Set(['flyout', 'lineout', 'popup', 'sac_fly'])

export function presentContact(
  input: {
    exitVelocityKmh: number
    launchAngle: number
    sprayAngle: number
    hitRpm: number
    distanceM: number | null
    origin?: Vec3
  },
  stadium: Stadium,
  result: string | null,
): ContactFlight {
  let launch = input.launchAngle
  let spray = input.sprayAngle
  let target = input.distanceM

  if (result === 'popup') {
    launch = Math.max(launch, 60)
    target = target ?? 26
  } else if (result === 'groundout' || result === 'gidp' || result === 'sac_bunt' || result === 'fielders_choice') {
    launch = Math.min(launch, 7)
    target = target ?? (result === 'sac_bunt' ? 14 : 34)
  } else if (result === 'lineout') {
    launch = Math.max(8, Math.min(launch, 16))
    target = target ?? 52
  } else if (result === 'flyout' || result === 'sac_fly') {
    launch = Math.max(22, Math.min(launch, 42))
    target = target ?? 80
  } else if (result === 'infield_hit') {
    launch = Math.min(launch, 12)
    target = target ?? 24
  } else if (result === 'single' || result === 'error') {
    target = target ?? 90
  } else if (result === 'double') {
    target = target ?? 108
  } else if (result === 'triple') {
    if (Math.abs(spray) < 20) spray = spray < 0 ? -36 : 36
    target = target ?? 116
  } else if (result === 'homer') {
    target = target ?? Math.max(fenceDistance(spray, stadium) + 14, 118)
  }

  if (result && result !== 'strikeout' && result !== 'walk') {
    spray = Math.max(-44, Math.min(44, spray))
  }

  const shaped = {
    exitVelocityKmh: input.exitVelocityKmh,
    launchAngle: launch,
    sprayAngle: spray,
    hitRpm: input.hitRpm,
    origin: input.origin,
  }
  let flight = target == null ? simulateContact(shaped, stadium, 1) : matchDistance(shaped, stadium, target)

  if (result === 'homer') {
    const fence = fenceDistance(spray, stadium)
    const wanted = Math.max(target ?? fence + 12, fence + 6)
    flight = matchDistance(
      { ...shaped, launchAngle: Math.max(launch, 26) },
      stadium,
      wanted,
      true,
    )
  }
  if (result && ['single', 'double', 'triple', 'infield_hit', 'error', 'flyout', 'lineout', 'popup', 'sac_fly', 'groundout'].includes(result) && flight.cleared) {
    const fence = fenceDistance(spray, stadium) - 4
    flight = matchDistance(shaped, stadium, Math.min(target ?? fence, fence))
  }
  if (AIR_OUT.has(result ?? '')) flight = { ...flight, cleared: false }
  return flight
}

export function sampleAt(samples: FlightSample[], time: number): FlightSample {
  if (samples.length === 0) return { t: 0, x: 0, y: 1, z: 0 }
  const first = samples[0]!
  if (time <= first.t) return first
  const last = samples[samples.length - 1]!
  if (time >= last.t) return last
  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = samples[i]!
    const b = samples[i + 1]!
    if (time <= b.t) {
      const k = (time - a.t) / (b.t - a.t || 1)
      return {
        t: time,
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        z: a.z + (b.z - a.z) * k,
      }
    }
  }
  return last
}
