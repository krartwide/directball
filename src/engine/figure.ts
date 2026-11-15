import * as THREE from 'three'
import { BONE_NAMES, type BoneName, type Player, type Team } from '../types.ts'
import type { Pose } from '../types.ts'
import { sampleClip } from '../lib/pose.ts'
import { builtInClip, type BuiltInClip } from '../lib/clips.ts'

export type Figure = {
  id: string
  root: THREE.Group
  setPlace: (pose: Pose, yaw: number, x: number, y: number, z: number) => void
  setClip: (clip: BuiltInClip, time: number, player: Player) => void
  setGear: (gear: { bat?: boolean; glove?: boolean; hat?: 'cap' | 'helmet' | 'none' }) => void
  hand: (side: 'L' | 'R') => THREE.Vector3
  dispose: () => void
}

function limb(radius: number, length: number, color: THREE.ColorRepresentation, rough = 0.7): THREE.Mesh {
  const span = Math.max(length, radius * 2.2)
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.02, span - radius * 2), 3, 8)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 }),
  )
  mesh.position.y = -span / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function numberPlane(num: number, fill: string, stroke: string, w: number, h: number): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256)
    ctx.fillStyle = fill
    ctx.strokeStyle = stroke
    ctx.lineWidth = 14
    ctx.font = '700 168px Pretendard, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeText(String(num), 128, 136)
    ctx.fillText(String(num), 128, 136)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, depthWrite: false }),
  )
  return mesh
}

