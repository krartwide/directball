import { useEffect, useMemo, useState } from 'react'
import { STADIUMS, stadiumById } from '../data/stadiums.ts'
import { zoneFor } from '../lib/field.ts'
import { uid } from '../lib/id.ts'
import { presentContact, simulatePitch } from '../lib/physics.ts'
import { playerName, simulateScript } from '../lib/rules.ts'
import {
  ACTION_LABEL,
  PITCH_LABEL,
  RESULT_LABEL,
  type Match,
  type MatchEvent,
  type PaEvent,
  type Pitch,
  type PitchAction,
  type PitchType,
  type PlayResult,
  type ReviewKind,
} from '../types.ts'
import { Button, Field, Range, SelectInput, TextInput, Toggle } from './controls.tsx'
import { useLibrary } from './store.tsx'

const TYPES = Object.keys(PITCH_LABEL) as PitchType[]
const ACTIONS = Object.keys(ACTION_LABEL) as PitchAction[]
const RESULTS = Object.keys(RESULT_LABEL) as PlayResult[]
const REVIEWS: ReviewKind[] = ['abs', 'safeout', 'fairfoul', 'homer', 'catch']

const TEMPLATES: Array<{ label: string; action: PitchAction; result: PlayResult | null; contact?: Pitch['contact'] }> = [
  { label: '루킹 삼진', action: 'take', result: 'strikeout' },
  { label: '헛스윙 삼진', action: 'swing_miss', result: 'strikeout' },
  { label: '볼넷', action: 'take', result: 'walk' },
  { label: '안타', action: 'contact', result: 'single', contact: { exitVelocityKmh: 152, launchAngle: 12, sprayAngle: 18, hitRpm: 1800, distanceM: 92 } },
  { label: '2루타', action: 'contact', result: 'double', contact: { exitVelocityKmh: 160, launchAngle: 18, sprayAngle: -28, hitRpm: 1900, distanceM: 108 } },
  { label: '3루타', action: 'contact', result: 'triple', contact: { exitVelocityKmh: 166, launchAngle: 22, sprayAngle: -36, hitRpm: 1700, distanceM: 116 } },
  { label: '홈런', action: 'contact', result: 'homer', contact: { exitVelocityKmh: 168, launchAngle: 28, sprayAngle: -8, hitRpm: 2200, distanceM: 128 } },
  { label: '땅볼', action: 'contact', result: 'groundout', contact: { exitVelocityKmh: 132, launchAngle: 2, sprayAngle: 12, hitRpm: 900, distanceM: 36 } },
  { label: '플라이', action: 'contact', result: 'flyout', contact: { exitVelocityKmh: 148, launchAngle: 32, sprayAngle: 6, hitRpm: 2100, distanceM: 86 } },
  { label: '병살', action: 'contact', result: 'gidp', contact: { exitVelocityKmh: 140, launchAngle: 4, sprayAngle: 8, hitRpm: 800, distanceM: 32 } },
  { label: '실책', action: 'contact', result: 'error', contact: { exitVelocityKmh: 146, launchAngle: 8, sprayAngle: 22, hitRpm: 1200, distanceM: 48 } },
  { label: '희생플라이', action: 'contact', result: 'sac_fly', contact: { exitVelocityKmh: 150, launchAngle: 34, sprayAngle: -4, hitRpm: 2000, distanceM: 78 } },
]

function blankPitch(action: PitchAction = 'take'): Pitch {
  return {
    id: uid('pitch'),
    type: 'FF',
    velocityKmh: 146,
    rpm: 2300,
    plateX: 0,
    plateY: 0.78,
    action,
    contact: action === 'contact' ? { exitVelocityKmh: 155, launchAngle: 18, sprayAngle: 0, hitRpm: 1800, distanceM: null } : undefined,
  }
}

