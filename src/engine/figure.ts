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

type MatKind = 'skin' | 'jersey' | 'pants' | 'trim' | 'leather' | 'rubber' | 'plastic' | 'wood' | 'metal'

function makeMat(kind: MatKind, color: THREE.ColorRepresentation, map?: THREE.Texture): THREE.MeshPhysicalMaterial {
  const base = new THREE.Color(color)
  const opts: THREE.MeshPhysicalMaterialParameters = {
    color: map ? '#ffffff' : base,
    roughness: 0.55,
    metalness: 0,
  }
  if (map) opts.map = map
  const mat = new THREE.MeshPhysicalMaterial(opts)
  if (kind === 'skin') {
    mat.roughness = 0.38
    mat.sheen = 0.42
    mat.sheenColor = new THREE.Color('#ffc9a8')
    mat.clearcoat = 0.12
    mat.clearcoatRoughness = 0.65
  } else if (kind === 'jersey') {
    mat.roughness = 0.58
    mat.sheen = 0.65
    mat.sheenColor = base.clone().lerp(new THREE.Color('#ffffff'), 0.4)
    mat.clearcoat = 0.06
  } else if (kind === 'pants') {
    mat.roughness = 0.68
    mat.sheen = 0.25
    mat.sheenColor = new THREE.Color('#ffffff')
  } else if (kind === 'trim') {
    mat.roughness = 0.36
    mat.metalness = 0.12
    mat.clearcoat = 0.28
  } else if (kind === 'leather') {
    mat.roughness = 0.74
    mat.metalness = 0.06
    mat.sheen = 0.22
    mat.sheenColor = new THREE.Color('#c48a52')
  } else if (kind === 'rubber') {
    mat.roughness = 0.92
    mat.metalness = 0.02
  } else if (kind === 'plastic') {
    mat.roughness = 0.28
    mat.metalness = 0.18
    mat.clearcoat = 0.55
    mat.clearcoatRoughness = 0.22
  } else if (kind === 'wood') {
    mat.roughness = 0.42
    mat.metalness = 0.03
    mat.clearcoat = 0.32
    mat.clearcoatRoughness = 0.35
  } else if (kind === 'metal') {
    mat.roughness = 0.22
    mat.metalness = 0.72
    mat.clearcoat = 0.4
  }
  return mat
}

function softCapsule(radius: number, length: number, radial = 14, tubular = 8): THREE.CapsuleGeometry {
  const span = Math.max(length, radius * 2.05)
  return new THREE.CapsuleGeometry(radius, Math.max(0.02, span - radius * 2), tubular, radial)
}

