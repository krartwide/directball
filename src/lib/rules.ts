import { pitchInZone } from './field.ts'
import type {
  GameState,
  Half,
  Match,
  MatchEvent,
  Pitch,
  PlayResult,
  Player,
} from '../types.ts'

export function openingState(match: Match): GameState {
  const opening = match.opening
  return {
    inning: opening.inning,
    half: opening.half,
    outs: opening.outs,
    balls: 0,
    strikes: 0,
    bases: [...opening.bases] as GameState['bases'],
    awayScore: opening.awayScore,
    homeScore: opening.homeScore,
    awayBatterIndex: opening.awayBatterIndex,
    homeBatterIndex: opening.homeBatterIndex,
    awayPitcherId: match.awayPitcherId,
    homePitcherId: match.homePitcherId,
    gameOver: false,
    walkoff: false,
  }
}

export function cloneState(state: GameState): GameState {
  return { ...state, bases: [...state.bases] }
}

export function battingSide(state: GameState): 'home' | 'away' {
  return state.half === 'bottom' ? 'home' : 'away'
}

export function defenseSide(state: GameState): 'home' | 'away' {
  return state.half === 'bottom' ? 'away' : 'home'
}

export function lineupOf(match: Match, side: 'home' | 'away'): string[] {
  return side === 'home' ? match.homeLineup : match.awayLineup
}

export function batterId(match: Match, state: GameState): string {
  const side = battingSide(state)
  const lineup = lineupOf(match, side)
  const index = side === 'home' ? state.homeBatterIndex : state.awayBatterIndex
  return lineup[index % Math.max(1, lineup.length)] ?? ''
}

export function pitcherId(state: GameState): string {
  return defenseSide(state) === 'home' ? state.homePitcherId : state.awayPitcherId
}

export type PitchStep = {
  call: 'ball' | 'strike' | 'foul' | 'inplay' | 'hbp'
  ended: boolean
  state: GameState
}

export function stepPitch(prev: GameState, pitch: Pitch, heightCm: number): PitchStep {
  const state = cloneState(prev)
  if (state.gameOver) return { call: 'ball', ended: true, state }
  if (pitch.action === 'hbp') return { call: 'hbp', ended: true, state }
  if (pitch.action === 'contact') return { call: 'inplay', ended: true, state }
  if (pitch.action === 'foul') {
    if (state.strikes < 2) state.strikes += 1
    return { call: 'foul', ended: false, state }
  }
  if (pitch.action === 'swing_miss') {
    state.strikes += 1
    return { call: 'strike', ended: state.strikes >= 3, state }
  }
  const strike = pitchInZone(pitch.plateX, pitch.plateY, heightCm)
  if (strike) {
    state.strikes += 1
    return { call: 'strike', ended: state.strikes >= 3, state }
  }
  state.balls += 1
  return { call: 'ball', ended: state.balls >= 4, state }
}

function forceWalk(state: GameState, batter: string): number {
  let runs = 0
  const [r1, r2, r3] = state.bases
  let n1 = r1
  let n2 = r2
  let n3 = r3
  if (n1) {
    if (n2) {
      if (n3) runs += 1
      n3 = n2
    }
    n2 = n1
  }
  n1 = batter
  state.bases = [n1, n2, n3]
  return runs
}

function moveRunners(state: GameState, batter: string, steps: number, batterBase: number): number {
  let runs = 0
  const next: GameState['bases'] = [null, null, null]
  for (let i = 0; i < 3; i += 1) {
    const id = state.bases[i]
    if (!id) continue
    const dest = i + 1 + steps
    if (dest >= 4) runs += 1
    else next[dest - 1] = id
  }
  if (batterBase >= 4) runs += 1
  else if (batterBase >= 1) next[batterBase - 1] = batter
  state.bases = next
  return runs
}

function addRuns(state: GameState, runs: number) {
  if (state.half === 'bottom') state.homeScore += runs
  else state.awayScore += runs
}

