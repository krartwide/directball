import * as THREE from 'three'
import { fenceDistance, fenceHeight, type Stadium } from '../data/stadiums.ts'
import { BASES, MOUND_M, PLATE_W } from '../lib/field.ts'

export type BoardInfo = {
  away: string
  home: string
  awayScore: number
  homeScore: number
  inning: string
  note: string
}

export type Park = {
  group: THREE.Group
  crowd: THREE.InstancedMesh
  crowdBase: Float32Array
  crowdYaw: Float32Array
  updateBoard: (info: BoardInfo) => void
  setZone: (heightCm: number | null) => void
  dispose: () => void
}

function px(x: number, z: number, size = 2048): [number, number] {
  return [((x + 80) / 160) * size, ((z + 25) / 160) * size]
}

function drawField(stadium: Stadium): THREE.CanvasTexture {
  const size = 2048
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  const grassA = stadium.turf === 'artificial' ? '#249e52' : '#2aa854'
  const grassB = stadium.turf === 'artificial' ? '#1d8a45' : '#228a46'
  const grassC = stadium.turf === 'artificial' ? '#17753a' : '#1b743c'
  const grassD = stadium.turf === 'artificial' ? '#126432' : '#166434'
  // mowing stripes — V26-style broadcast look
  for (let i = 0; i < size; i += 22) {
    const band = Math.floor(i / 22) % 4
    ctx.fillStyle = band === 0 ? grassA : band === 1 ? grassB : band === 2 ? grassC : grassD
    ctx.fillRect(i, 0, 22, size)
  }
  // fine grain
  const noise = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < noise.data.length; i += 12) {
    const n = ((i * 17) % 21) - 10
    noise.data[i] = Math.max(0, Math.min(255, noise.data[i]! + n))
    noise.data[i + 1] = Math.max(0, Math.min(255, noise.data[i + 1]! + n))
    noise.data[i + 2] = Math.max(0, Math.min(255, noise.data[i + 2]! + Math.floor(n * 0.45)))
  }
  ctx.putImageData(noise, 0, 0)
  // warning track
  ctx.fillStyle = '#d2b888'
  ctx.beginPath()
  ctx.moveTo(...px(Math.sin((-45 * Math.PI) / 180) * (stadium.lf - 6), Math.cos((-45 * Math.PI) / 180) * (stadium.lf - 6)))
  for (let a = -45; a <= 45; a += 3) {
    const r = fenceDistance(a, stadium) - 1.0
    const rad = (a * Math.PI) / 180
    ctx.lineTo(...px(Math.sin(rad) * r, Math.cos(rad) * r))
  }
  for (let a = 45; a >= -45; a -= 3) {
    const r = fenceDistance(a, stadium) - 7.2
    const rad = (a * Math.PI) / 180
    ctx.lineTo(...px(Math.sin(rad) * r, Math.cos(rad) * r))
  }
  ctx.fill()
  const dirt = (x: number, z: number, rx: number, rz: number) => {
    const [cx, cy] = px(x, z, size)
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, (rx / 160) * size)
    grad.addColorStop(0, '#d8b478')
    grad.addColorStop(0.55, '#c49a5c')
    grad.addColorStop(0.85, '#b08248')
    grad.addColorStop(1, '#946838')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(cx, cy, (rx / 160) * size, (rz / 160) * size, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  dirt(0, 18, 24, 21)
  dirt(0, 1.15, 5.8, 4.4)
  // base cutouts
  for (const base of [BASES.first, BASES.second, BASES.third]) {
    dirt(base.x, base.z, 2.2, 2.0)
  }
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#e0c490'
  ctx.lineWidth = (2.8 / 160) * size
  const path = (x0: number, z0: number, x1: number, z1: number) => {
    const a = px(x0, z0, size)
    const b = px(x1, z1, size)
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.stroke()
  }
  path(0, 0, BASES.first.x, BASES.first.z)
  path(BASES.first.x, BASES.first.z, BASES.second.x, BASES.second.z)
  path(BASES.second.x, BASES.second.z, BASES.third.x, BASES.third.z)
  path(BASES.third.x, BASES.third.z, 0, 0)
  // batter boxes
  ctx.fillStyle = '#e2c792'
  for (const side of [-1, 1]) {
    const [bx, by] = px(side * 1.05, -0.55, size)
    ctx.fillRect(bx - 10, by - 18, 20, 36)
  }
  // chalk diamonds
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = (0.4 / 160) * size
  for (const base of [BASES.first, BASES.second, BASES.third]) {
    const [cx, cy] = px(base.x, base.z, size)
    ctx.strokeRect(cx - 9, cy - 9, 18, 18)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function wallMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.06 })
}

