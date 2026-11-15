import { useEffect, useState } from 'react'
import { POSITION_LABEL, type Team } from '../types.ts'
import { Button, Field, TextInput } from './controls.tsx'
import { useLibrary } from './store.tsx'

export function TeamsPage() {
  const { teams, addTeam } = useLibrary()
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl text-foam">구단</h1>
          <p className="mt-2 text-sm text-mist">이름과 엠블럼을 정하면 그 색이 유니폼과 관중석에 들어갑니다.</p>
        </div>
        <Button onClick={() => void addTeam()}>구단 추가</Button>
      </div>
      {teams.length === 0 ? (
        <p className="mt-8 text-mist">구단이 없습니다. 하나 만들면 선수를 넣을 수 있습니다.</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => (location.hash = `#/team/${team.id}`)}
              className="flex items-center gap-4 rounded-3xl border border-line bg-panel p-4 text-left hover:border-amber"
            >
              <Emblem team={team} />
              <span>
                <span className="block font-display text-3xl text-foam">{team.name}</span>
                <span className="text-sm text-mist">{team.city}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TeamPage({ id }: { id: string }) {
  const { teams, players, saveTeam, deleteTeam, addPlayer } = useLibrary()
  const team = teams.find((item) => item.id === id)
  const [draft, setDraft] = useState<Team | null>(team ?? null)

  useEffect(() => {
    setDraft(team ?? null)
  }, [id, team])

  useEffect(() => {
    if (!draft || !team) return
    if (JSON.stringify(draft) === JSON.stringify(team)) return
    const timer = window.setTimeout(() => void saveTeam(draft), 280)
    return () => window.clearTimeout(timer)
  }, [draft, team, saveTeam])

  if (!draft || !team) return <p className="text-mist">이 구단을 찾지 못했습니다.</p>
  const roster = players.filter((player) => player.teamId === team.id)

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section className="rounded-3xl border border-line bg-panel p-4">
        <Emblem team={draft} large />
        <div className="mt-4 space-y-3">
          <Field label="구단명">
            <TextInput value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>
          <Field label="짧은 이름">
            <TextInput value={draft.short} onChange={(event) => setDraft({ ...draft, short: event.target.value })} />
          </Field>
          <Field label="도시">
            <TextInput value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="주 색">
              <input type="color" value={draft.primary} onChange={(event) => setDraft({ ...draft, primary: event.target.value })} className="h-10 w-full bg-transparent" />
            </Field>
            <Field label="보조 색">
              <input type="color" value={draft.secondary} onChange={(event) => setDraft({ ...draft, secondary: event.target.value })} className="h-10 w-full bg-transparent" />
            </Field>
          </div>
          <Field label="엠블럼 그림">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => setDraft({ ...draft, emblem: String(reader.result) })
                reader.readAsDataURL(file)
              }}
              className="text-sm text-mist"
            />
          </Field>
        </div>
        <Button
          tone="danger"
          size="sm"
          className="mt-5"
          onClick={() => {
            void deleteTeam(team.id)
            location.hash = '#/teams'
          }}
        >
          구단 삭제
        </Button>
      </section>
      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-4xl text-foam">선수 {roster.length}</h2>
          <Button onClick={() => void addPlayer(team.id)}>선수 추가</Button>
        </div>
        {roster.length === 0 ? (
          <p className="mt-4 text-mist">아직 선수가 없습니다. 타자는 루틴과 스윙, 세리머니를, 투수는 투구폼만 만들면 됩니다.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-3xl border border-line bg-panel">
            {roster.map((player) => (
              <li key={player.id}>
                <button
                  onClick={() => (location.hash = `#/player/${player.id}`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/5"
                >
                  <span>
                    <span className="font-mono text-amber">{player.number}</span>
                    <span className="ml-3 text-foam">{player.name}</span>
                  </span>
                  <span className="text-sm text-mist">{POSITION_LABEL[player.position]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Emblem({ team, large = false }: { team: Team; large?: boolean }) {
  const size = large ? 'size-28' : 'size-14'
  return team.emblem ? (
    <img src={team.emblem} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <span className={`${size} grid place-items-center rounded-full font-display text-2xl text-ink`} style={{ background: team.primary }}>
      {team.short.slice(0, 1)}
    </span>
  )
}

