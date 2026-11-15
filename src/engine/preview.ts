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
  private theta = 0.4
  private phi = 1.15
  private radius = 3.6
  private dragging = false
  private pointer = { x: 0, y: 0 }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 40),
      new THREE.MeshStandardMaterial({ color: '#1c7a3c', roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    this.scene.add(ground)
    this.scene.add(new THREE.HemisphereLight('#d9efe4', '#1a3a24', 1.1))
    const key = new THREE.DirectionalLight('#fff4dd', 2.2)
    key.position.set(2, 4, 3)
    this.scene.add(key)
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
    this.figure.setPlace(pose, 0.25, 0, 0, 0)
    this.figure.setGear({ bat: true, glove: true, hat: 'cap' })
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
