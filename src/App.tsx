import { useEffect, useState } from 'react'
import { HomePage } from './ui/home.tsx'
import { PlayerPage } from './ui/player.tsx'
import { MatchPage } from './ui/match.tsx'
import { StoreProvider, useLibrary } from './ui/store.tsx'
import { TeamPage, TeamsPage } from './ui/teams.tsx'
import { WatchPage } from './ui/watch.tsx'

function routeOf(hash: string) {
  const path = (hash || '#/').replace(/^#/, '')
  const parts = path.split('/').filter(Boolean)
  return { parts }
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const { ready } = useLibrary()
  const [hash, setHash] = useState(() => location.hash || '#/')
  useEffect(() => {
    const onHash = () => setHash(location.hash || '#/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const { parts } = routeOf(hash)
  const page = parts[0] ?? ''
  const id = parts[1] ?? ''

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <a href="#/" className="font-display text-2xl tracking-wide text-foam">
            다이렉트볼
          </a>
          <nav className="flex gap-3 text-sm text-mist">
            <a href="#/" className={page === '' ? 'text-amber' : ''}>
              중계
            </a>
            <a href="#/teams" className={page === 'teams' || page === 'team' ? 'text-amber' : ''}>
              구단
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!ready ? <p className="text-mist">구단과 선수를 불러오는 중입니다.</p> : null}
        {ready && page === '' ? <HomePage /> : null}
        {ready && page === 'teams' ? <TeamsPage /> : null}
        {ready && page === 'team' ? <TeamPage id={id} /> : null}
        {ready && page === 'player' ? <PlayerPage id={id} /> : null}
        {ready && page === 'match' ? <MatchPage id={id} /> : null}
        {ready && page === 'watch' ? <WatchPage id={id} /> : null}
        {ready && !['', 'teams', 'team', 'player', 'match', 'watch'].includes(page) ? (
          <p className="text-mist">없는 화면입니다.</p>
        ) : null}
      </main>
    </div>
  )
}