function part(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  y = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = y
  mesh.scale.set(sx, sy, sz)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function lighten(hex: string, amount: number) {
  const c = new THREE.Color(hex)
  return `#${c.lerp(new THREE.Color('#ffffff'), amount).getHexString()}`
}

function darken(hex: string, amount: number) {
  const c = new THREE.Color(hex)
  return `#${c.lerp(new THREE.Color('#000000'), amount).getHexString()}`
}

function jerseyCanvas(team: Team, number: number, face: 'front' | 'back'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, lighten(team.primary, 0.18))
    g.addColorStop(0.45, team.primary)
    g.addColorStop(1, darken(team.primary, 0.22))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = team.secondary
    ctx.fillRect(0, 0, 512, 36)
    ctx.fillRect(0, 476, 512, 36)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    for (let i = 0; i < 16; i += 1) ctx.fillRect(0, 48 + i * 26, 512, 2)
    ctx.strokeStyle = lighten(team.secondary, 0.25)
    ctx.lineWidth = 10
    ctx.strokeRect(28, 56, 456, 400)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (face === 'back') {
      ctx.strokeStyle = team.secondary
      ctx.fillStyle = '#f8f5ec'
      ctx.lineWidth = 22
      ctx.font = '900 220px Pretendard, "Noto Sans KR", sans-serif'
      ctx.strokeText(String(number), 256, 290)
      ctx.fillText(String(number), 256, 290)
    } else {
      ctx.fillStyle = team.secondary
      ctx.beginPath()
      ctx.ellipse(256, 150, 58, 58, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#f8f5ec'
      ctx.lineWidth = 8
      ctx.stroke()
      ctx.fillStyle = '#f8f5ec'
      ctx.font = '900 132px Pretendard, "Noto Sans KR", sans-serif'
      ctx.fillText(String(number), 256, 310)
      ctx.font = '800 28px Pretendard, "Noto Sans KR", sans-serif'
      ctx.fillStyle = lighten(team.secondary, 0.35)
      ctx.fillText(team.short.slice(0, 4), 256, 430)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function faceCanvas(player: Player): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const skin = new THREE.Color(player.skin)
    const g = ctx.createRadialGradient(256, 250, 30, 256, 260, 300)
    g.addColorStop(0, `#${skin.clone().lerp(new THREE.Color('#ffe8d0'), 0.35).getHexString()}`)
    g.addColorStop(0.65, player.skin)
    g.addColorStop(1, darken(player.skin, 0.22))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 512)

    // cheek blush — mobile baseball card look
    ctx.fillStyle = 'rgba(232, 110, 98, 0.28)'
    ctx.beginPath()
    ctx.ellipse(150, 310, 52, 28, 0, 0, Math.PI * 2)
    ctx.ellipse(362, 310, 52, 28, 0, 0, Math.PI * 2)
    ctx.fill()

    // brows
    ctx.strokeStyle = player.hair
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(130, 200)
    ctx.quadraticCurveTo(185, 182, 235, 198)
    ctx.moveTo(277, 198)
    ctx.quadraticCurveTo(327, 182, 382, 200)
    ctx.stroke()

    // eyes — bold stylized
    const drawEye = (cx: number) => {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(cx, 236, 36, 24, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#1a1410'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.fillStyle = '#2a1810'
      ctx.beginPath()
      ctx.ellipse(cx + 3, 238, 16, 16, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#5a3a18'
      ctx.beginPath()
      ctx.ellipse(cx + 3, 238, 9, 9, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(cx - 4, 230, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    drawEye(185)
    drawEye(327)

    // nose
    ctx.strokeStyle = darken(player.skin, 0.28)
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(256, 250)
    ctx.quadraticCurveTo(274, 286, 256, 302)
    ctx.stroke()

    // mouth
    ctx.fillStyle = '#c45a58'
    ctx.beginPath()
    ctx.ellipse(256, 345, 34, 14, 0, 0, Math.PI)
    ctx.fill()
    ctx.strokeStyle = '#8a3030'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(222, 338)
    ctx.quadraticCurveTo(256, 358, 290, 338)
    ctx.stroke()

    // hair fringe
    ctx.fillStyle = player.hair
    ctx.beginPath()
    ctx.moveTo(40, 0)
    ctx.quadraticCurveTo(140, 110, 256, 85)
    ctx.quadraticCurveTo(372, 110, 472, 0)
    ctx.lineTo(512, 0)
    ctx.lineTo(0, 0)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function athleticTorso(height: number, thick: number): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(thick * 0.55, height * 0.02),
    new THREE.Vector2(thick * 1.45, height * 0.04),
    new THREE.Vector2(thick * 1.72, height * 0.12),
    new THREE.Vector2(thick * 1.82, height * 0.22),
    new THREE.Vector2(thick * 1.55, height * 0.3),
    new THREE.Vector2(thick * 1.35, height * 0.36),
  ]
  return new THREE.LatheGeometry(pts, 24)
}

function buildGlove(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const palm = part(new THREE.SphereGeometry(0.058, 18, 14), mat, 0, 1.4, 0.88, 1.6)
  g.add(palm)
  for (let i = 0; i < 4; i += 1) {
    const finger = part(softCapsule(0.015, 0.095, 8, 4), mat, -0.02)
    finger.position.set(-0.038 + i * 0.026, 0.025, 0.055)
    finger.rotation.x = -0.9 - i * 0.04
    g.add(finger)
  }
  const thumb = part(softCapsule(0.017, 0.075, 8, 4), mat, 0)
  thumb.position.set(0.058, 0.012, 0.022)
  thumb.rotation.set(-0.4, 0.55, 0.85)
  g.add(thumb)
  const web = part(new THREE.PlaneGeometry(0.055, 0.075), mat, 0)
  web.position.set(0.012, 0.032, 0.065)
  web.rotation.x = -0.9
  g.add(web)
  return g
}

function buildBat(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const barrel = part(new THREE.CylinderGeometry(0.034, 0.02, 0.6, 16), mat, 0.23)
  const handle = part(new THREE.CylinderGeometry(0.014, 0.016, 0.28, 12), mat, -0.18)
  const knob = part(new THREE.SphereGeometry(0.021, 14, 12), mat, -0.33)
  g.add(barrel, handle, knob)
  return g
}

function buildCleat(mat: THREE.Material, sole: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const body = part(new THREE.BoxGeometry(0.1, 0.058, 0.25), mat, -0.01)
  body.position.z = 0.052
  const toe = part(new THREE.SphereGeometry(0.044, 14, 12), mat, -0.004, 1.12, 0.78, 1.18)
  toe.position.set(0, 0, 0.155)
  const soleMesh = part(new THREE.BoxGeometry(0.105, 0.02, 0.26), sole, -0.042)
  soleMesh.position.z = 0.052
  g.add(body, toe, soleMesh)
  return g
}

function buildHand(skinMat: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const palm = part(new THREE.BoxGeometry(0.055, 0.028, 0.07), skinMat, 0)
  palm.position.set(0, -0.01, 0.02)
  g.add(palm)
  for (let i = 0; i < 4; i += 1) {
    const f = part(softCapsule(0.008, 0.045, 6, 3), skinMat, 0)
    f.position.set(-0.02 + i * 0.014, -0.01, 0.055)
    f.rotation.x = -0.35
    g.add(f)
  }
  const thumb = part(softCapsule(0.009, 0.035, 6, 3), skinMat, 0)
  thumb.position.set(0.03, -0.005, 0.02)
  thumb.rotation.set(0.2, 0.4, 1.1)
  g.add(thumb)
  return g
}

export function createFigure(player: Player, team: Team): Figure {
  const height = player.body.heightCm / 100
  const leg = height * 0.45 * player.body.legLength
  const thigh = leg * 0.52
  const shin = leg * 0.44
  const spineLen = height * 0.1
  const chestLen = height * 0.18
  const headR = height * 0.078 * player.body.headScale
  const shoulder = height * 0.26 * player.body.shoulder
  const arm = height * 0.34 * player.body.armLength
  const upper = arm * 0.5
  const fore = arm * 0.44
  const thick = 0.05 + player.body.build * 0.04

  const paintedFace = faceCanvas(player)
  const skinMat = makeMat('skin', player.skin)
  const faceMat = makeMat('skin', '#ffffff', paintedFace)
  const jerseyMat = makeMat('jersey', team.primary)
  const pantsMat = makeMat('pants', '#f4f0e6')
  const trimMat = makeMat('trim', team.secondary)
  const leatherMat = makeMat('leather', '#7a4024')
  const shoeMat = makeMat('rubber', '#111111')
  const soleMat = makeMat('rubber', '#c81d25')
  const woodMat = makeMat('wood', '#c99552')
  const helmetMat = makeMat('plastic', team.primary)
  const hairMat = makeMat('rubber', player.hair)

  const frontTex = jerseyCanvas(team, player.number, 'front')
  const backTex = jerseyCanvas(team, player.number, 'back')
  const frontMat = makeMat('jersey', '#ffffff', frontTex)
  const backMat = makeMat('jersey', '#ffffff', backTex)

  const root = new THREE.Group()
  root.scale.setScalar(1.06)
  const offset = new THREE.Group()
  root.add(offset)
  const bones = {} as Record<BoneName, THREE.Group>
  for (const name of BONE_NAMES) bones[name] = new THREE.Group()

  bones.hips.position.y = thigh + shin
  offset.add(bones.hips)
  const pelvis = part(softCapsule(thick * 1.5, 0.15, 16, 6), jerseyMat, -0.02, 1.4, 1, 1.1)
  bones.hips.add(pelvis)
  const belt = part(new THREE.TorusGeometry(thick * 1.55, 0.014, 8, 28), trimMat, 0.025, 1.2, 1, 0.88)
  belt.rotation.x = Math.PI / 2
  bones.hips.add(belt)

  bones.thighL.position.set(-thick * 1.28, 0, 0)
  bones.thighR.position.set(thick * 1.28, 0, 0)
  bones.hips.add(bones.thighL, bones.thighR)
  const thighL = part(softCapsule(thick * 1.02, thigh, 16, 8), pantsMat, -thigh / 2, 1.2, 1, 1.15)
  const thighR = part(softCapsule(thick * 1.02, thigh, 16, 8), pantsMat, -thigh / 2, 1.2, 1, 1.15)
  bones.thighL.add(thighL)
  bones.thighR.add(thighR)
  const stripeL = part(new THREE.BoxGeometry(0.018, thigh * 0.85, 0.01), trimMat, -thigh / 2)
  stripeL.position.x = -thick * 1.05
  const stripeR = part(new THREE.BoxGeometry(0.018, thigh * 0.85, 0.01), trimMat, -thigh / 2)
  stripeR.position.x = thick * 1.05
  bones.thighL.add(stripeL)
  bones.thighR.add(stripeR)

  bones.shinL.position.y = -thigh
  bones.shinR.position.y = -thigh
  bones.thighL.add(bones.shinL)
  bones.thighR.add(bones.shinR)
  bones.shinL.add(part(softCapsule(thick * 0.78, shin, 14, 8), pantsMat, -shin / 2, 1.08, 1, 1.08))
  bones.shinR.add(part(softCapsule(thick * 0.78, shin, 14, 8), pantsMat, -shin / 2, 1.08, 1, 1.08))
  const sockL = part(softCapsule(thick * 0.52, shin * 0.38, 12, 4), trimMat, -shin * 0.78)
  const sockR = part(softCapsule(thick * 0.52, shin * 0.38, 12, 4), trimMat, -shin * 0.78)
  bones.shinL.add(sockL)
  bones.shinR.add(sockR)
  bones.footL.position.y = -shin
  bones.footR.position.y = -shin
  bones.shinL.add(bones.footL)
  bones.shinR.add(bones.footR)
  bones.footL.add(buildCleat(shoeMat, soleMat))
  bones.footR.add(buildCleat(shoeMat, soleMat))

  bones.spine.position.y = 0.04
  bones.hips.add(bones.spine)
  bones.spine.add(part(softCapsule(thick * 1.2, spineLen, 16, 6), jerseyMat, -spineLen / 2, 1.25, 1, 1.08))
  bones.chest.position.y = spineLen
  bones.spine.add(bones.chest)

  const torso = part(athleticTorso(chestLen * 1.35, thick), jerseyMat, -chestLen * 0.08)
  bones.chest.add(torso)
  const collar = part(new THREE.TorusGeometry(thick * 0.95, 0.02, 8, 22), trimMat, chestLen * 0.26, 1.12, 1, 0.92)
  collar.rotation.x = Math.PI / 2
  bones.chest.add(collar)
  const frontPanel = part(new THREE.PlaneGeometry(0.24, 0.3), frontMat, 0)
  frontPanel.position.set(0, -chestLen * 0.02, thick * 1.95)
  bones.chest.add(frontPanel)
  const backPanel = part(new THREE.PlaneGeometry(0.3, 0.34), backMat, 0)
  backPanel.position.set(0, -chestLen * 0.05, -thick * 1.95)
  backPanel.rotation.y = Math.PI
  bones.chest.add(backPanel)

  bones.neck.position.y = chestLen * 0.3
  bones.chest.add(bones.neck)
  bones.neck.add(part(softCapsule(thick * 0.4, height * 0.05, 14, 4), skinMat, -height * 0.015))
  bones.head.position.y = height * 0.068
  bones.neck.add(bones.head)

  // stylized head: slightly larger, jaw, painted face plane
  const skull = part(new THREE.SphereGeometry(headR, 32, 24), skinMat, 0, 0.9, 1.08, 0.92)
  bones.head.add(skull)
  const jaw = part(new THREE.SphereGeometry(headR * 0.7, 20, 16), skinMat, -headR * 0.38, 0.98, 0.68, 0.88)
  bones.head.add(jaw)
  const facePlane = part(new THREE.CircleGeometry(headR * 0.88, 36), faceMat, 0)
  facePlane.position.set(0, -headR * 0.02, headR * 0.88)
  bones.head.add(facePlane)
  // 3D facial landmarks so faces read even when canvas maps soften
  const eyeWhite = makeMat('skin', '#f5f5f5')
  const eyeIris = makeMat('rubber', '#1a1410')
  for (const side of [-1, 1]) {
    const white = part(new THREE.SphereGeometry(headR * 0.13, 12, 10), eyeWhite, 0, 1.15, 0.85, 0.7)
    white.position.set(side * headR * 0.32, headR * 0.08, headR * 0.95)
    const iris = part(new THREE.SphereGeometry(headR * 0.07, 10, 8), eyeIris, 0)
    iris.position.set(side * headR * 0.32, headR * 0.08, headR * 1.02)
    bones.head.add(white, iris)
  }
  const nose = part(new THREE.SphereGeometry(headR * 0.08, 10, 8), skinMat, 0, 0.7, 1.1, 1.2)
  nose.position.set(0, -headR * 0.05, headR * 1.0)
  bones.head.add(nose)
  const lip = part(new THREE.SphereGeometry(headR * 0.1, 10, 8), makeMat('skin', '#b45050'), 0, 1.35, 0.35, 0.55)
  lip.position.set(0, -headR * 0.35, headR * 0.92)
  bones.head.add(lip)
  const earL = part(new THREE.SphereGeometry(headR * 0.24, 12, 10), skinMat, 0, 0.5, 1.05, 0.65)
  earL.position.set(-headR * 0.9, 0, 0)
  const earR = part(new THREE.SphereGeometry(headR * 0.24, 12, 10), skinMat, 0, 0.5, 1.05, 0.65)
  earR.position.set(headR * 0.9, 0, 0)
  bones.head.add(earL, earR)
  const hair = part(
    new THREE.SphereGeometry(headR * 1.05, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat,
    headR * 0.18,
  )
  bones.head.add(hair)
  const bang = part(new THREE.SphereGeometry(headR * 0.48, 16, 12, 0, Math.PI, 0, Math.PI * 0.5), hairMat, headR * 0.28, 1.35, 0.45, 0.6)
  bang.position.z = headR * 0.35
  bang.rotation.x = 0.25
  bones.head.add(bang)

  const cap = new THREE.Group()
  const crown = part(
    new THREE.SphereGeometry(headR * 1.12, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
    jerseyMat,
    headR * 0.12,
  )
  const seam = part(
    new THREE.SphereGeometry(headR * 1.13, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.32),
    trimMat,
    headR * 0.24,
    1,
    0.65,
    1,
  )
  const brim = part(new THREE.BoxGeometry(headR * 1.5, 0.02, headR * 1.1), trimMat, 0)
  brim.position.set(0, headR * 0.02, headR * 0.82)
  brim.rotation.x = -0.2
  cap.add(crown, seam, brim)
  const badge = part(new THREE.CircleGeometry(headR * 0.34, 22), makeMat('trim', '#ffffff'), 0)
  badge.position.set(0, headR * 0.4, headR * 0.88)
  cap.add(badge)
  if (team.emblem) {
    const logo = new Image()
    logo.onload = () => {
      const tex = new THREE.Texture(logo)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      ;(badge.material as THREE.MeshPhysicalMaterial).map = tex
      ;(badge.material as THREE.MeshPhysicalMaterial).needsUpdate = true
    }
    logo.src = team.emblem
  } else {
    const badgeCanvas = document.createElement('canvas')
    badgeCanvas.width = 128
    badgeCanvas.height = 128
    const bctx = badgeCanvas.getContext('2d')
    if (bctx) {
      bctx.fillStyle = team.secondary
      bctx.beginPath()
      bctx.arc(64, 64, 58, 0, Math.PI * 2)
      bctx.fill()
      bctx.fillStyle = '#f8f5ec'
      bctx.font = '900 48px Pretendard, sans-serif'
      bctx.textAlign = 'center'
      bctx.textBaseline = 'middle'
      bctx.fillText(team.short.slice(0, 2), 64, 68)
      const tex = new THREE.CanvasTexture(badgeCanvas)
      tex.colorSpace = THREE.SRGBColorSpace
      ;(badge.material as THREE.MeshPhysicalMaterial).map = tex
      ;(badge.material as THREE.MeshPhysicalMaterial).needsUpdate = true
    }
  }
  bones.head.add(cap)

  const helmet = new THREE.Group()
  const shell = part(
    new THREE.SphereGeometry(headR * 1.18, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.7),
    helmetMat,
    headR * 0.06,
  )
  const earFlap = part(new THREE.BoxGeometry(headR * 0.4, headR * 0.75, headR * 0.24), helmetMat, 0)
  earFlap.position.set(player.bats === 'L' ? headR * 1.0 : -headR * 1.0, -headR * 0.08, 0)
  const grill = part(new THREE.TorusGeometry(headR * 0.58, 0.012, 6, 20, Math.PI), makeMat('metal', '#d4d8dc'), 0)
  grill.position.set(0, -headR * 0.12, headR * 0.58)
  grill.rotation.x = 0.38
  helmet.add(shell, earFlap, grill)
  helmet.visible = false
  bones.head.add(helmet)

  const gloveSide = player.throws === 'R' ? 'L' : 'R'
  const batSide = player.bats === 'L' ? 'L' : 'R'
  bones.shoulderL.position.set(-shoulder / 2, chestLen * 0.2, 0)
  bones.shoulderR.position.set(shoulder / 2, chestLen * 0.2, 0)
  bones.chest.add(bones.shoulderL, bones.shoulderR)
  bones.shoulderL.add(part(new THREE.SphereGeometry(thick * 0.75, 16, 14), jerseyMat, 0, 1.2, 0.92, 1.1))
  bones.shoulderR.add(part(new THREE.SphereGeometry(thick * 0.75, 16, 14), jerseyMat, 0, 1.2, 0.92, 1.1))
  bones.shoulderL.add(part(softCapsule(thick * 0.55, upper, 14, 8), jerseyMat, -upper / 2, 1.18, 1, 1.12))
  bones.shoulderR.add(part(softCapsule(thick * 0.55, upper, 14, 8), jerseyMat, -upper / 2, 1.18, 1, 1.12))
  const cuffL = part(new THREE.TorusGeometry(thick * 0.52, 0.012, 6, 16), trimMat, -upper * 0.92)
  cuffL.rotation.x = Math.PI / 2
  const cuffR = part(new THREE.TorusGeometry(thick * 0.52, 0.012, 6, 16), trimMat, -upper * 0.92)
  cuffR.rotation.x = Math.PI / 2
  bones.shoulderL.add(cuffL)
  bones.shoulderR.add(cuffR)

  bones.elbowL.position.y = -upper
  bones.elbowR.position.y = -upper
  bones.shoulderL.add(bones.elbowL)
  bones.shoulderR.add(bones.elbowR)
  bones.elbowL.add(part(softCapsule(thick * 0.42, fore, 14, 8), skinMat, -fore / 2))
  bones.elbowR.add(part(softCapsule(thick * 0.42, fore, 14, 8), skinMat, -fore / 2))
  bones.wristL.position.y = -fore
  bones.wristR.position.y = -fore
  bones.elbowL.add(bones.wristL)
  bones.elbowR.add(bones.wristR)
  bones.wristL.add(buildHand(skinMat))
  bones.wristR.add(buildHand(skinMat))

  const glove = buildGlove(leatherMat)
  ;(gloveSide === 'L' ? bones.wristL : bones.wristR).add(glove)

  const bat = buildBat(woodMat)
  bat.rotation.set(-1.15, 0, batSide === 'L' ? 0.5 : -0.5)
  bat.position.set(batSide === 'L' ? 0.06 : -0.06, -0.01, -0.12)
  bat.visible = false
  ;(batSide === 'L' ? bones.wristL : bones.wristR).add(bat)

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 28),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.012
  root.add(shadow)

  const disposables: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const textures: THREE.Texture[] = [frontTex, backTex, paintedFace]
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
      hair.visible = gear.hat !== 'helmet'
      bang.visible = gear.hat !== 'helmet'
    },
    hand: (side) => {
      const node = side === 'L' ? bones.wristL : bones.wristR
      node.getWorldPosition(handVec)
      return handVec
    },
    dispose: () => {
      disposables.forEach((geo) => geo.dispose())
      materials.forEach((material) => material.dispose())
      textures.forEach((tex) => tex.dispose())
    },
  }
}

export function createUmpire(id: string): Figure {
  const player = {
    id,
    teamId: '',
    name: '심판',
    number: 0,
    position: 'C' as const,
    bats: 'R' as const,
    throws: 'R' as const,
    body: { heightCm: 180, build: 0.48, shoulder: 1.05, armLength: 1, legLength: 1, headScale: 1 },
    skin: '#b5815d',
    hair: '#241810',
    faceStyle: 'photo' as const,
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
    primary: '#1a1a1a',
    secondary: '#d8d8d8',
  }
  return createFigure(player, team)
}
