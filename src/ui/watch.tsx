import { useEffect, useRef, useState } from 'react'
import { BroadcastEngine, type CameraLock } from '../engine/broadcast.ts'
import { exportMp4 } from '../lib/exportMp4.ts'
import { Button, Modal, Toggle } from './controls.tsx'
import { useLibrary } from './store.tsx'

const CAMERAS: Array<{ id: CameraLock; label: string }> = [
  { id: 'auto', label: '중계' },
  { id: 'cf', label: '중견' },
  { id: 'first', label: '1루' },
  { id: 'third', label: '3루' },
  { id: 'low', label: '로우 홈' },
  { id: 'high', label: '하이 홈' },
  { id: 'abs', label: 'ABS' },
  { id: 'side', label: '측면' },
  { id: 'sky', label: '스카이' },
]

export function WatchPage({ id }: { id: string }) {
  const { matches, teams, players } = useLibrary()
  const match = matches.find((item) => item.id === id)
  const glRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<BroadcastEngine | null>(null)
  const [snap, setSnap] = useState({
    time: 0,
    duration: 0,
    playing: false,
    speed: 1,
    lock: 'auto' as CameraLock,
    absAuto: true,
    muted: false,
    markers: [] as { t: number; label: string }[],
  })
  const [exportOpen, setExportOpen] = useState(false)
  const [preset, setPreset] = useState<'540' | '720'>('540')
  const [onlyHighlight, setOnlyHighlight] = useState(true)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const gl = glRef.current
    const hud = hudRef.current
    if (!gl || !hud || !match) return
    const engine = new BroadcastEngine(gl, hud)
    engine.load(match, teams, players)
    engine.start()
    engineRef.current = engine
    const pull = () =>
      setSnap((prev) => ({
        ...prev,
        time: engine.time,
        duration: engine.duration,
        playing: engine.playing,
        speed: engine.speed,
        lock: engine.lock,
        absAuto: engine.absAuto,
        markers: engine.markers,
      }))
    pull()
    const off = engine.subscribe(pull)
    const observer = new ResizeObserver(() => engine.resize())
    observer.observe(gl)
    engine.resize()
    return () => {
      off()
      observer.disconnect()
      engine.dispose()
      engineRef.current = null
    }
  }, [match, teams, players])

  if (!match) return <p className="text-mist">이 경기를 찾지 못했습니다.</p>
  const time = snap.time
  const duration = snap.duration

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-amber">중계</p>
          <h1 className="font-display text-5xl text-foam">{match.title}</h1>
        </div>
        <Button tone="ghost" onClick={() => (location.hash = `#/match/${match.id}`)}>
          연출로
        </Button>
      </div>
      <div className="relative aspect-video overflow-hidden rounded-3xl bg-black">
        <canvas ref={glRef} className="absolute inset-0 h-full w-full" />
        <canvas ref={hudRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => (snap.playing ? engineRef.current?.pause() : engineRef.current?.play())}>
          {snap.playing ? '일시정지' : '재생'}
        </Button>
        <Button
          size="sm"
          tone="ghost"
          onClick={() => {
            const marker = engineRef.current?.markers.find((item) => item.label.includes('km/h'))
            if (marker) engineRef.current?.seek(marker.t)
          }}
        >
          입장 건너뛰기
        </Button>
        <Button size="sm" tone="ghost" onClick={() => setExportOpen(true)}>
          MP4 저장
        </Button>
        <label className="ml-auto text-xs text-mist">
          배속
          <select
            className="ml-2 rounded-full bg-white/10 px-2 py-1"
            value={snap.speed}
            onChange={(event) => engineRef.current?.setSpeed(Number(event.target.value))}
          >
            <option value={0.5}>0.5</option>
            <option value={1}>1</option>
            <option value={1.5}>1.5</option>
            <option value={2}>2</option>
          </select>
        </label>
      </div>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.05}
        value={Math.min(time, duration || 1)}
        onChange={(event) => engineRef.current?.seek(Number(event.target.value))}
        className="w-full accent-amber"
      />
      <div className="flex gap-2 overflow-auto">
        {CAMERAS.map((camera) => (
          <Button key={camera.id} size="sm" tone={snap.lock === camera.id ? 'amber' : 'ghost'} onClick={() => engineRef.current?.setLock(camera.id)}>
            {camera.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <Toggle checked={snap.absAuto} onChange={(on) => engineRef.current?.setAbs(on)} label="ABS 카메라" />
        <Toggle
          checked={snap.muted}
          onChange={(on) => {
            engineRef.current?.setMuted(on)
            setSnap((prev) => ({ ...prev, muted: on }))
          }}
          label="소리 끄기"
        />
      </div>
      <div className="flex gap-2 overflow-auto">
        {snap.markers.map((marker) => (
          <button key={`${marker.t}-${marker.label}`} onClick={() => engineRef.current?.seek(marker.t)} className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs text-mist">
            {formatClock(marker.t)} {marker.label}
          </button>
        ))}
      </div>

      <Modal open={exportOpen} title="영상으로 저장" onClose={() => !busy && setExportOpen(false)}>
        <p className="text-sm leading-6 text-mist">
          540p는 분당 약 10MB, 720p는 분당 약 16MB입니다. 하이라이트만 저장하면 입장과 루킹 사이가 빠지고 더 작아집니다.
        </p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" tone={preset === '540' ? 'amber' : 'ghost'} onClick={() => setPreset('540')}>
            540p
          </Button>
          <Button size="sm" tone={preset === '720' ? 'amber' : 'ghost'} onClick={() => setPreset('720')}>
            720p
          </Button>
        </div>
        <div className="mt-4">
          <Toggle checked={onlyHighlight} onChange={setOnlyHighlight} label="하이라이트만" />
        </div>
        {busy ? <p className="mt-4 font-mono text-sm text-amber">{Math.round(progress * 100)}%</p> : null}
        {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <Button
            disabled={busy}
            onClick={() => {
              const current = engineRef.current
              const gl = glRef.current
              const hud = hudRef.current
              if (!current || !gl || !hud) return
              const ranges = onlyHighlight ? current.highlightRanges : [[0, current.duration] as [number, number]]
              const width = preset === '540' ? 960 : 1280
              const height = preset === '540' ? 540 : 720
              const bitrate = preset === '540' ? 1_400_000 : 2_200_000
              const abort = new AbortController()
              abortRef.current = abort
              setBusy(true)
              setError('')
              setProgress(0)
              void exportMp4({
                engine: current,
                gl,
                overlay: hud,
                ranges,
                width,
                height,
                fps: 30,
                bitrate,
                signal: abort.signal,
                onProgress: setProgress,
              })
                .then((blob) => {
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `directball-${match.title}.mp4`
                  link.click()
                  URL.revokeObjectURL(url)
                  setExportOpen(false)
                })
                .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '저장에 실패했습니다'))
                .finally(() => setBusy(false))
            }}
          >
            저장 시작
          </Button>
          <Button
            tone="ghost"
            onClick={() => {
              abortRef.current?.abort()
              setExportOpen(false)
            }}
          >
            취소
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function formatClock(time: number) {
  const seconds = Math.floor(time)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