export function MatchPage({ id }: { id: string }) {
  const { matches, teams, players, saveMatch, deleteMatch } = useLibrary()
  const source = matches.find((item) => item.id === id)
  const [draft, setDraft] = useState(source)
  const [eventIndex, setEventIndex] = useState(0)
  const [pitchIndex, setPitchIndex] = useState(0)

  useEffect(() => {
    setDraft(source)
    setEventIndex(0)
    setPitchIndex(0)
  }, [id])

  useEffect(() => {
    if (!draft || !source) return
    if (JSON.stringify(draft) === JSON.stringify(source)) return
    const timer = window.setTimeout(() => void saveMatch(draft), 360)
    return () => window.clearTimeout(timer)
  }, [draft, source, saveMatch])

  const home = teams.find((team) => team.id === draft?.homeTeamId)
  const away = teams.find((team) => team.id === draft?.awayTeamId)
  const script = useMemo(() => (draft ? simulateScript(draft, players) : null), [draft, players])

  if (!draft || !home || !away || !script) return <p className="text-mist">이 경기를 찾지 못했거나 구단이 빠졌습니다.</p>

  const event = draft.events[eventIndex]
  const pa = event?.kind === 'pa' ? event : null
  const pitch = pa?.pitches[pitchIndex]

  function patch(next: Match) {
    setDraft(next)
  }

  function patchEvent(next: MatchEvent) {
    patch({ ...draft!, events: draft!.events.map((item, index) => (index === eventIndex ? next : item)) })
  }

  function patchPitch(next: Pitch) {
    if (!pa) return
    patchEvent({ ...pa, pitches: pa.pitches.map((item, index) => (index === pitchIndex ? next : item)) })
  }

  const homeRoster = players.filter((player) => player.teamId === home.id)
  const awayRoster = players.filter((player) => player.teamId === away.id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-amber">연출</p>
          <h1 className="font-display text-5xl text-foam">{draft.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => (location.hash = `#/watch/${draft.id}`)}>중계 보기</Button>
          <Button
            tone="danger"
            size="sm"
            onClick={() => {
              void deleteMatch(draft.id)
              location.hash = '#/'
            }}
          >
            삭제
          </Button>
        </div>
      </div>

      <section className="grid gap-3 rounded-3xl border border-line bg-panel p-4 md:grid-cols-2">
        <Field label="제목">
          <TextInput value={draft.title} onChange={(event) => patch({ ...draft, title: event.target.value })} />
        </Field>
        <Field label="날짜 표기">
          <TextInput value={draft.dateLabel} onChange={(event) => patch({ ...draft, dateLabel: event.target.value })} />
        </Field>
        <Field label="홈">
          <SelectInput
            value={draft.homeTeamId}
            onChange={(event) => patch({ ...draft, homeTeamId: event.target.value, homeLineup: [], homePitcherId: '' })}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="원정">
          <SelectInput
            value={draft.awayTeamId}
            onChange={(event) => patch({ ...draft, awayTeamId: event.target.value, awayLineup: [], awayPitcherId: '' })}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Toggle checked={draft.night} onChange={(night) => patch({ ...draft, night })} label="나이트 경기" />
      </section>

      <section>
        <h2 className="font-display text-3xl text-foam">구장</h2>
        <p className="mt-1 text-sm text-mist">담장 거리는 공개된 숫자입니다. 폴대 사이는 그 구장 모양으로 이었습니다.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {STADIUMS.map((stadium) => (
            <button
              key={stadium.id}
              onClick={() => patch({ ...draft, stadiumId: stadium.id })}
              className={`rounded-2xl border p-3 text-left ${draft.stadiumId === stadium.id ? 'border-amber bg-amber/10' : 'border-line bg-panel'}`}
            >
              <span className="block text-sm text-foam">{stadium.name}</span>
              <span className="mt-1 block text-xs leading-5 text-mist">
                {stadium.blurb} 좌 {stadium.lf} · 중 {stadium.cf} · 우 {stadium.rf} · 담장 {stadium.wall}m
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Lineup
          title={`${home.short} 타순`}
          ids={draft.homeLineup}
          roster={homeRoster}
          onChange={(homeLineup) => patch({ ...draft, homeLineup })}
        />
        <Lineup
          title={`${away.short} 타순`}
          ids={draft.awayLineup}
          roster={awayRoster}
          onChange={(awayLineup) => patch({ ...draft, awayLineup })}
        />
        <Field label="홈 투수">
          <SelectInput value={draft.homePitcherId} onChange={(event) => patch({ ...draft, homePitcherId: event.target.value })}>
            {homeRoster.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="원정 투수">
          <SelectInput value={draft.awayPitcherId} onChange={(event) => patch({ ...draft, awayPitcherId: event.target.value })}>
            {awayRoster.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="font-display text-3xl text-foam">시작 상황</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="이닝">
            <TextInput
              type="number"
              value={draft.opening.inning}
              onChange={(event) => patch({ ...draft, opening: { ...draft.opening, inning: Number(event.target.value) } })}
            />
          </Field>
          <Field label="초/말">
            <SelectInput
              value={draft.opening.half}
              onChange={(event) => patch({ ...draft, opening: { ...draft.opening, half: event.target.value as 'top' | 'bottom' } })}
            >
              <option value="top">초</option>
              <option value="bottom">말</option>
            </SelectInput>
          </Field>
          <Field label="아웃">
            <TextInput
              type="number"
              value={draft.opening.outs}
              onChange={(event) => patch({ ...draft, opening: { ...draft.opening, outs: Number(event.target.value) } })}
            />
          </Field>
          <Field label="원정 점수">
            <TextInput
              type="number"
              value={draft.opening.awayScore}
              onChange={(event) => patch({ ...draft, opening: { ...draft.opening, awayScore: Number(event.target.value) } })}
            />
          </Field>
          <Field label="홈 점수">
            <TextInput
              type="number"
              value={draft.opening.homeScore}
              onChange={(event) => patch({ ...draft, opening: { ...draft.opening, homeScore: Number(event.target.value) } })}
            />
          </Field>
        </div>
        <p className="mt-3 text-sm text-mist">주루는 결과에 맞춰 자동으로 움직입니다. 시작 주자만 여기서 고릅니다.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {([0, 1, 2] as const).map((base) => (
            <Field key={base} label={`${base + 1}루`}>
              <SelectInput
                value={draft.opening.bases[base] ?? ''}
                onChange={(event) => {
                  const bases = [...draft.opening.bases] as Match['opening']['bases']
                  bases[base] = event.target.value || null
                  patch({ ...draft, opening: { ...draft.opening, bases } })
                }}
              >
                <option value="">비어 있음</option>
                {(draft.opening.half === 'bottom' ? homeRoster : awayRoster).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-3xl text-foam">장면</h2>
          </div>
          <p className="mt-1 text-xs text-mist">
            종료 {script.final.awayScore}-{script.final.homeScore}
            {script.final.walkoff ? ' · 끝내기' : script.final.gameOver ? ' · 경기 종료' : ''}
          </p>
          <ul className="mt-3 space-y-2">
            {script.rows.map((row) => (
              <li key={row.index}>
                <button
                  onClick={() => {
                    setEventIndex(row.index)
                    setPitchIndex(0)
                  }}
                  className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${eventIndex === row.index ? 'border-amber bg-amber/10 text-foam' : 'border-line text-mist'}`}
                >
                  <span className="block text-xs">{row.score} · {row.outs}아웃</span>
                  {row.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                const side = draft.opening.half
                const lineup = side === 'bottom' ? draft.homeLineup : draft.awayLineup
                const batterId = lineup[0] ?? ''
                const next: PaEvent = { id: uid('pa'), kind: 'pa', batterId, pitches: [blankPitch()], result: null }
                patch({ ...draft, events: [...draft.events, next] })
                setEventIndex(draft.events.length)
                setPitchIndex(0)
              }}
            >
              타석
            </Button>
            <Button
              size="sm"
              tone="ghost"
              onClick={() => {
                patch({ ...draft, events: [...draft.events, { id: uid('steal'), kind: 'steal', from: 1, success: true }] })
                setEventIndex(draft.events.length)
              }}
            >
              도루
            </Button>
            <Button
              size="sm"
              tone="ghost"
              onClick={() => {
                patch({
                  ...draft,
                  events: [...draft.events, { id: uid('mound'), kind: 'mound', team: 'home', pitcherId: draft.homePitcherId }],
                })
                setEventIndex(draft.events.length)
              }}
            >
              마운드
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-4">
          {!event ? <p className="text-mist">장면을 추가하면 여기서 공을 만듭니다.</p> : null}
          {event?.kind === 'steal' ? (
            <div className="space-y-3">
              <h3 className="font-display text-3xl text-foam">도루</h3>
              <Field label="출발">
                <SelectInput
                  value={String(event.from)}
                  onChange={(change) => patchEvent({ ...event, from: Number(change.target.value) as 1 | 2 | 3 })}
                >
                  <option value="1">1루</option>
                  <option value="2">2루</option>
                  <option value="3">3루</option>
                </SelectInput>
              </Field>
              <Toggle checked={event.success} onChange={(success) => patchEvent({ ...event, success })} label="성공" />
              <Toggle
                checked={Boolean(event.review)}
                onChange={(on) => patchEvent({ ...event, review: on ? { overturn: false } : undefined })}
                label="비디오 판독"
              />
              {event.review ? (
                <Toggle
                  checked={event.review.overturn}
                  onChange={(overturn) => patchEvent({ ...event, review: { overturn } })}
                  label="판정 번복"
                />
              ) : null}
            </div>
          ) : null}
          {event?.kind === 'mound' ? (
            <div className="space-y-3">
              <h3 className="font-display text-3xl text-foam">마운드 방문</h3>
              <Field label="팀">
                <SelectInput value={event.team} onChange={(change) => patchEvent({ ...event, team: change.target.value as 'home' | 'away' })}>
                  <option value="home">홈</option>
                  <option value="away">원정</option>
                </SelectInput>
              </Field>
              <Field label="투수">
                <SelectInput value={event.pitcherId} onChange={(change) => patchEvent({ ...event, pitcherId: change.target.value })}>
                  {(event.team === 'home' ? homeRoster : awayRoster).map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
          ) : null}
          {pa && pitch ? (
            <PitchEditor
              pa={pa}
              pitch={pitch}
              pitchIndex={pitchIndex}
              players={players}
              stadiumId={draft.stadiumId}
              onPickPitch={setPitchIndex}
              onPatchPa={patchEvent}
              onPatchPitch={patchPitch}
            />
          ) : null}
          {event ? (
            <Button
              tone="danger"
              size="sm"
              className="mt-4"
              onClick={() => {
                patch({ ...draft, events: draft.events.filter((_, index) => index !== eventIndex) })
                setEventIndex(0)
              }}
            >
              이 장면 삭제
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function Lineup({
  title,
  ids,
  roster,
  onChange,
}: {
  title: string
  ids: string[]
  roster: { id: string; name: string }[]
  onChange: (ids: string[]) => void
}) {
  const slots = Array.from({ length: 9 }, (_, index) => ids[index] ?? '')
  return (
    <div className="rounded-3xl border border-line bg-panel p-4">
      <h3 className="font-display text-2xl text-foam">{title}</h3>
      <div className="mt-3 space-y-2">
        {slots.map((value, index) => (
          <SelectInput
            key={index}
            value={value}
            onChange={(event) => {
              const next = [...slots]
              next[index] = event.target.value
              onChange(next.filter(Boolean))
            }}
          >
            <option value="">{index + 1}번</option>
            {roster.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </SelectInput>
        ))}
      </div>
    </div>
  )
}

function PitchEditor({
  pa,
  pitch,
  pitchIndex,
  players,
  stadiumId,
  onPickPitch,
  onPatchPa,
  onPatchPitch,
}: {
  pa: PaEvent
  pitch: Pitch
  pitchIndex: number
  players: { id: string; name: string; body: { heightCm: number }; throws: 'R' | 'L' }[]
  stadiumId: Match['stadiumId']
  onPickPitch: (index: number) => void
  onPatchPa: (event: PaEvent) => void
  onPatchPitch: (pitch: Pitch) => void
}) {
  const batter = players.find((player) => player.id === pa.batterId)
  const height = batter?.body.heightCm ?? 180
  const zone = zoneFor(height)
  const flight = useMemo(
    () =>
      simulatePitch({
        type: pitch.type,
        velocityKmh: pitch.velocityKmh,
        rpm: pitch.rpm,
        plateX: pitch.plateX,
        plateY: pitch.plateY,
        throws: 'R',
        heightCm: height,
      }),
    [pitch, height],
  )
  const contact = useMemo(() => {
    if (pitch.action !== 'contact' || !pitch.contact) return null
    return presentContact(pitch.contact, stadiumById(stadiumId), pa.result)
  }, [pitch, stadiumId, pa.result])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-3xl text-foam">{playerName(players as never, pa.batterId)} 타석</h3>
      </div>
      <Field label="타자">
        <SelectInput value={pa.batterId} onChange={(event) => onPatchPa({ ...pa, batterId: event.target.value })}>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="타석 결과">
        <SelectInput
          value={pa.result ?? ''}
          onChange={(event) => onPatchPa({ ...pa, result: (event.target.value || null) as PlayResult | null })}
        >
          <option value="">공 카운트로 결정</option>
          {RESULTS.map((result) => (
            <option key={result} value={result}>
              {RESULT_LABEL[result]}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="flex flex-wrap gap-2">
        {pa.pitches.map((item, index) => (
          <Button key={item.id} size="sm" tone={index === pitchIndex ? 'amber' : 'ghost'} onClick={() => onPickPitch(index)}>
            {index + 1}구 {PITCH_LABEL[item.type]}
          </Button>
        ))}
        <Button
          size="sm"
          tone="ghost"
          onClick={() => {
            onPatchPa({ ...pa, pitches: [...pa.pitches, blankPitch()] })
            onPickPitch(pa.pitches.length)
          }}
        >
          공 추가
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((template) => (
          <Button
            key={template.label}
            size="sm"
            tone="ghost"
            onClick={() => {
              onPatchPitch({
                ...pitch,
                action: template.action,
                contact: template.contact ? { ...template.contact } : undefined,
                plateY: template.label === '볼넷' ? 0.35 : pitch.plateY,
                plateX: template.label === '볼넷' ? 0.28 : pitch.plateX,
              })
              if (template.result && template.action === 'contact') onPatchPa({ ...pa, result: template.result })
            }}
          >
            {template.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <ZonePad
          x={pitch.plateX}
          y={pitch.plateY}
          zone={zone}
          onPick={(plateX, plateY) => onPatchPitch({ ...pitch, plateX, plateY })}
        />
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="구종">
              <SelectInput value={pitch.type} onChange={(event) => onPatchPitch({ ...pitch, type: event.target.value as PitchType })}>
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PITCH_LABEL[type]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="타자 반응">
              <SelectInput value={pitch.action} onChange={(event) => onPatchPitch({ ...pitch, action: event.target.value as PitchAction, contact: event.target.value === 'contact' ? pitch.contact ?? blankPitch('contact').contact : undefined })}>
                {ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {ACTION_LABEL[action]}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <Slider label={`구속 ${pitch.velocityKmh}km/h`} value={pitch.velocityKmh} min={90} max={165} step={1} onChange={(velocityKmh) => onPatchPitch({ ...pitch, velocityKmh })} />
          <Slider label={`회전 ${pitch.rpm}rpm`} value={pitch.rpm} min={0} max={3200} step={10} onChange={(rpm) => onPatchPitch({ ...pitch, rpm })} />
          <p className="text-sm text-mist">
            {flight.inZone ? 'ABS 스트라이크' : 'ABS 볼'} · 무회전 대비 가로 {(flight.breakX * 100).toFixed(1)}cm · 세로{' '}
            {(flight.breakY * 100).toFixed(1)}cm. 회전이 높으면 솔기가 번지고 궤적이 휘어집니다.
          </p>
          <Toggle
            checked={Boolean(pitch.review)}
            onChange={(on) => onPatchPitch({ ...pitch, review: on ? { kind: 'abs', overturn: false } : undefined })}
            label="비디오 판독"
          />
          {pitch.review ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="판독 종류">
                <SelectInput
                  value={pitch.review.kind}
                  onChange={(event) => onPatchPitch({ ...pitch, review: { ...pitch.review!, kind: event.target.value as ReviewKind } })}
                >
                  {REVIEWS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Toggle
                checked={pitch.review.overturn}
                onChange={(overturn) => onPatchPitch({ ...pitch, review: { ...pitch.review!, overturn } })}
                label="현장 판정을 뒤집음"
              />
            </div>
          ) : null}
        </div>
      </div>
      {pitch.action === 'contact' && pitch.contact ? (
        <div className="space-y-3 rounded-2xl bg-ink/40 p-3">
          <Slider label={`타구속도 ${pitch.contact.exitVelocityKmh}km/h`} value={pitch.contact.exitVelocityKmh} min={70} max={190} step={1} onChange={(exitVelocityKmh) => onPatchPitch({ ...pitch, contact: { ...pitch.contact!, exitVelocityKmh } })} />
          <Slider label={`발사각 ${pitch.contact.launchAngle}°`} value={pitch.contact.launchAngle} min={-10} max={55} step={1} onChange={(launchAngle) => onPatchPitch({ ...pitch, contact: { ...pitch.contact!, launchAngle } })} />
          <Slider label={`방향 ${pitch.contact.sprayAngle}°`} value={pitch.contact.sprayAngle} min={-45} max={45} step={1} onChange={(sprayAngle) => onPatchPitch({ ...pitch, contact: { ...pitch.contact!, sprayAngle } })} />
          <Slider label={`타구 회전 ${pitch.contact.hitRpm}rpm`} value={pitch.contact.hitRpm} min={0} max={3200} step={10} onChange={(hitRpm) => onPatchPitch({ ...pitch, contact: { ...pitch.contact!, hitRpm } })} />
          <Slider
            label={`목표 비거리 ${pitch.contact.distanceM ?? 0}m`}
            value={pitch.contact.distanceM ?? 0}
            min={0}
            max={160}
            step={1}
            onChange={(distanceM) => onPatchPitch({ ...pitch, contact: { ...pitch.contact!, distanceM: distanceM === 0 ? null : distanceM } })}
          />
          {contact ? (
            <p className="text-sm text-foam">
              계산 비거리 {contact.distance.toFixed(1)}m · 체공 {contact.hang.toFixed(2)}초 · 최고점 {contact.apex.toFixed(1)}m
              {contact.cleared ? ' · 담장 넘김' : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Slider({
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
      {label}
      <div className="mt-1">
        <Range value={value} min={min} max={max} step={step} onChange={onChange} />
      </div>
    </label>
  )
}

function ZonePad({
  x,
  y,
  zone,
  onPick,
}: {
  x: number
  y: number
  zone: { top: number; bot: number; halfW: number }
  onPick: (x: number, y: number) => void
}) {
  const spanX = 0.9
  const yTop = 1.4
  const yBot = 0.2
  const left = ((-zone.halfW + spanX / 2) / spanX) * 100
  const width = ((zone.halfW * 2) / spanX) * 100
  const top = ((yTop - zone.top) / (yTop - yBot)) * 100
  const height = ((zone.top - zone.bot) / (yTop - yBot)) * 100
  const dotX = ((x + spanX / 2) / spanX) * 100
  const dotY = ((yTop - y) / (yTop - yBot)) * 100
  return (
    <button
      type="button"
      className="relative h-72 w-full rounded-2xl bg-[#123024]"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const u = (event.clientX - rect.left) / rect.width
        const v = (event.clientY - rect.top) / rect.height
        onPick((u - 0.5) * spanX, yTop - v * (yTop - yBot))
      }}
    >
      <span className="absolute border-2 border-amber/80" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }} />
      <span className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: `${dotX}%`, top: `${dotY}%` }} />
      <span className="absolute bottom-2 left-2 text-[10px] text-mist">존을 눌러 코스를 정합니다</span>
    </button>
  )
}
