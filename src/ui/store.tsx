import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createSampleLibrary } from '../data/sample.ts'
import { erase, loadLibrary, persist, wipe } from '../lib/db.ts'
import { defaultAnims } from '../lib/clips.ts'
import { buildHeadTexture, skinFromSeed } from '../lib/face.ts'
import { uid } from '../lib/id.ts'
import type { Match, Player, Team } from '../types.ts'

type Library = {
  ready: boolean
  teams: Team[]
  players: Player[]
  matches: Match[]
  saveTeam: (team: Team) => Promise<void>
  savePlayer: (player: Player) => Promise<void>
  saveMatch: (match: Match) => Promise<void>
  deleteTeam: (id: string) => Promise<void>
  deletePlayer: (id: string) => Promise<void>
  deleteMatch: (id: string) => Promise<void>
  addTeam: () => Promise<void>
  addPlayer: (teamId: string) => Promise<void>
  addMatch: () => Promise<void>
  reseed: () => Promise<void>
}

const Ctx = createContext<Library | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])

  useEffect(() => {
    void (async () => {
      const loaded = await loadLibrary()
      if (loaded.teams.length === 0) {
        const sample = await createSampleLibrary()
        for (const team of sample.teams) await persist('teams', team)
        for (const player of sample.players) await persist('players', player)
        for (const match of sample.matches) await persist('matches', match)
        setTeams(sample.teams)
        setPlayers(sample.players)
        setMatches(sample.matches)
      } else {
        setTeams(loaded.teams)
        setPlayers(loaded.players)
        setMatches(loaded.matches)
      }
      setReady(true)
    })()
  }, [])

  const api = useMemo<Library>(
    () => ({
      ready,
      teams,
      players,
      matches,
      async saveTeam(team) {
        await persist('teams', team)
        setTeams((list) => (list.some((item) => item.id === team.id) ? list.map((item) => (item.id === team.id ? team : item)) : [...list, team]))
      },
      async savePlayer(player) {
        await persist('players', player)
        setPlayers((list) => (list.some((item) => item.id === player.id) ? list.map((item) => (item.id === player.id ? player : item)) : [...list, player]))
      },
      async saveMatch(match) {
        await persist('matches', match)
        setMatches((list) => (list.some((item) => item.id === match.id) ? list.map((item) => (item.id === match.id ? match : item)) : [...list, match]))
      },
      async deleteTeam(id) {
        await erase('teams', id)
        const owned = players.filter((player) => player.teamId === id)
        for (const player of owned) await erase('players', player.id)
        setTeams((list) => list.filter((item) => item.id !== id))
        setPlayers((list) => list.filter((item) => item.teamId !== id))
      },
      async deletePlayer(id) {
        await erase('players', id)
        setPlayers((list) => list.filter((item) => item.id !== id))
      },
      async deleteMatch(id) {
        await erase('matches', id)
        setMatches((list) => list.filter((item) => item.id !== id))
      },
      async addTeam() {
        const team: Team = {
          id: uid('team'),
          name: '새 구단',
          short: '신규',
          city: '서울',
          primary: '#f0b429',
          secondary: '#102019',
        }
        await persist('teams', team)
        setTeams((list) => [...list, team])
        location.hash = `#/team/${team.id}`
      },
      async addPlayer(teamId) {
        const id = uid('player')
        const colors = skinFromSeed(id)
        const faceTexture = await buildHeadTexture({ style: 'card', skin: colors.skin, hair: colors.hair, seed: id })
        const player: Player = {
          id,
          teamId,
          name: '새 선수',
          number: 1,
          position: 'CF',
          bats: 'R',
          throws: 'R',
          body: { heightCm: 182, build: 0.45, shoulder: 1, armLength: 1, legLength: 1, headScale: 1 },
          skin: colors.skin,
          hair: colors.hair,
          faceStyle: 'card',
          faceTexture,
          anims: defaultAnims('R', 'R'),
        }
        await persist('players', player)
        setPlayers((list) => [...list, player])
        location.hash = `#/player/${player.id}`
      },
      async addMatch() {
        const home = teams[0]
        const away = teams[1] ?? teams[0]
        if (!home || !away) return
        const homePlayers = players.filter((player) => player.teamId === home.id)
        const awayPlayers = players.filter((player) => player.teamId === away.id)
        const match: Match = {
          id: uid('match'),
          title: `${away.short} @ ${home.short}`,
          homeTeamId: home.id,
          awayTeamId: away.id,
          stadiumId: 'jamsil',
          night: true,
          dateLabel: '',
          homeLineup: homePlayers.filter((player) => player.position !== 'P').slice(0, 9).map((player) => player.id),
          awayLineup: awayPlayers.filter((player) => player.position !== 'P').slice(0, 9).map((player) => player.id),
          homePitcherId: homePlayers.find((player) => player.position === 'P')?.id ?? homePlayers[0]?.id ?? '',
          awayPitcherId: awayPlayers.find((player) => player.position === 'P')?.id ?? awayPlayers[0]?.id ?? '',
          opening: {
            inning: 1,
            half: 'top',
            outs: 0,
            awayScore: 0,
            homeScore: 0,
            bases: [null, null, null],
            awayBatterIndex: 0,
            homeBatterIndex: 0,
          },
          events: [],
          createdAt: Date.now(),
        }
        await persist('matches', match)
        setMatches((list) => [...list, match])
        location.hash = `#/match/${match.id}`
      },
      async reseed() {
        await wipe()
        const sample = await createSampleLibrary()
        for (const team of sample.teams) await persist('teams', team)
        for (const player of sample.players) await persist('players', player)
        for (const match of sample.matches) await persist('matches', match)
        setTeams(sample.teams)
        setPlayers(sample.players)
        setMatches(sample.matches)
      },
    }),
    [ready, teams, players, matches],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useLibrary() {
  const value = useContext(Ctx)
  if (!value) throw new Error('library')
  return value
}
