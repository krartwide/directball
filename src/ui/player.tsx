import { useEffect, useRef, useState } from 'react'
import { PoseStage } from '../engine/preview.ts'
import { defaultAnims, idleClip } from '../lib/clips.ts'
import { buildHeadTexture } from '../lib/face.ts'
import { BONE_NAMES, POSITION_LABEL, type BoneName, type Clip, type FaceStyle, type Hand, type Player, type Position } from '../types.ts'
import { Button, Field, Range, SelectInput, TabContent, TabList, TabRoot, TabTrigger, TextInput } from './controls.tsx'
import { useLibrary } from './store.tsx'

const POSITIONS = Object.keys(POSITION_LABEL) as Position[]
const BONE_LABEL: Record<BoneName, string> = {
  hips: '골반',
  spine: '허리',
  chest: '가슴',
  neck: '목',
  head: '머리',
  shoulderL: '왼어깨',
  elbowL: '왼팔꿈치',
  wristL: '왼손목',
  shoulderR: '오른어깨',
  elbowR: '오른팔꿈치',
  wristR: '오른손목',
  thighL: '왼허벅지',
  shinL: '왼무릎',
  footL: '왼발목',
  thighR: '오른허벅지',
  shinR: '오른무릎',
  footR: '오른발목',
}

type ClipKey = 'routine' | 'swing' | 'hrCeremony' | 'pitch'

const CLIP_LABEL: Record<ClipKey, string> = {
  routine: '타격 루틴',
  swing: '타격폼',
  hrCeremony: '홈런 세레머니',
  pitch: '투구폼',
}