export function createFigure(player: Player, team: Team): Figure {
  const height = player.body.heightCm / 100
  const leg = height * 0.46 * player.body.legLength
  const thigh = leg * 0.5
  const shin = leg * 0.46
  const spineLen = height * 0.12
  const chestLen = height * 0.16
  const headR = height * 0.068 * player.body.headScale
  const shoulder = height * 0.22 * player.body.shoulder
  const arm = height * 0.33 * player.body.armLength
  const upper = arm * 0.52
  const fore = arm * 0.42
  const thick = 0.04 + player.body.build * 0.034
  const skin = new THREE.Color(player.skin)
  const jersey = new THREE.Color(team.primary)
  const trim = new THREE.Color(team.secondary)
  const pants = new THREE.Color('#f4f1e8')

  const root = new THREE.Group()
  const offset = new THREE.Group()
  root.add(offset)
  const bones = {} as Record<BoneName, THREE.Group>
  for (const name of BONE_NAMES) bones[name] = new THREE.Group()

  bones.hips.position.y = thigh + shin
  offset.add(bones.hips)
  bones.hips.add(limb(thick * 1.35, 0.16, jersey))
  bones.thighL.position.set(-thick * 1.15, 0, 0)
  bones.thighR.position.set(thick * 1.15, 0, 0)
  bones.hips.add(bones.thighL, bones.thighR)
  bones.thighL.add(limb(thick * 0.92, thigh, pants))
  bones.thighR.add(limb(thick * 0.92, thigh, pants))
  bones.shinL.position.y = -thigh
  bones.shinR.position.y = -thigh
  bones.thighL.add(bones.shinL)
  bones.thighR.add(bones.shinR)
  bones.shinL.add(limb(thick * 0.72, shin, pants))
  bones.shinR.add(limb(thick * 0.72, shin, pants))
  bones.footL.position.y = -shin
  bones.footR.position.y = -shin
  bones.shinL.add(bones.footL)
  bones.shinR.add(bones.footR)
  for (const foot of [bones.footL, bones.footR]) {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.05, 0.22),
      new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.55 }),
    )
    shoe.position.set(0, -0.02, 0.06)
    shoe.castShadow = true
    foot.add(shoe)
  }

  bones.spine.position.y = 0.06
  bones.hips.add(bones.spine)
  bones.spine.add(limb(thick * 1.15, spineLen, jersey))
  bones.chest.position.y = spineLen
  bones.spine.add(bones.chest)
  const chest = limb(thick * 1.55, chestLen, jersey)
  chest.scale.x = 1.25
  bones.chest.add(chest)
  const backNum = numberPlane(player.number, '#f7f4ea', team.secondary, 0.28, 0.28)
  backNum.position.set(0, -chestLen * 0.35, -thick * 1.7)
  backNum.rotation.y = Math.PI
  bones.chest.add(backNum)
  const frontNum = numberPlane(player.number, '#f7f4ea', team.secondary, 0.16, 0.16)
  frontNum.position.set(0, -chestLen * 0.15, thick * 1.75)
  bones.chest.add(frontNum)

  bones.neck.position.y = chestLen * 0.15
  bones.chest.add(bones.neck)
  bones.neck.add(limb(thick * 0.42, height * 0.06, skin, 0.55))
  bones.head.position.y = height * 0.07
  bones.neck.add(bones.head)
  const headGeo = new THREE.SphereGeometry(headR, 24, 18)
  const headMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.58, metalness: 0 })
  const head = new THREE.Mesh(headGeo, headMat)
  head.castShadow = true
  bones.head.add(head)
  if (player.faceTexture) {
    const img = new Image()
    img.onload = () => {
      const tex = new THREE.Texture(img)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      headMat.map = tex
      headMat.color.set('#ffffff')
      headMat.needsUpdate = true
    }
    img.src = player.faceTexture
  }

  const cap = new THREE.Group()
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(headR * 1.05, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.65 }),
  )
  crown.position.y = headR * 0.12
  const brim = new THREE.Mesh(
    new THREE.BoxGeometry(headR * 1.3, 0.015, headR * 0.95),
    new THREE.MeshStandardMaterial({ color: trim, roughness: 0.5 }),
  )
  brim.position.set(0, headR * 0.05, headR * 0.85)
  cap.add(crown, brim)
  if (team.emblem) {
    const badge = new THREE.Mesh(
      new THREE.CircleGeometry(headR * 0.34, 16),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }),
    )
    const logo = new Image()
    logo.onload = () => {
      const tex = new THREE.Texture(logo)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      ;(badge.material as THREE.MeshStandardMaterial).map = tex
      ;(badge.material as THREE.MeshStandardMaterial).needsUpdate = true
    }
    logo.src = team.emblem
    badge.position.set(0, headR * 0.35, headR * 0.78)
    cap.add(badge)
  }
  bones.head.add(cap)

  const helmet = new THREE.Group()
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(headR * 1.12, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.42, metalness: 0.18 }),
  )
  shell.position.y = headR * 0.05
  const ear = new THREE.Mesh(
    new THREE.BoxGeometry(headR * 0.35, headR * 0.7, headR * 0.2),
    new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.45, metalness: 0.1 }),
  )
  ear.position.set(player.bats === 'L' ? headR * 0.95 : -headR * 0.95, -headR * 0.05, 0)
  helmet.add(shell, ear)
  helmet.visible = false
  bones.head.add(helmet)

  const gloveSide = player.throws === 'R' ? 'L' : 'R'
  const batSide = player.bats === 'L' ? 'L' : 'R'
  bones.shoulderL.position.set(-shoulder / 2, chestLen * 0.15, 0)
  bones.shoulderR.position.set(shoulder / 2, chestLen * 0.15, 0)
  bones.chest.add(bones.shoulderL, bones.shoulderR)
  bones.shoulderL.add(limb(thick * 0.48, upper, jersey))
  bones.shoulderR.add(limb(thick * 0.48, upper, jersey))
  bones.elbowL.position.y = -upper
  bones.elbowR.position.y = -upper
  bones.shoulderL.add(bones.elbowL)
  bones.shoulderR.add(bones.elbowR)
  bones.elbowL.add(limb(thick * 0.4, fore, skin, 0.55))
  bones.elbowR.add(limb(thick * 0.4, fore, skin, 0.55))
  bones.wristL.position.y = -fore
  bones.wristR.position.y = -fore
  bones.elbowL.add(bones.wristL)
  bones.elbowR.add(bones.wristR)

  const glove = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#6b3a22', roughness: 0.72 }),
  )
  glove.scale.set(1.15, 0.85, 1.35)
  ;(gloveSide === 'L' ? bones.wristL : bones.wristR).add(glove)

  const bat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.032, 0.96, 8),
    new THREE.MeshStandardMaterial({ color: '#d8b170', roughness: 0.55 }),
  )
  bat.rotation.set(-1.2, 0, batSide === 'L' ? 0.55 : -0.55)
  bat.position.set(batSide === 'L' ? 0.08 : -0.08, -0.02, -0.16)
  bat.visible = false
  ;(batSide === 'L' ? bones.wristL : bones.wristR).add(bat)

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 16),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  root.add(shadow)

  const disposables: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) disposables.push(mesh.geometry)
    if (mesh.material && !Array.isArray(mesh.material)) materials.push(mesh.material)
  })

  const handVec = new THREE.Vector3()
  return {
    id: player.id,
    root,
    setPlace: (pose, yaw, x, y, z) => {
      root.visible = true
      root.position.set(x, y, z)
      root.rotation.y = yaw
      offset.position.set(pose.offset[0], pose.offset[1], pose.offset[2])
      for (const name of BONE_NAMES) {
        const [rx, ry, rz] = pose.bones[name]
        bones[name].rotation.set(
          THREE.MathUtils.degToRad(rx),
          THREE.MathUtils.degToRad(ry),
          THREE.MathUtils.degToRad(rz),
        )
      }
    },
    setClip: (name, time, who) => {
      const clip =
        name === 'routine'
          ? who.anims.routine
          : name === 'swing'
            ? who.anims.swing
            : name === 'pitch'
              ? who.anims.pitch
              : name === 'ceremony'
                ? who.anims.hrCeremony
                : builtInClip(name)
      const pose = sampleClip(clip, time)
      offset.position.set(pose.offset[0], pose.offset[1], pose.offset[2])
      for (const bone of BONE_NAMES) {
        const [rx, ry, rz] = pose.bones[bone]
        bones[bone].rotation.set(
          THREE.MathUtils.degToRad(rx),
          THREE.MathUtils.degToRad(ry),
          THREE.MathUtils.degToRad(rz),
        )
      }
    },
    setGear: (gear) => {
      bat.visible = Boolean(gear.bat)
      glove.visible = gear.glove !== false
      cap.visible = gear.hat !== 'helmet' && gear.hat !== 'none'
      helmet.visible = gear.hat === 'helmet'
    },
    hand: (side) => {
      const node = side === 'L' ? bones.wristL : bones.wristR
      node.getWorldPosition(handVec)
      return handVec
    },
    dispose: () => {
      disposables.forEach((geo) => geo.dispose())
      materials.forEach((material) => {
        const mapped = material as THREE.MeshStandardMaterial
        mapped.map?.dispose()
        material.dispose()
      })
    },
  }
}

export function createUmpire(id: string): Figure {
  const player = {
    id,
    teamId: '',
    name: '심판',
    number: 0,
    position: 'C',
    bats: 'R',
    throws: 'R',
    body: { heightCm: 180, build: 0.4, shoulder: 1, armLength: 1, legLength: 1, headScale: 1 },
    skin: '#b5815d',
    hair: '#241810',
    faceStyle: 'photo',
    anims: {
      routine: builtInClip('umpIdle'),
      swing: builtInClip('umpIdle'),
      hrCeremony: builtInClip('umpIdle'),
      pitch: builtInClip('umpIdle'),
    },
  } satisfies Player
  const team: Team = {
    id: 'ump',
    name: '심판',
    short: '심',
    city: '',
    primary: '#111111',
    secondary: '#d8d8d8',
  }
  return createFigure(player, team)
}
