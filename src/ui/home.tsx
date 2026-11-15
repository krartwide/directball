import { STADIUMS } from '../data/stadiums.ts'
import { useLibrary } from './store.tsx'
import { Button } from './controls.tsx'

export function HomePage() {
  const { teams, matches, players, addMatch, reseed } = useLibrary()
  const featured = matches.find((match) => match.id === 'm-walkoff') ?? matches[0]

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs font-bold tracking-[0.22em] text-amber">DIRECTBALL</p>
          <h1 className="mt-2 font-display text-5xl leading-none text-foam sm:text-7xl">한 구씩 경기를 찍는다</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-mist">
            구단과 선수를 만들고, 실제 크기 구장을 고른 뒤 공 하나마다 구종과 회전, 타구를 정해 중계를 만듭니다.
            결과는 감독이 정하고, 공의 궤적은 구속과 회전수, 발사각으로 계산됩니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {featured ? (
              <Button onClick={() => (location.hash = `#/watch/${featured.id}`)}>샘플 경기로 입장</Button>
            ) : null}
            <Button tone="ghost" onClick={() => void addMatch()} disabled={teams.length < 2}>
              새 경기
            </Button>
            <Button tone="ghost" onClick={() => (location.hash = '#/teams')}>
              구단 작업실
            </Button>
          </div>
        </div>
        <div className="rounded-3xl border border-line bg-panel p-5">
          <p className="text-xs font-bold text-amber">지금 라이브러리</p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="구단" value={teams.length} />
            <Stat label="선수" value={players.length} />
            <Stat label="경기" value={matches.length} />
          </dl>
          <p className="mt-4 text-sm leading-6 text-mist">
            샘플은 가상의 네 구단입니다. 잠실 끝내기와 사직 세이브가 들어 있습니다. 구장 담장 거리는 공개된 수치이고,
            폴대 사이 곡선은 그 구장에 맞춰 이었습니다.
          </p>
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl text-foam">들어 있는 중계</h2>
        {matches.length === 0 ? (
          <p className="mt-3 text-mist">아직 경기가 없습니다. 구단을 만든 뒤 새 경기를 여세요.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {matches.map((match) => {
              const home = teams.find((team) => team.id === match.homeTeamId)
              const away = teams.find((team) => team.id === match.awayTeamId)
              const park = STADIUMS.find((stadium) => stadium.id === match.stadiumId)
              return (
                <article key={match.id} className="rounded-3xl border border-line bg-panel-2 p-4">
                  <p className="text-xs text-amber">{park?.name ?? match.stadiumId}</p>
                  <h3 className="mt-1 font-display text-3xl text-foam">{match.title}</h3>
                  <p className="mt-1 text-sm text-mist">
                    {away?.name ?? '원정'} @ {home?.name ?? '홈'} · {match.events.length}장면
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" onClick={() => (location.hash = `#/watch/${match.id}`)}>
                      감상
                    </Button>
                    <Button size="sm" tone="ghost" onClick={() => (location.hash = `#/match/${match.id}`)}>
                      연출
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-white/5 p-4">
        <p className="text-sm text-mist">샘플을 고쳤다면 처음 데이터로 되돌릴 수 있습니다. 직접 만든 구단도 지워집니다.</p>
        <Button tone="danger" size="sm" onClick={() => void reseed()}>
          샘플로 되돌리기
        </Button>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-ink/50 py-3">
      <div className="font-display text-4xl text-foam">{value}</div>
      <div className="text-xs text-mist">{label}</div>
    </div>
  )
}