export function PlayerPage({ id }: { id: string }) {
  const { players, teams, savePlayer, deletePlayer } = useLibrary()
  const source = players.find((item) => item.id === id)
  const team = teams.find((item) => item.id === source?.teamId)
  const [draft, setDraft] = useState(source)
  const [clipKey, setClipKey] = useState<ClipKey>(source?.position === 'P' ? 'pitch' : 'swing')
  const [keyIndex, setKeyIndex] = useState(0)
  const [bone, setBone] = useState<BoneName>('shoulderR')
  const [scrub, setScrub] = useState(0)
  const [authored, setAuthored] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<PoseStage | null>(null)

  useEffect(() => {
    setDraft(source)
    setClipKey(source?.position === 'P' ? 'pitch' : 'swing')
    setKeyIndex(0)
  }, [id])

  useEffect(() => {
    if (!draft || !source) return
    if (JSON.stringify(draft) === JSON.stringify(source)) return
    const timer = window.setTimeout(() => void savePlayer(draft), 320)
    return () => window.clearTimeout(timer)
  }, [draft, source, savePlayer])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const stage = new PoseStage(canvas)
    stageRef.current = stage
    const observer = new ResizeObserver(() => stage.resize())
    observer.observe(canvas)
    stage.resize()
    return () => {
      observer.disconnect()
      stage.dispose()
      stageRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!draft || !team) return
    stageRef.current?.setPlayer(draft, team)
    const clip = authored ? draft.anims[clipKey] : idleClip()
    stageRef.current?.show(clip, authored ? scrub : 0)
  }, [draft, team, clipKey, scrub, authored])

  if (!draft || !team) return <p className="text-mist">이 선수를 찾지 못했습니다.</p>
  const clip = draft.anims[clipKey]
  const key = clip.keys[keyIndex] ?? clip.keys[0]
  const euler = key?.pose.bones[bone] ?? [0, 0, 0]

  function patch(next: Player) {
    setDraft(next)
  }

  function writeClip(next: Clip) {
    patch({ ...draft!, anims: { ...draft!.anims, [clipKey]: next } })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,420px)_1fr]">
      <div className="overflow-hidden rounded-3xl border border-line bg-[#123024]">
        <canvas ref={canvasRef} className="aspect-[4/5] w-full" />
        <div className="flex gap-2 p-3">
          <Button size="sm" onClick={() => { setAuthored(true); stageRef.current?.play(clip) }}>
            재생
          </Button>
          <Button size="sm" tone="ghost" onClick={() => stageRef.current?.pause()}>
            멈춤
          </Button>
          <p className="ml-auto self-center text-xs text-mist">드래그로 돌려 봅니다</p>
        </div>
      </div>
      <div>
        <p className="text-xs text-amber">{team.name}</p>
        <h1 className="font-display text-5xl text-foam">{draft.name}</h1>
        <TabRoot defaultValue="profile" className="mt-4">
          <TabList>
            <TabTrigger value="profile">프로필</TabTrigger>
            <TabTrigger value="body">체격</TabTrigger>
            <TabTrigger value="face">페이스</TabTrigger>
            <TabTrigger value="anim">애니메이션</TabTrigger>
          </TabList>
          <TabContent value="profile" className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="이름">
              <TextInput value={draft.name} onChange={(event) => patch({ ...draft, name: event.target.value })} />
            </Field>
            <Field label="등번호">
              <TextInput type="number" value={draft.number} onChange={(event) => patch({ ...draft, number: Number(event.target.value) })} />
            </Field>
            <Field label="포지션">
              <SelectInput value={draft.position} onChange={(event) => patch({ ...draft, position: event.target.value as Position })}>
                {POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {POSITION_LABEL[position]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="타격">
              <SelectInput value={draft.bats} onChange={(event) => patch({ ...draft, bats: event.target.value as Hand })}>
                <option value="R">우타</option>
                <option value="L">좌타</option>
                <option value="S">스위치</option>
              </SelectInput>
            </Field>
            <Field label="투구">
              <SelectInput value={draft.throws} onChange={(event) => patch({ ...draft, throws: event.target.value as 'R' | 'L' })}>
                <option value="R">우투</option>
                <option value="L">좌투</option>
              </SelectInput>
            </Field>
          </TabContent>
          <TabContent value="body" className="mt-4 space-y-4">
            <SliderRow label={`키 ${draft.body.heightCm}cm`} value={draft.body.heightCm} min={160} max={205} step={1} onChange={(heightCm) => patch({ ...draft, body: { ...draft.body, heightCm } })} />
            <SliderRow label={`체격 ${draft.body.build.toFixed(2)}`} value={draft.body.build} min={0.15} max={1} step={0.01} onChange={(build) => patch({ ...draft, body: { ...draft.body, build } })} />
            <SliderRow label={`어깨 ${draft.body.shoulder.toFixed(2)}`} value={draft.body.shoulder} min={0.8} max={1.25} step={0.01} onChange={(shoulder) => patch({ ...draft, body: { ...draft.body, shoulder } })} />
            <SliderRow label={`팔 길이 ${draft.body.armLength.toFixed(2)}`} value={draft.body.armLength} min={0.85} max={1.15} step={0.01} onChange={(armLength) => patch({ ...draft, body: { ...draft.body, armLength } })} />
            <SliderRow label={`다리 길이 ${draft.body.legLength.toFixed(2)}`} value={draft.body.legLength} min={0.85} max={1.15} step={0.01} onChange={(legLength) => patch({ ...draft, body: { ...draft.body, legLength } })} />
            <SliderRow label={`머리 ${draft.body.headScale.toFixed(2)}`} value={draft.body.headScale} min={0.85} max={1.2} step={0.01} onChange={(headScale) => patch({ ...draft, body: { ...draft.body, headScale } })} />
            <p className="text-sm text-mist">뼈대 비율만 바꾸면 됩니다. 경기 중 걷기, 달리기, 슬라이딩은 기본 동작이 맡습니다.</p>
          </TabContent>
          <TabContent value="face" className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-mist">
              사진을 올리면 이 브라우저 안에서 피부 영역을 다듬어 카드, 나이트, 사진 톤으로 머리에 입힙니다. 클라우드로 보내지 않습니다.
            </p>
            <Field label="톤">
              <SelectInput
                value={draft.faceStyle}
                onChange={(event) => {
                  const faceStyle = event.target.value as FaceStyle
                  void buildHeadTexture({
                    source: draft.faceSource,
                    style: faceStyle,
                    skin: draft.skin,
                    hair: draft.hair,
                    seed: draft.id,
                  }).then((faceTexture) => patch({ ...draft, faceStyle, faceTexture }))
                }}
              >
                <option value="card">카드</option>
                <option value="night">나이트</option>
                <option value="photo">사진</option>
              </SelectInput>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="피부">
                <input type="color" value={draft.skin} onChange={(event) => patch({ ...draft, skin: event.target.value })} className="h-10 w-full bg-transparent" />
              </Field>
              <Field label="머리색">
                <input type="color" value={draft.hair} onChange={(event) => patch({ ...draft, hair: event.target.value })} className="h-10 w-full bg-transparent" />
              </Field>
            </div>
            <input
              type="file"
              accept="image/*"
              className="text-sm text-mist"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => {
                  const faceSource = String(reader.result)
                  void buildHeadTexture({
                    source: faceSource,
                    style: draft.faceStyle,
                    skin: draft.skin,
                    hair: draft.hair,
                    seed: draft.id,
                  }).then((faceTexture) => patch({ ...draft, faceSource, faceTexture }))
                }
                reader.readAsDataURL(file)
              }}
            />
          </TabContent>
          <TabContent value="anim" className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-mist">
              {draft.position === 'P'
                ? '투수는 투구폼만 만들면 됩니다. 세트, 와인드업 뒤의 팔 동작이 릴리스로 이어집니다.'
                : '타자는 타격 루틴, 타격폼, 홈런 세레머니를 만듭니다. 나머지 주루와 수비는 기본 동작입니다.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {(draft.position === 'P' ? (['pitch', 'routine', 'swing', 'hrCeremony'] as ClipKey[]) : (['routine', 'swing', 'hrCeremony', 'pitch'] as ClipKey[])).map((name) => (
                <Button key={name} size="sm" tone={clipKey === name ? 'amber' : 'ghost'} onClick={() => { setAuthored(true); setClipKey(name); setKeyIndex(0); setScrub(0) }}>
                  {CLIP_LABEL[name]}
                </Button>
              ))}
            </div>
            <Field label="뼈">
              <SelectInput value={bone} onChange={(event) => setBone(event.target.value as BoneName)}>
                {BONE_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {BONE_LABEL[name]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {(['X', 'Y', 'Z'] as const).map((axis, index) => (
              <SliderRow
                key={axis}
                label={`${axis} ${Math.round(euler[index] ?? 0)}°`}
                value={euler[index] ?? 0}
                min={-180}
                max={180}
                step={1}
                onChange={(value) => {
                  if (!key) return
                  const nextEuler: [number, number, number] = [euler[0] ?? 0, euler[1] ?? 0, euler[2] ?? 0]
                  nextEuler[index] = value
                  const keys = clip.keys.map((item, itemIndex) =>
                    itemIndex === keyIndex
                      ? { ...item, pose: { ...item.pose, bones: { ...item.pose.bones, [bone]: nextEuler } } }
                      : item,
                  )
                  writeClip({ ...clip, keys })
                }}
              />
            ))}
            <SliderRow label="타임라인" value={scrub} min={0} max={1} step={0.01} onChange={setScrub} />
            <div className="flex flex-wrap gap-2">
              {clip.keys.map((item, index) => (
                <Button key={`${item.t}-${index}`} size="sm" tone={index === keyIndex ? 'teal' : 'ghost'} onClick={() => { setKeyIndex(index); setScrub(item.t) }}>
                  {(item.t * 100).toFixed(0)}%
                </Button>
              ))}
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  const pose = structuredClone(key?.pose ?? clip.keys[0]?.pose)
                  if (!pose) return
                  const keys = [...clip.keys, { t: Number(scrub.toFixed(2)), pose }].sort((a, b) => a.t - b.t)
                  writeClip({ ...clip, keys })
                  setKeyIndex(keys.findIndex((item) => item.t === Number(scrub.toFixed(2))))
                }}
              >
                키프레임 추가
              </Button>
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  if (clip.keys.length < 2) return
                  const keys = clip.keys.filter((_, index) => index !== keyIndex)
                  writeClip({ ...clip, keys })
                  setKeyIndex(0)
                }}
              >
                키프레임 삭제
              </Button>
              <Button
                size="sm"
                tone="ghost"
                onClick={() => patch({ ...draft, anims: defaultAnims(draft.throws, draft.bats) })}
              >
                기본 동작으로
              </Button>
            </div>
          </TabContent>
        </TabRoot>
        <Button
          tone="danger"
          size="sm"
          className="mt-6"
          onClick={() => {
            void deletePlayer(draft.id)
            location.hash = `#/team/${draft.teamId}`
          }}
        >
          선수 삭제
        </Button>
      </div>
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block text-xs font-bold text-mist">
      <span>{label}</span>
      <div className="mt-1">
        <Range value={value} min={min} max={max} step={step} onChange={onChange} />
      </div>
    </label>
  )
}
