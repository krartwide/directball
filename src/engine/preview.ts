import * as THREE from 'three'
import type { Clip, Player, Pose, Team } from '../types.ts'
import { createFigure, type Figure } from './figure.ts'
import { sampleClip } from '../lib/pose.ts'

export class PoseStage {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30)
  private figure: Figure | null = null
  private player: Player | null = null
  private raf = 0
  private playing = false
  private clip: Clip | null = null
  private time = 0
  private last = 0
  private theta = 0.15
  private phi = 1.05
  private radius = 3.2
  private dragging = false
  private pointer = { x: 0, y: 0 }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.renderer.shadowMap.enabled = true
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 48),
      new THREE.MeshStandardMaterial({ color: '#249a48', roughness: 0.9 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 1.78, 48),
      new THREE.MeshStandardMaterial({ color: '#e8d4a0', roughness: 0.85 }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.002
    this.scene.add(ring)
    this.scene.add(new THREE.HemisphereLight('#f0faf4', '#3a6a48', 1.45))
    this.scene.add(new THREE.AmbientLight('#fff4e0', 0.45))
    const key = new THREE.DirectionalLight('#fff4e0', 3.2)
    key.position.set(2.6, 5.0, 3.4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.bias = -0.0003
    this.scene.add(key)
    const rim = new THREE.DirectionalLight('#a8d0ff', 1.0)
    rim.position.set(-3.2, 2.4, -2.2)
    this.scene.add(rim)
    const fill = new THREE.DirectionalLight('#ffe8c8', 0.7)
    fill.position.set(0, 3, -4)
    this.scene.add(fill)
    canvas.addEventListener('pointerdown', this.down)
    canvas.addEventListener('pointermove', this.move)
    window.addEventListener('pointerup', this.up)
    this.raf = requestAnimationFrame(this.loop)
  }

  setPlayer(player: Player, team: Team) {
    if (this.figure && this.player?.id === player.id && this.player.faceTexture === player.faceTexture && sameBody(this.player, player)) {
      this.player = player
      return
    }
    this.figure?.root.removeFromParent()
    this.figure?.dispose()
    this.player = player
    this.figure = createFigure(player, team)
    this.scene.add(this.figure.root)
  }

  play(clip: Clip) {
    this.clip = clip
    this.playing = true
    this.time = 0
    this.last = performance.now()
  }

  pause() {
    this.playing = false
  }

  show(clip: Clip, unitTime: number) {
    this.clip = clip
    this.playing = false
    this.time = unitTime * clip.duration
    this.apply()
  }

  showPose(pose: Pose) {
    this.playing = false
    if (!this.figure) return
    this.figure.setPlace(pose, 0.2, 0, 0, 0)
    this.figure.setGear({ bat: true, glove: true, hat: 'helmet' })
  }

  resize() {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w < 2 || h < 2) return
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.renderer.domElement.removeEventListener('pointerdown', this.down)
    this.renderer.domElement.removeEventListener('pointermove', this.move)
    window.removeEventListener('pointerup', this.up)
    this.figure?.dispose()
    this.renderer.dispose()
  }

  private apply() {
    if (!this.figure || !this.player || !this.clip) return
    const pose = sampleClip(this.clip, this.time)
    // Face the camera (+Z) so the stylized face reads in the editor.
    this.figure.setPlace(pose, 0, 0, 0, 0)
    this.figure.setGear({ bat: true, glove: true, hat: 'none' })
  }

  private loop = (now: number) => {
    if (this.playing && this.clip) {
      const dt = Math.min(0.05, (now - this.last) / 1000 || 0)
      this.time += dt
      if (!this.clip.loop && this.time > this.clip.duration) this.time = 0
    }
    this.last = now
    this.apply()
    const r = this.radius
    this.camera.position.set(
      Math.sin(this.phi) * Math.sin(this.theta) * r,
      Math.cos(this.phi) * r * 0.35 + 1.15,
      Math.sin(this.phi) * Math.cos(this.theta) * r,
    )
    this.camera.lookAt(0, 1.05, 0)
    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.loop)
  }

  private down = (event: PointerEvent) => {
    this.dragging = true
    this.pointer = { x: event.clientX, y: event.clientY }
  }

  private move = (event: PointerEvent) => {
    if (!this.dragging) return
    this.theta -= (event.clientX - this.pointer.x) * 0.01
    this.phi = Math.max(0.4, Math.min(2.2, this.phi + (event.clientY - this.pointer.y) * 0.008))
    this.pointer = { x: event.clientX, y: event.clientY }
  }

  private up = () => {
    this.dragging = false
  }
}

function sameBody(a: Player, b: Player) {
  return JSON.stringify(a.body) === JSON.stringify(b.body) && a.number === b.number && a.skin === b.skin
}