function endHalf(state: GameState) {
  state.outs = 0
  state.balls = 0
  state.strikes = 0
  state.bases = [null, null, null]
  if (state.half === 'top') {
    if (state.inning >= 9 && state.homeScore > state.awayScore) {
      state.gameOver = true
      return
    }
    state.half = 'bottom'
    return
  }
  if (state.inning >= 9 && state.homeScore !== state.awayScore) {
    state.gameOver = true
    return
  }
  state.half = 'top'
  state.inning += 1
}

function finishPa(state: GameState, side: 'home' | 'away') {
  state.balls = 0
  state.strikes = 0
  if (side === 'home') state.homeBatterIndex += 1
  else state.awayBatterIndex += 1
  if (state.half === 'bottom' && state.inning >= 9 && state.homeScore > state.awayScore) {
    state.gameOver = true
    state.walkoff = true
    return
  }
  if (state.outs >= 3) endHalf(state)
}

export function applyResult(prev: GameState, batter: string, result: PlayResult): GameState {
  const state = cloneState(prev)
  const side = battingSide(state)
  const outsBefore = state.outs
  let runs = 0

  if (result === 'strikeout' || result === 'flyout' || result === 'lineout' || result === 'popup' || result === 'groundout') {
    state.outs += 1
  } else if (result === 'sac_fly') {
    state.outs += 1
    if (state.bases[2] && outsBefore < 2) {
      runs += 1
      state.bases[2] = null
    }
  } else if (result === 'sac_bunt') {
    state.outs += 1
    if (outsBefore < 2) runs += forceAdvance(state)
  } else if (result === 'gidp') {
    if (state.bases[0]) {
      state.outs = Math.min(3, outsBefore + 2)
      state.bases[0] = null
      if (state.outs < 3) {
        if (state.bases[2]) runs += 1
        state.bases[2] = state.bases[1]
        state.bases[1] = null
      }
    } else {
      state.outs += 1
    }
  } else if (result === 'walk' || result === 'hbp') {
    runs += forceWalk(state, batter)
  } else if (result === 'single' || result === 'infield_hit' || result === 'error') {
    runs += moveRunners(state, batter, 1, 1)
  } else if (result === 'double') {
    runs += moveRunners(state, batter, 2, 2)
  } else if (result === 'triple') {
    runs += moveRunners(state, batter, 3, 3)
  } else if (result === 'homer') {
    runs += state.bases.filter(Boolean).length + 1
    state.bases = [null, null, null]
  } else if (result === 'fielders_choice') {
    state.outs += 1
    const lead = state.bases[2] ? 2 : state.bases[1] ? 1 : state.bases[0] ? 0 : -1
    if (lead === 0 || lead === 1 || lead === 2) state.bases[lead] = null
    if (!state.bases[0]) state.bases[0] = batter
  }

  addRuns(state, runs)
  finishPa(state, side)
  return state
}

function forceAdvance(state: GameState): number {
  let runs = 0
  if (state.bases[2]) {
    runs += 1
    state.bases[2] = null
  }
  state.bases[2] = state.bases[1]
  state.bases[1] = state.bases[0]
  state.bases[0] = null
  return runs
}

export function resultOfPa(pitches: Pitch[], heightCm: number, stated: PlayResult | null): PlayResult | null {
  const blank = openingState({
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
    awayPitcherId: '',
    homePitcherId: '',
  } as Match)
  let state = blank
  for (const pitch of pitches) {
    const step = stepPitch(state, pitch, heightCm)
    state = step.state
    if (!step.ended) continue
    if (step.call === 'inplay') return stated ?? 'single'
    if (step.call === 'hbp') return 'hbp'
    if (state.strikes >= 3) return 'strikeout'
    if (state.balls >= 4) return 'walk'
  }
  return null
}

export type ScriptRow = {
  index: number
  inning: number
  half: Half
  label: string
  score: string
  outs: number
  stateBefore: GameState
}

export function playerName(players: Player[], id: string | null): string {
  if (!id) return '—'
  return players.find((player) => player.id === id)?.name ?? '빠진 선수'
}