export function buildPark(stadium: Stadium, night: boolean): Park {
  const group = new THREE.Group()
  const disposables: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const keep = (mesh: THREE.Mesh) => {
    disposables.push(mesh.geometry)
    const material = mesh.material
    if (!Array.isArray(material)) materials.push(material)
    return mesh
  }

  const field = keep(
    new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({
        map: drawField(stadium),
        roughness: 0.82,
        metalness: 0.03,
        envMapIntensity: 0.45,
      }),
    ),
  )
  field.rotation.x = -Math.PI / 2
  field.position.set(0, 0, 55)
  field.receiveShadow = true
  group.add(field)
  const apron = keep(
    new THREE.Mesh(
      new THREE.CircleGeometry(58, 48),
      new THREE.MeshStandardMaterial({ color: '#1a2420', roughness: 1 }),
    ),
  )
  apron.rotation.x = -Math.PI / 2
  apron.position.y = -0.04
  apron.receiveShadow = true
  group.add(apron)

  // stadium bowl — stepped bleacher decks (V26 broadcast silhouette)
  const bowlMat = new THREE.MeshStandardMaterial({ color: '#3a4450', roughness: 0.82, metalness: 0.1 })
  const railMat = new THREE.MeshStandardMaterial({ color: '#d8dde4', roughness: 0.45, metalness: 0.25 })
  materials.push(bowlMat, railMat)
  for (let deck = 0; deck < 3; deck += 1) {
    for (let step = 0; step < 5; step += 1) {
      const radius = 22 + deck * 9 + step * 1.35
      const y = 1.1 + deck * 4.6 + step * 0.72
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 1.2, radius, 0.55, 64, 1, true, Math.PI * 0.42, Math.PI * 1.16),
        bowlMat,
      )
      disposables.push(ring.geometry)
      ring.position.set(0, y, 3)
      ring.castShadow = true
      ring.receiveShadow = true
      group.add(ring)
    }
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(26 + deck * 9, 0.08, 6, 64, Math.PI * 1.16),
      railMat,
    )
    disposables.push(rail.geometry)
    rail.rotation.x = Math.PI / 2
    rail.rotation.z = Math.PI * 0.42
    rail.position.set(0, 4.2 + deck * 4.6, 3)
    group.add(rail)
  }

  const mound = keep(
    new THREE.Mesh(
      new THREE.CylinderGeometry(2.7, 3.05, 0.32, 28),
      new THREE.MeshStandardMaterial({ color: '#d0ac72', roughness: 0.92 }),
    ),
  )
  mound.position.set(0, 0.16, MOUND_M - 0.2)
  mound.receiveShadow = true
  mound.castShadow = true
  group.add(mound)
  const rubber = keep(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.02, 0.15),
      new THREE.MeshStandardMaterial({ color: '#f4f4f4' }),
    ),
  )
  rubber.position.set(0, 0.3, MOUND_M)
  group.add(rubber)

  const plate = new THREE.Shape()
  const hw = PLATE_W / 2
  plate.moveTo(0, 0.2)
  plate.lineTo(hw, 0.2 + hw)
  plate.lineTo(hw, 0.2 + hw + 0.22)
  plate.lineTo(-hw, 0.2 + hw + 0.22)
  plate.lineTo(-hw, 0.2 + hw)
  plate.closePath()
  const plateMesh = keep(
    new THREE.Mesh(
      new THREE.ShapeGeometry(plate),
      new THREE.MeshStandardMaterial({ color: '#f7f7f7', roughness: 0.45 }),
    ),
  )
  plateMesh.rotation.x = -Math.PI / 2
  plateMesh.position.y = 0.03
  group.add(plateMesh)

  for (const base of [BASES.first, BASES.second, BASES.third]) {
    const bag = keep(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.08, 0.38),
        new THREE.MeshStandardMaterial({ color: '#f4f4f4' }),
      ),
    )
    bag.position.set(base.x, 0.05, base.z)
    bag.rotation.y = Math.PI / 4
    group.add(bag)
  }

  const chalk = new THREE.MeshStandardMaterial({ color: '#e8e4da', roughness: 0.92, metalness: 0 })
  materials.push(chalk)
  const foul = (angleDeg: number, dist: number) => {
    const rad = (angleDeg * Math.PI) / 180
    const x = Math.sin(rad) * dist
    const z = Math.cos(rad) * dist
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, dist), chalk)
    disposables.push(mesh.geometry)
    mesh.position.set(x / 2, 0.03, z / 2)
    mesh.rotation.y = Math.atan2(x, z)
    group.add(mesh)
    const pole = keep(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 14, 8),
        new THREE.MeshStandardMaterial({ color: '#f2d24b', roughness: 0.4 }),
      ),
    )
    pole.position.set(x, 7, z)
    group.add(pole)
  }
  foul(-45, stadium.lf)
  foul(45, stadium.rf)

  const pad = wallMaterial('#0f4a30')
  const monsterMat = wallMaterial('#24804a')
  materials.push(pad, monsterMat)
  const adColors = ['#f4f1e6', '#1e5bb8', '#c81d25', '#222222', '#e8b84a', stadium.accent || '#f0b429']
  for (let angle = -45; angle < 45; angle += 3) {
    const a0 = (angle * Math.PI) / 180
    const a1 = ((angle + 3) * Math.PI) / 180
    const d0 = fenceDistance(angle, stadium)
    const d1 = fenceDistance(angle + 3, stadium)
    const h = Math.max(fenceHeight(angle, stadium), fenceHeight(angle + 3, stadium))
    const x0 = Math.sin(a0) * d0
    const z0 = Math.cos(a0) * d0
    const x1 = Math.sin(a1) * d1
    const z1 = Math.cos(a1) * d1
    const len = Math.hypot(x1 - x0, z1 - z0) + 0.35
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, h, len), h > stadium.wall + 1 ? monsterMat : pad)
    disposables.push(mesh.geometry)
    mesh.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2)
    mesh.rotation.y = Math.atan2(x1 - x0, z1 - z0)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    // outfield advertising ribbon
    if (angle % 6 === 0) {
      const adIdx = Math.abs(Math.floor((angle + 45) / 6)) % adColors.length
      const adMat = new THREE.MeshStandardMaterial({
        color: adColors[adIdx] ?? '#f4f1e6',
        roughness: 0.55,
        metalness: 0.05,
        emissive: night ? '#222018' : '#000000',
        emissiveIntensity: night ? 0.15 : 0,
      })
      materials.push(adMat)
      const ad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, len * 1.8), adMat)
      disposables.push(ad.geometry)
      const mid = fenceDistance(angle + 1.5, stadium) - 0.6
      const rad = ((angle + 1.5) * Math.PI) / 180
      ad.position.set(Math.sin(rad) * mid, 1.0, Math.cos(rad) * mid)
      ad.rotation.y = Math.atan2(x1 - x0, z1 - z0)
      group.add(ad)
    }
  }

  const label = (text: string, angle: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#f4f1e6'
    ctx.fillRect(0, 0, 256, 128)
    ctx.fillStyle = '#102018'
    ctx.font = '700 72px Pretendard, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 64)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
    materials.push(mat)
    const dist = fenceDistance(angle, stadium)
    const rad = (angle * Math.PI) / 180
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.5), mat)
    disposables.push(mesh.geometry)
    mesh.position.set(Math.sin(rad) * (dist - 0.4), Math.min(fenceHeight(angle, stadium) - 0.8, 3.2), Math.cos(rad) * (dist - 0.4))
    mesh.lookAt(0, mesh.position.y, 0)
    group.add(mesh)
  }
  label(`${Math.round(stadium.lf)}`, -40)
  label(`${Math.round(stadium.cf)}`, 0)
  label(`${Math.round(stadium.rf)}`, 40)

  const boardCanvas = document.createElement('canvas')
  boardCanvas.width = 1024
  boardCanvas.height = 280
  const boardCtx = boardCanvas.getContext('2d')
  const boardTex = new THREE.CanvasTexture(boardCanvas)
  boardTex.colorSpace = THREE.SRGBColorSpace
  const boardMat = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6, emissive: '#141008', emissiveIntensity: night ? 0.4 : 0.05 })
  materials.push(boardMat)
  const board = new THREE.Mesh(new THREE.PlaneGeometry(26, 7.2), boardMat)
  disposables.push(board.geometry)
  board.position.set(0, fenceHeight(0, stadium) + 6.2, stadium.cf + 1.2)
  board.rotation.y = Math.PI
  group.add(board)

  const seatGeo = new THREE.CapsuleGeometry(0.14, 0.42, 3, 8)
  disposables.push(seatGeo)
  const positions: number[] = []
  const yaws: number[] = []
  const cols: number[] = []
  const colorA = new THREE.Color(stadium.seatA)
  const colorB = new THREE.Color(stadium.seatB)
  const pushSeat = (x: number, y: number, z: number, yaw: number, mix: number) => {
    positions.push(x, y, z)
    yaws.push(yaw)
    const c = colorA.clone().lerp(colorB, mix)
    cols.push(c.r, c.g, c.b)
  }
  for (let deck = 0; deck < 2; deck += 1) {
    for (let row = 0; row < 12; row += 1) {
      const radius = 20 + deck * 8 + row * 0.82
      const y = 1.4 + deck * 4.2 + row * 0.38
      for (let angle = 115; angle <= 245; angle += 2.15) {
        const rad = (angle * Math.PI) / 180
        pushSeat(Math.sin(rad) * radius, y, Math.cos(rad) * radius + 2, rad + Math.PI, (row + deck) % 3 === 0 ? 1 : 0)
      }
    }
  }
  for (let row = 0; row < 8; row += 1) {
    const y = 2 + row * 0.55
    for (let angle = -42; angle <= 42; angle += 2.4) {
      if (Math.abs(angle) < 10) continue
      const rad = (angle * Math.PI) / 180
      const dist = fenceDistance(angle, stadium) + 8 + row * 0.9
      pushSeat(Math.sin(rad) * dist, y, Math.cos(rad) * dist, rad + Math.PI, row % 2)
    }
  }
  const crowd = new THREE.InstancedMesh(
    seatGeo,
    new THREE.MeshStandardMaterial({
      roughness: 0.68,
      metalness: 0.04,
      vertexColors: false,
      emissive: night ? '#101018' : '#000000',
      emissiveIntensity: night ? 0.12 : 0,
    }),
    positions.length / 3,
  )
  materials.push(crowd.material as THREE.Material)
  const dummy = new THREE.Object3D()
  const tint = new THREE.Color()
  for (let i = 0; i < positions.length / 3; i += 1) {
    dummy.position.set(positions[i * 3] ?? 0, positions[i * 3 + 1] ?? 0, positions[i * 3 + 2] ?? 0)
    dummy.rotation.y = yaws[i] ?? 0
    dummy.scale.set(1.65, 1.35, 1.65)
    dummy.updateMatrix()
    crowd.setMatrixAt(i, dummy.matrix)
    tint.setRGB(cols[i * 3] ?? 1, cols[i * 3 + 1] ?? 1, cols[i * 3 + 2] ?? 1)
    tint.offsetHSL(0, 0.08, night ? 0.06 : 0)
    crowd.setColorAt(i, tint)
  }
  crowd.instanceMatrix.needsUpdate = true
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true
  group.add(crowd)

  const dugoutMat = new THREE.MeshStandardMaterial({ color: '#14181c', roughness: 0.8 })
  materials.push(dugoutMat)
  for (const side of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.16, 2.6), dugoutMat)
    disposables.push(roof.geometry)
    roof.position.set(side * 13, 2.35, -1.4)
    const wall = new THREE.Mesh(new THREE.BoxGeometry(8, 1.3, 0.16), dugoutMat)
    disposables.push(wall.geometry)
    wall.position.set(side * 13, 0.7, -2.5)
    group.add(roof, wall)
  }

  if (!stadium.dome) {
    for (let i = 0; i < 18; i += 1) {
      const h = 8 + ((i * 37) % 28)
      const x = -70 + (i % 9) * 18
      const z = 120 + Math.floor(i / 9) * 16
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(8, h, 8),
        new THREE.MeshStandardMaterial({ color: i % 2 ? '#1c2832' : '#24303a', roughness: 0.9 }),
      )
      disposables.push(block.geometry)
      materials.push(block.material as THREE.Material)
      block.position.set(x, h / 2, z)
      group.add(block)
    }
  } else {
    const dome = keep(
      new THREE.Mesh(
        new THREE.SphereGeometry(168, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: '#161a20',
          side: THREE.BackSide,
          roughness: 0.7,
          metalness: 0.25,
        }),
      ),
    )
    dome.position.set(0, -8, 28)
    group.add(dome)
  }

  const sky = keep(
    new THREE.Mesh(
      new THREE.SphereGeometry(420, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          top: { value: new THREE.Color(night ? '#0a1524' : stadium.skyTop) },
          horizon: { value: new THREE.Color(night ? '#2a3548' : stadium.skyHorizon) },
        },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader:
          'varying vec3 vP; uniform vec3 top; uniform vec3 horizon; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(horizon, top, smoothstep(-0.08, 0.55, h)), 1.0); }',
      }),
    ),
  )
  group.add(sky)

  // broadcast stadium lighting — bright but not washed out
  const hemi = new THREE.HemisphereLight(night ? '#c8d6ea' : '#fff6e8', night ? '#2e4e38' : '#4d8a45', night ? 1.05 : 1.15)
  group.add(hemi)
  const amb = new THREE.AmbientLight(night ? '#8898b0' : '#fff0d8', night ? 0.32 : 0.28)
  group.add(amb)
  const sun = new THREE.DirectionalLight(night ? '#eef2ff' : '#fff2d8', night ? 1.55 : 2.6)
  sun.position.set(-22, 42, 18)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0002
  sun.shadow.normalBias = 0.03
  sun.shadow.camera.near = 8
  sun.shadow.camera.far = 150
  sun.shadow.camera.left = -55
  sun.shadow.camera.right = 55
  sun.shadow.camera.top = 55
  sun.shadow.camera.bottom = -55
  group.add(sun)
  const fill = new THREE.DirectionalLight(night ? '#9ab4e8' : '#b8d8ff', night ? 0.55 : 0.55)
  fill.position.set(30, 24, -10)
  group.add(fill)
  const back = new THREE.DirectionalLight(night ? '#ffd9a0' : '#ffe8c8', night ? 0.4 : 0.35)
  back.position.set(0, 18, -40)
  group.add(back)
  if (night || stadium.dome) {
    const spots: Array<[number, number, number]> = [
      [-78, 8, 18],
      [78, 8, 18],
      [-70, 96, 36],
      [70, 96, 36],
      [-40, -12, 8],
      [40, -12, 8],
    ]
    for (const [x, z, aim] of spots) {
      const pole = keep(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.32, 36, 8),
          new THREE.MeshStandardMaterial({ color: '#2a3038', metalness: 0.55, roughness: 0.4 }),
        ),
      )
      pole.position.set(x, 18, z)
      group.add(pole)
      const lamp = keep(
        new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 0.45, 1.4),
          new THREE.MeshStandardMaterial({
            color: '#fff8e0',
            emissive: '#fff4cc',
            emissiveIntensity: night ? 2.6 : 0.9,
            roughness: 0.3,
          }),
        ),
      )
      lamp.position.set(x, 34.2, z)
      group.add(lamp)
      const glow = keep(
        new THREE.Mesh(
          new THREE.SphereGeometry(1.6, 12, 10),
          new THREE.MeshBasicMaterial({ color: '#fff6d0', transparent: true, opacity: night ? 0.16 : 0.06 }),
        ),
      )
      glow.position.set(x, 34, z)
      group.add(glow)
      const spot = new THREE.SpotLight('#fff4d8', stadium.dome || night ? 6500 : 2200, 160, 0.68, 0.32, 1.65)
      spot.position.set(x, 34, z)
      spot.target.position.set(0, 0, aim)
      group.add(spot, spot.target)
    }
  }

  let boardKey = ''
  const updateBoard = (info: BoardInfo) => {
    const key = `${info.away}${info.home}${info.awayScore}${info.homeScore}${info.inning}${info.note}`
    if (key === boardKey || !boardCtx) return
    boardKey = key
    boardCtx.fillStyle = '#07110c'
    boardCtx.fillRect(0, 0, 1024, 280)
    boardCtx.fillStyle = stadium.accent
    boardCtx.fillRect(0, 0, 1024, 8)
    boardCtx.font = '700 42px Pretendard, sans-serif'
    boardCtx.fillStyle = '#d5e2d8'
    boardCtx.textAlign = 'left'
    boardCtx.fillText(info.away, 36, 78)
    boardCtx.textAlign = 'right'
    boardCtx.fillText(info.home, 988, 78)
    boardCtx.font = '700 108px "Chivo Mono", Pretendard, sans-serif'
    boardCtx.fillStyle = '#f7f4ea'
    boardCtx.textAlign = 'center'
    boardCtx.fillText(`${info.awayScore}  :  ${info.homeScore}`, 512, 150)
    boardCtx.font = '700 36px Pretendard, sans-serif'
    boardCtx.fillStyle = stadium.accent
    boardCtx.fillText(info.inning, 512, 214)
    boardCtx.fillStyle = '#9eb5a6'
    boardCtx.font = '600 28px Pretendard, sans-serif'
    boardCtx.fillText(info.note, 512, 256)
    boardTex.needsUpdate = true
  }

  const zoneGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(PLATE_W, 0.6, 0.02))
  disposables.push(zoneGeo)
  const zone = new THREE.LineSegments(
    zoneGeo,
    new THREE.LineBasicMaterial({ color: '#3ddecb', transparent: true, opacity: 0.9 }),
  )
  materials.push(zone.material as THREE.Material)
  zone.visible = false
  zone.position.set(0, 0.8, 0.22)
  group.add(zone)

  return {
    group,
    crowd,
    crowdBase: Float32Array.from(positions),
    crowdYaw: Float32Array.from(yaws),
    updateBoard,
    setZone: (heightCm) => {
      zone.visible = heightCm != null
      if (heightCm == null) return
      const h = heightCm / 100
      const bot = h * 0.265
      const top = h * 0.54
      zone.scale.set(1, (top - bot) / 0.6, 1)
      zone.position.y = (top + bot) / 2
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
