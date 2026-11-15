import * as THREE from 'three'
import type { Match, Player, Team } from '../types.ts'
import { ParkAudio } from './audio.ts'
import { emptyFrame, look, type CamFrame, type Cue, type Hud } from './api.ts'
import { createFigure, createUmpire, type Figure } from './figure.ts'
import { drawOverlay } from './overlay.ts'
import { buildPark, type Park } from './park.ts'
import { stadiumById } from '../data/stadiums.ts'
import { buildCues } from './timeline.ts'
import { inningLabel } from '../lib/rules.ts'
import { smooth } from '../lib/field.ts'

export type CameraLock = 'auto' | 'cf' | 'first' | 'third' | 'low' | 'high' | 'abs' | 'sky' | 'side'

const LOCKS: Record<Exclude<CameraLock, 'auto'>, CamFrame> = {
  cf: look([0, 12.5, 70], [0, 1.25, 8], 15),
  first: look([32, 8, 16], [0, 1.2, 12], 28),
  third: look([-32, 8, 16], [0, 1.2, 12], 28),
  low: look([0, 1.7, -7], [0, 1.4, 16], 26),
  high: look([0, 18, -20], [0, 1, 30], 36),
  abs: look([0, 1.65, -2.3], [0, 1.15, 16], 11),
  sky: look([40, 36, -8], [0, 0, 30], 42),
  side: look([4.2, 1.6, 1.2], [-0.4, 1.4, 0.2], 22),
}

function ballMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAngle: { value: 0 },
      uAxis: { value: new THREE.Vector3(1, 0, 0) },
      uBlur: { value: 0 },
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vP;
      void main() {
        vN = normalize(normalMatrix * normal);
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uAngle;
      uniform vec3 uAxis;
      uniform float uBlur;
      varying vec3 vN;
      varying vec3 vP;
      vec3 rot(vec3 p, vec3 axis, float ang) {
        vec3 a = normalize(axis);
        float c = cos(ang);
        float s = sin(ang);
        return p * c + cross(a, p) * s + a * dot(a, p) * (1.0 - c);
      }
      float seam(vec3 p) {
        float phi = atan(p.z, p.x);
        float wave = 0.52 * sin(phi * 2.0);
        return smoothstep(0.11, 0.025, abs(p.y - wave));
      }
      void main() {
        vec3 n = normalize(vP);
        float acc = 0.0;
        float w = 0.0;
        for (int i = -2; i <= 2; i++) {
          float weight = 1.0 - abs(float(i)) * 0.2;
          acc += seam(rot(n, uAxis, uAngle + float(i) * uBlur * 0.5)) * weight;
          w += weight;
        }
        vec3 leather = vec3(0.95, 0.95, 0.92);
        vec3 stitch = vec3(0.74, 0.13, 0.11);
        float light = 0.38 + 0.62 * clamp(dot(normalize(vN), normalize(vec3(0.25, 0.85, 0.35))), 0.0, 1.0);
        gl_FragColor = vec4(mix(leather, stitch, acc / w) * light, 1.0);
      }
    `,
  })
}

export class BroadcastEngine {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 600)
  private overlay: HTMLCanvasElement
  private overlayCtx: CanvasRenderingContext2D
  private audio = new ParkAudio()
  private park: Park | null = null
  private figures = new Map<string, Figure>()
  private players = new Map<string, Player>()
  private cues: Cue[] = []
  private ball: THREE.Mesh
  private ballMat: THREE.ShaderMaterial
  private water: THREE.InstancedMesh
  private dummy = new THREE.Object3D()
  private raf = 0
  private last = 0
  private fired = new Set<string>()
  private listeners = new Set<() => void>()
  time = 0
  playing = false
  speed = 1
  lock: CameraLock = 'auto'
  absAuto = true
  exporting = false
  private night = true
  private lastHud: Hud | null = null

  constructor(gl: HTMLCanvasElement, overlay: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.overlay = overlay
    const ctx = overlay.getContext('2d')
    if (!ctx) throw new Error('오버레이를 만들 수 없습니다')
    this.overlayCtx = ctx
    this.ballMat = ballMaterial()
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.037, 24, 16), this.ballMat)
    this.ball.castShadow = true
    this.ball.visible = false
    this.scene.add(this.ball)
    this.water = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.035, 6, 6),
      new THREE.MeshStandardMaterial({ color: '#7ec8ff', transparent: true, opacity: 0.75, roughness: 0.2 }),
      42,
    )
    this.water.visible = false
    this.scene.add(this.water)
    this.scene.fog = new THREE.Fog('#0d1a14', 70, 230)
  }

  load(match: Match, teams: Team[], players: Player[]) {
    this.disposeWorld()
    this.players = new Map(players.map((player) => [player.id, player]))
    const home = teams.find((team) => team.id === match.homeTeamId)
    const away = teams.find((team) => team.id === match.awayTeamId)
    const stadium = stadiumById(match.stadiumId)
    this.night = match.night || stadium.dome
    this.renderer.toneMappingExposure = this.night ? 0.86 : 1.05
    this.scene.fog = new THREE.Fog(this.night ? '#101820' : stadium.haze, this.night ? 55 : 80, 240)
    this.park = buildPark(stadium, this.night)
    this.scene.add(this.park.group)
    const involved = players.filter((player) => player.teamId === match.homeTeamId || player.teamId === match.awayTeamId)
    for (const player of involved) {
      const team = player.teamId === match.homeTeamId ? home : away
      if (!team) continue
      const figure = createFigure(player, team)
      this.figures.set(player.id, figure)
      this.scene.add(figure.root)
    }
    for (const id of ['ump-hp', 'ump-1b', 'ump-2b', 'ump-3b']) {
      const figure = createUmpire(id)
      this.figures.set(id, figure)
      this.scene.add(figure.root)
    }
    this.cues = buildCues(match, teams, players)
    this.time = 0
    this.playing = false
    this.fired.clear()
    this.resize()
    this.renderAt(0)
  }

  get duration() {
    const last = this.cues[this.cues.length - 1]
    return last?.t1 ?? 0
  }

  get markers() {
    return this.cues.map((cue) => ({ t: cue.t0, label: cue.label }))
  }

  get highlightRanges(): Array<[number, number]> {
    return this.cues.filter((cue) => cue.highlight).map((cue) => [cue.t0, cue.t1])
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  play() {
    this.audio.unlock()
    if (this.time >= this.duration) this.time = 0
    this.playing = true
    this.last = performance.now()
    this.emit()
  }

  pause() {
    this.playing = false
    this.emit()
  }

  seek(time: number) {
    this.time = Math.max(0, Math.min(this.duration, time))
    this.fired.clear()
    this.renderAt(this.time)
    this.emit()
  }

  setSpeed(speed: number) {
    this.speed = speed
    this.emit()
  }

  setLock(lock: CameraLock) {
    this.lock = lock
    this.emit()
  }

  setAbs(on: boolean) {
    this.absAuto = on
    this.emit()
  }

  setMuted(on: boolean) {
    this.audio.muted = on
    this.audio.setEnergy(on ? 0 : 0.4)
  }

  start() {
    this.stop()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
  }

  resize(width?: number, height?: number, dpr = Math.min(2, window.devicePixelRatio || 1)) {
    const w = width ?? this.renderer.domElement.clientWidth
    const h = height ?? this.renderer.domElement.clientHeight
    if (w < 2 || h < 2) return
    this.renderer.setPixelRatio(width ? 1 : dpr)
    this.renderer.setSize(w, h, false)
    this.overlay.width = Math.floor(w * (width ? 1 : dpr))
    this.overlay.height = Math.floor(h * (width ? 1 : dpr))
    this.overlayCtx.setTransform(width ? 1 : dpr, 0, 0, width ? 1 : dpr, 0, 0)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    if (this.park) this.renderAt(this.time)
  }

  renderAt(time: number) {
    if (!this.park) return
    const cue = this.cueAt(time)
    if (!cue) return
    const local = time - cue.t0
    const frame = emptyFrame()
    cue.apply(frame, local)
    for (const figure of this.figures.values()) figure.root.visible = false
    for (const [id, place] of frame.places) {
      const figure = this.figures.get(id)
      const player = this.players.get(id)
      if (!figure || !player) {
        if (figure && id.startsWith('ump')) {
          figure.root.visible = true
          figure.root.position.set(place.x, place.y, place.z)
          figure.root.rotation.y = place.yaw
          figure.setClip(place.clip, place.time, umpireStub(id))
          figure.setGear(place)
        }
        continue
      }
      figure.root.visible = true
      figure.root.position.set(place.x, place.y, place.z)
      figure.root.rotation.y = place.yaw
      figure.setClip(place.clip, place.time, player)
      figure.setGear(place)
    }
    this.scene.updateMatrixWorld(true)
    if (frame.stickHand) {
      const figure = this.figures.get(frame.stickHand.id)
      if (figure) {
        const hand = figure.hand(frame.stickHand.side)
        this.ball.visible = true
        this.ball.position.copy(hand)
        this.ballMat.uniforms.uBlur!.value = 0.05
      }
    } else if (frame.ball) {
      this.ball.visible = true
      this.ball.position.set(frame.ball.x, frame.ball.y, frame.ball.z)
      this.ballMat.uniforms.uAngle!.value = frame.ball.angle
      this.ballMat.uniforms.uBlur!.value = frame.ball.blur
      const axis = this.ballMat.uniforms.uAxis!.value as THREE.Vector3
      axis.set(frame.ball.ax, frame.ball.ay, frame.ball.az)
    } else this.ball.visible = false

    this.park.setZone(frame.zoneH)
    this.poseWater(frame.water, time)
    this.poseCrowd(frame.crowd, time)
    const hud = cue.hud(local)
    this.lastHud = hud
    this.park.updateBoard({
      away: hud.away,
      home: hud.home,
      awayScore: hud.awayScore,
      homeScore: hud.homeScore,
      inning: inningLabel(hud.inning, hud.half),
      note: hud.banner ?? hud.lower?.title ?? '',
    })
    const shot = this.shotFor(cue, local, frame)
    this.camera.position.set(shot.x, shot.y, shot.z)
    this.camera.lookAt(shot.lx, shot.ly, shot.lz)
    this.camera.fov = shot.fov
    this.camera.updateProjectionMatrix()
    this.renderer.render(this.scene, this.camera)
    const viewW = this.exporting ? this.renderer.domElement.width : this.renderer.domElement.clientWidth
    const viewH = this.exporting ? this.renderer.domElement.height : this.renderer.domElement.clientHeight
    drawOverlay(this.overlayCtx, viewW, viewH, hud)
    if (!this.exporting) this.fireSfx(time)
    this.audio.setEnergy(frame.crowd)
  }

  dispose() {
    this.stop()
    this.disposeWorld()
    this.audio.dispose()
    this.ball.geometry.dispose()
    this.ballMat.dispose()
    this.water.geometry.dispose()
    ;(this.water.material as THREE.Material).dispose()
    this.renderer.dispose()
  }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0)
    this.last = now
    if (this.playing && !this.exporting) {
      this.time = Math.min(this.duration, this.time + dt * this.speed)
      if (this.time >= this.duration) this.playing = false
      this.renderAt(this.time)
      this.emit()
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  private cueAt(time: number): Cue | null {
    for (const cue of this.cues) {
      if (time >= cue.t0 && time < cue.t1) return cue
    }
    return this.cues[this.cues.length - 1] ?? null
  }

  private shotFor(cue: Cue, local: number, _frame: ReturnType<typeof emptyFrame>): CamFrame {
    if (this.lock !== 'auto') return LOCKS[this.lock]
    if (this.absAuto && cue.absWindow && local >= cue.absWindow[0] && local <= cue.absWindow[1]) return LOCKS.abs
    const current = cue.camera(local)
    if (cue.cut || local >= 0.28) return current
    const index = this.cues.indexOf(cue)
    const prev = this.cues[index - 1]
    if (!prev) return current
    const from = prev.camera(Math.max(0, prev.t1 - prev.t0 - 0.05))
    const k = smooth(local / 0.28)
    return {
      x: from.x + (current.x - from.x) * k,
      y: from.y + (current.y - from.y) * k,
      z: from.z + (current.z - from.z) * k,
      lx: from.lx + (current.lx - from.lx) * k,
      ly: from.ly + (current.ly - from.ly) * k,
      lz: from.lz + (current.lz - from.lz) * k,
      fov: from.fov + (current.fov - from.fov) * k,
    }
  }

  private poseCrowd(energy: number, time: number) {
    if (!this.park) return
    const base = this.park.crowdBase
    const yaws = this.park.crowdYaw
    const count = base.length / 3
    for (let i = 0; i < count; i += 1) {
      const bob = Math.sin(time * (2.2 + energy * 4.5) + i * 0.37) * (0.01 + energy * 0.055)
      this.dummy.position.set(base[i * 3] ?? 0, (base[i * 3 + 1] ?? 0) + bob, base[i * 3 + 2] ?? 0)
      this.dummy.rotation.set(0, yaws[i] ?? 0, 0)
      this.dummy.scale.set(1, 1 + energy * 0.04, 1)
      this.dummy.updateMatrix()
      this.park.crowd.setMatrixAt(i, this.dummy.matrix)
    }
    this.park.crowd.instanceMatrix.needsUpdate = true
  }

  private poseWater(water: { x: number; z: number } | null, time: number) {
    this.water.visible = Boolean(water)
    if (!water) return
    for (let i = 0; i < 42; i += 1) {
      const life = (time * 0.85 + i * 0.13) % 1.35
      this.dummy.position.set(
        water.x + Math.sin(i * 1.7) * 0.85,
        2.5 - life * 2.3,
        water.z + Math.cos(i * 1.3) * 0.85,
      )
      this.dummy.scale.setScalar(life < 1.15 ? 1 : 0.01)
      this.dummy.updateMatrix()
      this.water.setMatrixAt(i, this.dummy.matrix)
    }
    this.water.instanceMatrix.needsUpdate = true
  }

  private fireSfx(time: number) {
    if (this.speed > 1.6) return
    for (const cue of this.cues) {
      for (const sfx of cue.sfx) {
        const at = cue.t0 + sfx.t
        const key = `${cue.t0}:${sfx.t}:${sfx.id}`
        if (this.fired.has(key)) continue
        if (time >= at && time - at < 0.2) {
          this.fired.add(key)
          this.audio.play(sfx.id)
          if (sfx.text) this.audio.speak(sfx.text)
        }
      }
    }
  }

  private emit() {
    this.listeners.forEach((fn) => fn())
  }

  private disposeWorld() {
    this.park?.group.removeFromParent()
    this.park?.dispose()
    this.park = null
    for (const figure of this.figures.values()) {
      figure.root.removeFromParent()
      figure.dispose()
    }
    this.figures.clear()
  }

  currentHud() {
    return this.lastHud
  }
}

function umpireStub(id: string): Player {
  return {
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
      routine: { duration: 1, loop: true, keys: [] },
      swing: { duration: 1, loop: false, keys: [] },
      hrCeremony: { duration: 1, loop: false, keys: [] },
      pitch: { duration: 1, loop: false, keys: [] },
    },
  }
}