export function simulateScript(match: Match, players: Player[]): { rows: ScriptRow[]; final: GameState } {
  let state = openingState(match)
  const rows: ScriptRow[] = []
  match.events.forEach((event, index) => {
    if (state.gameOver) return
    const before = cloneState(state)
    const label = describeEvent(match, state, event, players)
    rows.push({
      index,
      inning: state.inning,
      half: state.half,
      label,
      score: `${state.awayScore}-${state.homeScore}`,
      outs: state.outs,
      stateBefore: before,
    })
    state = applyEvent(match, state, event, players)
  })
  return { rows, final: state }
}

export function applyEvent(match: Match, prev: GameState, event: MatchEvent, players: Player[]): GameState {
  const state = cloneState(prev)
  if (state.gameOver) return state
  if (event.kind === 'mound') {
    if (event.team === 'home') state.homePitcherId = event.pitcherId
    else state.awayPitcherId = event.pitcherId
    return state
  }
  if (event.kind === 'steal') {
    const fromIndex = event.from - 1
    const runner = state.bases[fromIndex]
    if (!runner) return state
    const dest = event.from + 1
    const overturn = event.review?.overturn ?? false
    const success = overturn ? !event.success : event.success
    if (success) {
      state.bases[fromIndex] = null
      if (dest >= 4) {
        if (state.half === 'bottom') state.homeScore += 1
        else state.awayScore += 1
      } else state.bases[dest - 1] = runner
    } else {
      state.bases[fromIndex] = null
      state.outs += 1
      if (state.outs >= 3) endHalf(state)
    }
    if (state.half === 'bottom' && state.inning >= 9 && state.homeScore > state.awayScore) {
      state.gameOver = true
      state.walkoff = true
    }
    return state
  }
  const batter = event.batterId || batterId(match, state)
  const height = players.find((player) => player.id === batter)?.body.heightCm ?? 180
  let cursor = state
  let ended = false
  let call: PitchStep['call'] = 'ball'
  for (const pitch of event.pitches) {
    const step = stepPitch(cursor, pitch, height)
    cursor = step.state
    if (step.ended) {
      ended = true
      call = step.call
      break
    }
  }
  if (!ended) return cursor
  if (call === 'inplay') return applyResult(cursor, batter, event.result ?? 'single')
  if (call === 'hbp') return applyResult(cursor, batter, 'hbp')
  if (cursor.strikes >= 3) return applyResult(cursor, batter, 'strikeout')
  if (cursor.balls >= 4) return applyResult(cursor, batter, 'walk')
  return cursor
}

function describeEvent(match: Match, state: GameState, event: MatchEvent, players: Player[]): string {
  if (event.kind === 'mound') return `투수 교체 · ${playerName(players, event.pitcherId)}`
  if (event.kind === 'steal') {
    const base = event.from + 1
    return `${event.from}루 주자 ${event.success ? `${base === 4 ? '홈 스틸' : `${base}루 도루`}` : '도루 실패'}`
  }
  const batter = playerName(players, event.batterId || batterId(match, state))
  const height = players.find((player) => player.id === event.batterId)?.body.heightCm ?? 180
  const result = resultOfPa(event.pitches, height, event.result)
  return `${batter} · ${result ? resultLabel(result) : `${event.pitches.length}구 진행 중`}`
}

function resultLabel(result: PlayResult): string {
  const map: Record<PlayResult, string> = {
    strikeout: '삼진',
    walk: '볼넷',
    hbp: '사구',
    single: '안타',
    double: '2루타',
    triple: '3루타',
    homer: '홈런',
    infield_hit: '내야 안타',
    flyout: '플라이 아웃',
    lineout: '직선타 아웃',
    popup: '내야 뜬공',
    groundout: '땅볼 아웃',
    sac_fly: '희생플라이',
    sac_bunt: '희생번트',
    gidp: '병살',
    fielders_choice: '야수 선택',
    error: '실책',
  }
  return map[result]
}

export function inningLabel(inning: number, half: Half): string {
  return `${inning}회${half === 'top' ? '초' : '말'}`
}
