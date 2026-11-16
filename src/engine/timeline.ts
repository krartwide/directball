import { PITCH_LABEL, RESULT_LABEL, type GameState, type Match, type Pitch, type Player, type Team } from '../types.ts'
import { stadiumById, fenceHeight } from '../data/stadiums.ts'
import {
  alongBases,
  BASES,
  batterSpot,
  DEFENSE,
  dugoutAnchor,
  greetSpot,
  introSpot,
  pitchInZone,
  smooth,
  yawToward,
  zoneFor,
  type Spot,
} from '../lib/field.ts'
import { PITCH_RELEASE, SWING_CONTACT } from '../lib/clips.ts'
import { presentContact, sampleAt, simulatePitch, type ContactFlight, type PitchFlight } from '../lib/physics.ts'
import { applyEvent, battingSide, cloneState, defenseSide, inningLabel, openingState, pitcherId, stepPitch } from '../lib/rules.ts'
import type { BuiltInClip } from '../lib/clips.ts'
import { look, type Cue, type Frame, type Hud, type Place } from './api.ts'

const SET = 0.75
const WIND = 1.05

type Defender = { player: Player; spot: Spot; pos: string }

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function put(frame: Frame, id: string, place: Place) {
  frame.places.set(id, place)
}

export function buildCues(match: Match, teams: Team[], players: Player[]): Cue[] {
  const home = teams.find((team) => team.id === match.homeTeamId)
  const away = teams.find((team) => team.id === match.awayTeamId)
  if (!home || !away) return []
  const stadium = stadiumById(match.stadiumId)
  const homeSide = stadium.homeDugout
  const awaySide = homeSide === 'first' ? 'third' : 'first'
  const byId = new Map(players.map((player) => [player.id, player]))
  const cues: Cue[] = []
  let clock = 0
  let state = openingState(match)
  const used = {
    home: new Set([match.homePitcherId]),
    away: new Set([match.awayPitcherId]),
  }
  let hero = ''

  const hudOf = (extra: Partial<Hud> = {}): Hud => ({
    away: away.short,
    home: home.short,
    awayColor: away.primary,
    homeColor: home.primary,
    awayScore: state.awayScore,
    homeScore: state.homeScore,
    inning: state.inning,
    half: state.half,
    outs: state.outs,
    balls: state.balls,
    strikes: state.strikes,
    bases: [Boolean(state.bases[0]), Boolean(state.bases[1]), Boolean(state.bases[2])],
    replay: false,
    ...extra,
  })

  const push = (dur: number, make: (t0: number) => Omit<Cue, 't0' | 't1'>) => {
    const snap = cloneState(state)
    const t0 = clock
    const body = make(t0)
    const apply = body.apply
    const hud = body.hud
    cues.push({
      ...body,
      t0,
      t1: t0 + dur,
      apply: (frame, local) => {
        const saved = state
        state = snap
        try {
          apply(frame, local)
        } finally {
          state = saved
        }
      },
      hud: (local) => {
        const saved = state
        state = snap
        try {
          return hud(local)
        } finally {
          state = saved
        }
      },
    })
    clock += dur
  }

  const roster = (side: 'home' | 'away') =>
    players.filter((player) => player.teamId === (side === 'home' ? home.id : away.id))

  const lineupIds = (side: 'home' | 'away') => (side === 'home' ? match.homeLineup : match.awayLineup)

  const defenders = (side: 'home' | 'away', snapshot: GameState): Defender[] => {
    const list: Defender[] = []
    const seen = new Set<string>()
    for (const id of lineupIds(side)) {
      const player = byId.get(id)
      if (!player || player.position === 'DH' || player.position === 'P') continue
      const spot = DEFENSE[player.position]
      if (!spot) continue
      list.push({ player, spot, pos: player.position })
      seen.add(player.id)
    }
    const pitcher = byId.get(side === 'home' ? snapshot.homePitcherId : snapshot.awayPitcherId)
    if (pitcher) {
      list.push({ player: pitcher, spot: DEFENSE.P, pos: 'P' })
      seen.add(pitcher.id)
    }
    const needed = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const
    for (const pos of needed) {
      if (list.some((item) => item.pos === pos)) continue
      const spare = roster(side).find((player) => !seen.has(player.id) && player.position !== 'P')
      if (!spare) continue
      seen.add(spare.id)
      list.push({ player: spare, spot: DEFENSE[pos], pos })
    }
    return list
  }

  const placeDefense = (frame: Frame, snapshot: GameState, time: number, clip: BuiltInClip = 'ready') => {
    const side = defenseSide(snapshot)
    for (const defender of defenders(side, snapshot)) {
      const isPitcher = defender.pos === 'P'
      const isCatcher = defender.pos === 'C'
      put(frame, defender.player.id, {
        x: defender.spot.x,
        y: 0,
        z: defender.spot.z,
        yaw: defender.spot.yaw,
        clip: isPitcher ? 'idle' : isCatcher ? 'crouch' : clip,
        time,
        glove: true,
        hat: 'cap',
      })
    }
  }

  const placeUmpires = (frame: Frame, time: number, clip: BuiltInClip = 'umpIdle') => {
    put(frame, 'ump-hp', { x: 0, y: 0, z: -3.35, yaw: 0, clip, time, hat: 'cap', glove: false })
    put(frame, 'ump-1b', { x: BASES.first.x + 3.2, y: 0, z: BASES.first.z - 2.4, yaw: yawToward(BASES.first.x, BASES.first.z), clip: 'umpIdle', time, hat: 'cap', glove: false })
    put(frame, 'ump-2b', { x: 4.5, y: 0, z: BASES.second.z + 3, yaw: Math.PI, clip: 'umpIdle', time, hat: 'cap', glove: false })
    put(frame, 'ump-3b', { x: BASES.third.x - 3.2, y: 0, z: BASES.third.z - 2.4, yaw: yawToward(BASES.third.x, BASES.third.z), clip: 'umpIdle', time, hat: 'cap', glove: false })
  }

  const placeBench = (frame: Frame, side: 'home' | 'away', except: Set<string>, time: number) => {
    const dug = side === 'home' ? homeSide : awaySide
    const anchor = dugoutAnchor(dug)
    let i = 0
    for (const player of roster(side)) {
      if (except.has(player.id)) continue
      const col = i % 6
      const row = Math.floor(i / 6)
      const sign = dug === 'first' ? 1 : -1
      put(frame, player.id, {
        x: anchor.x + sign * col * 0.7,
        y: 0,
        z: anchor.z - row * 0.55,
        yaw: sign > 0 ? -Math.PI / 2 : Math.PI / 2,
        clip: 'idle',
        time,
        hat: 'cap',
        glove: false,
      })
      i += 1
    }
  }

  const fieldExcept = (snapshot: GameState) => {
    const ids = new Set<string>()
    for (const defender of defenders(defenseSide(snapshot), snapshot)) ids.add(defender.player.id)
    snapshot.bases.forEach((id) => id && ids.add(id))
    return ids
  }

  push(5.2, () => ({
    label: stadium.name,
    highlight: false,
    cut: false,
    sfx: [],
    apply: (frame, local) => {
      frame.crowd = 0.45
      placeBench(frame, 'home', new Set(), local)
      placeBench(frame, 'away', new Set(), local)
      placeUmpires(frame, local)
    },
    camera: (local) => {
      const u = smooth(local / 5.2)
      return look(
        [mix(0, 14, u), mix(24, 11, u), mix(-34, -12, u)],
        [0, 2, mix(16, 12, u)],
        mix(52, 34, u),
      )
    },
    hud: () => hudOf({ lower: { kicker: stadium.city, title: stadium.name, detail: match.dateLabel || '플레이볼' }, banner: localBanner() }),
  }))

  const enter = (side: 'home' | 'away', dug: 'first' | 'third') => {
    const ids = lineupIds(side).slice(0, 9)
    push(7.2, () => ({
      label: side === 'home' ? `${home.short} 입장` : `${away.short} 입장`,
      highlight: false,
      cut: true,
      sfx: [],
      apply: (frame, local) => {
        frame.crowd = 0.55
        const moving = new Set<string>()
        ids.forEach((id, index) => {
          const player = byId.get(id)
          if (!player) return
          const from = dugoutAnchor(dug)
          const to = introSpot(dug, index)
          const u = smooth(clamp((local - index * 0.28) / 2.1, 0, 1))
          moving.add(id)
          put(frame, id, {
            x: mix(from.x, to.x, u),
            y: 0,
            z: mix(from.z, to.z, u),
            yaw: to.yaw,
            clip: u < 0.98 ? 'jog' : 'bow',
            time: u < 0.98 ? local : Math.max(0, local - index * 0.28 - 2.1),
            hat: 'cap',
            glove: player.position !== 'DH',
          })
        })
        placeBench(frame, side, moving, local)
        placeBench(frame, side === 'home' ? 'away' : 'home', new Set(), local)
        placeUmpires(frame, local)
      },
      camera: () => look(dug === 'first' ? [18, 6, 8] : [-18, 6, 8], [0, 1.4, 6], 32),
      hud: (local) => {
        const index = clamp(Math.floor(local / 0.7), 0, ids.length - 1)
        const player = byId.get(ids[index] ?? '')
        return hudOf({
          lower: player
            ? { kicker: side === 'home' ? home.name : away.name, title: `${player.number}  ${player.name}`, detail: player.position }
            : undefined,
        })
      },
    }))
  }
  enter('away', awaySide)
  enter('home', homeSide)

  push(8.4, () => ({
    label: '인사',
    highlight: false,
    cut: true,
    sfx: [],
    apply: (frame, local) => {
      frame.crowd = 0.6
      const greet = (side: 'home' | 'away', dug: 'first' | 'third') => {
        lineupIds(side).slice(0, 9).forEach((id, index) => {
          const open = introSpot(dug, index)
          const closedAmount = local < 3.2 ? smooth(local / 3.2) : local < 5.4 ? 1 : smooth(1 - (local - 5.4) / 2.4)
          const spot = greetSpot(dug, index, closedAmount)
          const bowing = local >= 3.15 && local < 5.5
          put(frame, id, {
            x: local < 3.2 ? mix(open.x, spot.x, smooth(local / 3.2)) : spot.x,
            y: 0,
            z: local < 3.2 ? mix(open.z, spot.z, smooth(local / 3.2)) : spot.z,
            yaw: spot.yaw,
            clip: bowing ? 'bow' : 'jog',
            time: bowing ? local - 3.15 + index * 0.05 : local,
            hat: 'cap',
            glove: false,
          })
        })
      }
      greet('home', homeSide)
      greet('away', awaySide)
      placeUmpires(frame, local)
    },
    camera: (local) => look([mix(0, 8, Math.sin(local * 0.3)), 4.2, mix(14, 9, local / 8)], [0, 1.3, 5], 28),
    hud: () => hudOf({ lower: { kicker: '경기 전', title: '양 팀 인사', detail: '라인을 맞춰 목례합니다' } }),
  }))

  push(4.4, () => ({
    label: inningLabel(state.inning, state.half),
    highlight: true,
    cut: true,
    sfx: [{ t: 3.3, id: 'call', text: '플레이볼' }],
    apply: (frame, local) => {
      frame.crowd = 0.5
      const u = smooth(clamp(local / 3.2, 0, 1))
      const defense = defenders(defenseSide(state), state)
      const onField = new Set(defense.map((item) => item.player.id))
      defense.forEach((item) => {
        const from = introSpot(defenseSide(state) === 'home' ? homeSide : awaySide, 0)
        put(frame, item.player.id, {
          x: mix(from.x, item.spot.x, u),
          y: 0,
          z: mix(from.z, item.spot.z, u),
          yaw: item.spot.yaw,
          clip: u < 0.98 ? 'jog' : item.pos === 'C' ? 'crouch' : 'ready',
          time: local,
          glove: true,
          hat: 'cap',
        })
      })
      placeBench(frame, 'home', defenseSide(state) === 'home' ? onField : new Set(), local)
      placeBench(frame, 'away', defenseSide(state) === 'away' ? onField : new Set(), local)
      placeUmpires(frame, local)
    },
    camera: () => look([0, 16, -18], [0, 1, 24], 36),
    hud: (local) =>
      hudOf({
        banner: local > 3.1 ? '플레이볼' : inningLabel(state.inning, state.half),
        lower: { kicker: '수비 위치', title: inningLabel(state.inning, state.half), detail: `${away.short} ${state.awayScore}  :  ${state.homeScore} ${home.short}` },
      }),
  }))

  const live = (frame: Frame, snapshot: GameState, time: number, batter?: string) => {
    placeDefense(frame, snapshot, time)
    placeUmpires(frame, time)
    const except = fieldExcept(snapshot)
    if (batter) except.add(batter)
    placeBench(frame, 'home', defenseSide(snapshot) === 'home' ? except : new Set([...except].filter((id) => byId.get(id)?.teamId === home.id)), time)
    placeBench(frame, 'away', defenseSide(snapshot) === 'away' ? except : new Set([...except].filter((id) => byId.get(id)?.teamId === away.id)), time)
    snapshot.bases.forEach((id, index) => {
      if (!id) return
      const spot = index === 0 ? BASES.first : index === 1 ? BASES.second : BASES.third
      put(frame, id, { x: spot.x, y: 0, z: spot.z, yaw: yawToward(spot.x, spot.z), clip: 'ready', time, hat: 'helmet', glove: false })
    })
  }

  for (const event of match.events) {
    if (state.gameOver) break
    if (event.kind === 'mound') {
      const before = cloneState(state)
      state = applyEvent(match, state, event, players)
      used[event.team].add(event.pitcherId)
      const name = byId.get(event.pitcherId)?.name ?? '투수'
      push(3.2, () => ({
        label: `투수 교체 ${name}`,
        highlight: false,
        cut: true,
        sfx: [],
        apply: (frame, local) => {
          live(frame, state, local)
          frame.crowd = 0.4
          const spot = DEFENSE.P
          const from = dugoutAnchor(event.team === 'home' ? homeSide : awaySide)
          const u = smooth(local / 2.6)
          put(frame, event.pitcherId, {
            x: mix(from.x, spot.x, u),
            y: 0,
            z: mix(from.z, spot.z, u),
            yaw: spot.yaw,
            clip: 'jog',
            time: local,
            hat: 'cap',
            glove: true,
          })
        },
        camera: () => look([8, 5, 16], [0, 1.6, 18], 28),
        hud: () => hudOf({ lower: { kicker: '마운드', title: name, detail: '투수 교체' }, awayScore: before.awayScore, homeScore: before.homeScore }),
      }))
      continue
    }
    if (event.kind === 'steal') {
      const before = cloneState(state)
      const runner = before.bases[event.from - 1]
      state = applyEvent(match, state, event, players)
      if (state.walkoff) hero = runner ?? hero
      const success = event.review?.overturn ? !event.success : event.success
      push(4.2, () => ({
        label: success ? '도루' : '도루 실패',
        highlight: true,
        cut: true,
        sfx: [
          { t: 0.3, id: 'cheer' },
          { t: 3.3, id: 'call', text: success ? '세이프' : '아웃' },
        ],
        apply: (frame, local) => {
          live(frame, before, local, undefined)
          frame.crowd = 0.8
          if (runner) {
            const u = smooth(clamp(local / 3.1, 0, 1))
            const pos = alongBases(event.from, event.from + (success ? 1 : 0.85), u)
            put(frame, runner, {
              x: pos.x,
              y: 0,
              z: pos.z,
              yaw: pos.yaw,
              clip: local > 2.5 ? 'slide' : 'run',
              time: local,
              hat: 'helmet',
              glove: false,
            })
          }
          const ump = event.from === 1 ? 'ump-2b' : event.from === 2 ? 'ump-3b' : 'ump-hp'
          put(frame, ump, {
            x: frame.places.get(ump)?.x ?? 0,
            y: 0,
            z: frame.places.get(ump)?.z ?? 0,
            yaw: frame.places.get(ump)?.yaw ?? 0,
            clip: local > 2.7 ? (success ? 'umpSafe' : 'umpOut') : 'umpIdle',
            time: Math.max(0, local - 2.7),
            hat: 'cap',
          })
        },
        camera: () => look([event.from === 1 ? 16 : -16, 4, event.from === 1 ? 28 : 22], [0, 1, 30], 26),
        hud: (local) => hudOf({ banner: local > 2.8 ? (success ? '도루' : '아웃') : undefined, replay: false }),
      }))
      if (event.review) {
        const overturn = event.review.overturn
        push(7.5, () => ({
          label: '비디오 판독',
          highlight: true,
          cut: true,
          sfx: [
            { t: 0.4, id: 'call', text: '비디오 판독' },
            { t: 6.2, id: 'call', text: overturn ? '판정 번복' : '콜 온 더 필드' },
          ],
          apply: (frame, local) => {
            live(frame, state, local)
            frame.crowd = 0.7
            put(frame, 'ump-hp', { x: 0, y: 0, z: -3.35, yaw: 0, clip: local < 5.4 ? 'umpReview' : overturn ? 'umpOverturn' : 'umpSafe', time: local, hat: 'cap' })
          },
          camera: (local) => (local < 5.2 ? look([12, 3.2, 24], [0, 1, 30], 22) : look([2.2, 1.7, -5], [0, 1.5, -3], 24)),
          hud: () => hudOf({ reviewTitle: overturn ? '판정 번복' : '콜 온 더 필드', replay: true }),
        }))
      }
      continue
    }

    const before = cloneState(state)
    const batter = byId.get(event.batterId)
    const height = batter?.body.heightCm ?? 180
    const throws = byId.get(pitcherId(before))?.throws ?? 'R'
    const pitcher = byId.get(pitcherId(before))
    let cursor = before
    for (const pitch of event.pitches) {
      if (cursor.gameOver) break
      const view = cursor
      const step = stepPitch(view, pitch, height)
      const flight = simulatePitch({
        type: pitch.type,
        velocityKmh: pitch.velocityKmh,
        rpm: pitch.rpm,
        plateX: pitch.plateX,
        plateY: pitch.plateY,
        throws,
        heightCm: pitcher?.body.heightCm ?? 186,
      })
      const origin = { x: flight.plate.x, y: Math.max(0.7, flight.plate.y), z: 0.25 }
      let contact: ContactFlight | null = null
      if (pitch.action === 'contact' && pitch.contact) {
        contact = presentContact({ ...pitch.contact, origin }, stadium, event.result)
      } else if (pitch.action === 'foul') {
        contact = presentContact(
          {
            exitVelocityKmh: 98,
            launchAngle: 38,
            sprayAngle: pitch.plateX >= 0 ? 56 : -56,
            hitRpm: 1400,
            distanceM: 42,
            origin,
          },
          stadium,
          null,
        )
      }
      const ended = step.ended
      addPitchCue({
        push,
        pitch,
        flight,
        contact,
        before: view,
        batter,
        pitcher,
        height,
      ended,
      result: !step.ended
        ? null
        : step.call === 'inplay'
          ? event.result
          : step.call === 'hbp'
            ? 'hbp'
            : step.state.strikes >= 3
              ? 'strikeout'
              : step.state.balls >= 4
                ? 'walk'
                : null,
        hudOf: (extra) => ({
          ...hudOf(extra),
          balls: view.balls,
          strikes: view.strikes,
          outs: view.outs,
          bases: [Boolean(view.bases[0]), Boolean(view.bases[1]), Boolean(view.bases[2])],
          awayScore: view.awayScore,
          homeScore: view.homeScore,
        }),
        live,
        defenders: defenders(defenseSide(view), view),
        homeId: home.id,
        awayId: away.id,
        stadiumWall: (angle: number) => fenceHeight(angle, stadium),
      })
      if (pitch.review) {
        const truth = pitch.action === 'take' ? (pitchInZone(pitch.plateX, pitch.plateY, height) ? '스트라이크' : '볼') : (event.result ? RESULT_LABEL[event.result] : '아웃')
        const onField = pitch.review.overturn ? (truth === '스트라이크' ? '볼' : truth === '볼' ? '스트라이크' : '반대 판정') : truth
        const finalText = pitch.review.overturn ? truth : onField
        push(8.2, () => ({
          label: '비디오 판독',
          highlight: true,
          cut: true,
          sfx: [
            { t: 0.3, id: 'call', text: '비디오 판독' },
            { t: 6.8, id: 'call', text: pitch.review?.overturn ? '판정 번복' : '콜 온 더 필드' },
          ],
          apply: (frame, local) => {
            live(frame, step.state, local, batter?.id)
            if (batter) {
              const spot = batterSpot(batter.bats, throws)
              put(frame, batter.id, { ...spot, y: 0, clip: 'routine', time: local, bat: true, hat: 'helmet', glove: false })
            }
            put(frame, 'ump-hp', {
              x: 0,
              y: 0,
              z: -3.35,
              yaw: 0,
              clip: local < 6 ? 'umpReview' : pitch.review?.overturn ? 'umpOverturn' : 'umpStrike',
              time: local,
              hat: 'cap',
            })
            frame.crowd = 0.75
          },
          camera: (local) => {
            if (local < 2.4) return look([0, 1.7, -2.2], [0, 1.2, 16], 12)
            if (local < 4.6) return look([26, 6, 12], [0, 1.2, 8], 26)
            if (local < 6.2) return look([-26, 6, 12], [0, 1.2, 8], 26)
            return look([1.6, 1.6, -4.6], [0, 1.5, -3.2], 22)
          },
          hud: () =>
            hudOf({
              reviewTitle: localReview(pitch.review?.overturn ? `판정 번복 · ${finalText}` : `콜 온 더 필드 · ${onField}`),
              replay: true,
              balls: step.state.balls,
              strikes: step.state.strikes,
              outs: step.state.outs,
              bases: [Boolean(step.state.bases[0]), Boolean(step.state.bases[1]), Boolean(step.state.bases[2])],
              awayScore: step.state.awayScore,
              homeScore: step.state.homeScore,
              zone: {
                x: flight.plate.x,
                y: flight.plate.y,
                top: zoneFor(height).top,
                bot: zoneFor(height).bot,
                half: zoneFor(height).halfW,
                call: finalText,
              },
            }),
        }))
      }
      if (ended && step.call === 'inplay' && event.result && ['single', 'double', 'triple', 'homer', 'error', 'infield_hit'].includes(event.result)) {
        push(5.6, () => ({
          label: '리플레이',
          highlight: true,
          cut: true,
          sfx: [],
          apply: (frame, local) => {
            live(frame, step.state, local, batter?.id)
            frame.crowd = event.result === 'homer' ? 1 : 0.8
            if (batter) {
              const spot = batterSpot(batter.bats, throws)
              const swingT = (SWING_CONTACT * (batter.anims.swing.duration)) 
              put(frame, batter.id, { ...spot, y: 0, clip: 'swing', time: swingT, bat: true, hat: 'helmet', glove: false })
            }
          },
          camera: (local) => {
            const cams = [
              look([0, 13, 68], [0, 1.2, 8], 18),
              look([30, 6, 14], [0, 1.3, 6], 24),
              look([-30, 5, 16], [0, 1.3, 6], 24),
            ]
            return cams[Math.min(2, Math.floor(local / 1.8))] ?? cams[0]!
          },
          hud: () => hudOf({ replay: true, banner: event.result ? RESULT_LABEL[event.result] : '리플레이' }),
        }))
      }
      cursor = step.state
      if (ended) break
    }
    const after = applyEvent(match, before, event, players)
    if (after.walkoff && !before.walkoff) hero = event.batterId
    state = after
  }

  if (state.gameOver) {
    const margin = Math.abs(state.homeScore - state.awayScore)
    const winner = state.homeScore >= state.awayScore ? 'home' : 'away'
    const shutout =
      used[winner].size === 1 && (winner === 'home' ? state.awayScore === 0 : state.homeScore === 0)
    const mode = state.walkoff ? 'walkoff' : shutout ? 'shutout' : margin <= 3 ? 'save' : 'win'
    const loserPitcher = winner === 'home' ? state.awayPitcherId : state.homePitcherId
    const winnerPitcher = winner === 'home' ? state.homePitcherId : state.awayPitcherId
    push(mode === 'walkoff' ? 12 : 8, () => ({
      label: mode === 'walkoff' ? '끝내기' : mode === 'save' ? '세이브' : mode === 'shutout' ? '완봉' : '경기 종료',
      highlight: true,
      cut: true,
      sfx: [
        { t: 0.4, id: mode === 'walkoff' ? 'organ' : 'cheer' },
        { t: 1.2, id: 'cheer' },
      ],
      apply: (frame, local) => {
        frame.crowd = 1
        const offense = state.walkoff ? battingSide(state) : winner
        const defense = offense === 'home' ? 'away' : 'home'
        const heroPlayer = byId.get(hero)
        if (mode === 'walkoff') {
          frame.water = { x: 0.4, z: 1.2 }
          roster(offense).forEach((player, index) => {
            const from = dugoutAnchor(offense === 'home' ? homeSide : awaySide)
            const u = smooth(clamp((local - index * 0.08) / 3.4, 0, 1))
            const isHero = player.id === hero
            put(frame, player.id, {
              x: mix(from.x, isHero ? 0.2 : Math.cos(index) * 1.6, u),
              y: 0,
              z: mix(from.z, isHero ? 0.8 : 1.4 + (index % 4) * 0.45, u),
              yaw: 0,
              clip: isHero ? 'ceremony' : 'celebrate',
              time: Math.max(0, local - 2.2),
              hat: isHero ? 'helmet' : 'cap',
              glove: false,
            })
          })
          put(frame, loserPitcher, {
            x: DEFENSE.P.x,
            y: 0,
            z: DEFENSE.P.z,
            yaw: DEFENSE.P.yaw,
            clip: 'dejected',
            time: local,
            hat: 'none',
            glove: true,
          })
          defenders(defense, state)
            .filter((item) => item.player.id !== loserPitcher)
            .forEach((item) => {
              put(frame, item.player.id, {
                x: item.spot.x,
                y: 0,
                z: item.spot.z + 1,
                yaw: item.spot.yaw,
                clip: 'dejected',
                time: local,
                hat: 'cap',
                glove: true,
              })
            })
        } else {
          const mound = defenders(winner, state)
          mound.forEach((item, index) => {
            const u = smooth(clamp(local / 2.8, 0, 1))
            const toX = mix(item.spot.x, Math.cos(index) * 1.4, u)
            const toZ = mix(item.spot.z, MOUND_OR(item.pos, u), u)
            put(frame, item.player.id, {
              x: toX,
              y: 0,
              z: toZ,
              yaw: yawToward(toX, toZ, 0, 18),
              clip: item.player.id === winnerPitcher ? (mode === 'shutout' ? 'bow' : 'pump') : 'celebrate',
              time: local,
              hat: mode === 'shutout' && item.player.id === winnerPitcher ? 'none' : 'cap',
              glove: true,
            })
          })
          placeBench(frame, defense, new Set(), local)
        }
        placeUmpires(frame, local)
        void heroPlayer
      },
      camera: (local) => {
        if (mode === 'walkoff' && local > 7) return look([9, 3.4, 9], [0.4, 1.3, 18.2], 34)
        if (mode === 'walkoff') return look([6, 3.2, 8], [0, 1.4, 1], 28)
        return look([7, 3.4, 14], [0, 1.6, 18.4], 24)
      },
      hud: () =>
        hudOf({
          banner: mode === 'walkoff' ? '끝내기' : mode === 'shutout' ? '완봉' : mode === 'save' ? '세이브' : '경기 종료',
          sub:
            mode === 'walkoff'
              ? '더그아웃이 비워지고, 패한 투수는 마운드에 남습니다'
              : mode === 'save'
                ? '마지막 이닝을 막은 투수의 세리머니'
                : mode === 'shutout'
                  ? '모자를 벗어 인사합니다'
                  : '큰 점수 차의 마무리',
        }),
    }))
  }

  return cues

  function localBanner() {
    return `${away?.short ?? ''}  vs  ${home?.short ?? ''}`
  }
  function localReview(text: string) {
    return text
  }
}

function MOUND_OR(pos: string, u: number) {
  if (pos === 'P') return 18.44
  return mix(pos === 'C' ? -2 : 24, 18.2, u)
}

function addPitchCue(opts: {
  push: (dur: number, make: (t0: number) => Omit<Cue, 't0' | 't1'>) => void
  pitch: Pitch
  flight: PitchFlight
  contact: ContactFlight | null
  before: GameState
  batter?: Player
  pitcher?: Player
  height: number
  ended: boolean
  result: string | null
  hudOf: (extra?: Partial<Hud>) => Hud
  live: (frame: Frame, snapshot: GameState, time: number, batter?: string) => void
  defenders: Defender[]
  homeId: string
  awayId: string
  stadiumWall: (angle: number) => number
}) {
  const { pitch, flight, contact, batter, pitcher } = opts
  const tRelease = SET + WIND * PITCH_RELEASE
  const tPlate = tRelease + flight.timeToPlate
  const after = contact ? Math.min(6.2, Math.max(2.2, contact.duration + 1.1)) : 1.45
  const dur = tPlate + after
  const call =
    pitch.action === 'foul'
      ? '파울'
      : pitch.action === 'hbp'
        ? '몸에 맞는 공'
        : pitch.action === 'contact'
          ? opts.result
            ? RESULT_LABEL[opts.result as keyof typeof RESULT_LABEL] ?? '인플레이'
            : '인플레이'
          : opts.result === 'strikeout'
            ? '스트라이크 아웃'
            : opts.result === 'walk'
              ? '볼넷'
              : flight.inZone || pitch.action === 'swing_miss'
                ? '스트라이크'
                : '볼'
  const zone = zoneFor(opts.height)
  const notable = Boolean(contact && pitch.action === 'contact')
  opts.push(dur, () => ({
    label: `${pitch.velocityKmh}km/h ${PITCH_LABEL[pitch.type]}`,
    highlight: Boolean(opts.ended && (opts.result === 'strikeout' || opts.result === 'homer' || notable)),
    cut: false,
    absWindow: [tPlate - 0.18, tPlate + 0.28],
    sfx: [
      { t: tRelease, id: 'pop' },
      ...(contact && pitch.action !== 'foul' ? [{ t: tPlate, id: 'crack' as const }] : []),
      ...(opts.result === 'homer' ? [{ t: tPlate + 0.4, id: 'organ' as const }, { t: tPlate + 0.5, id: 'cheer' as const }] : []),
      ...(notable && opts.result !== 'homer' ? [{ t: tPlate + 0.3, id: 'cheer' as const }] : []),
      { t: tPlate + 0.35, id: 'call' as const, text: call },
    ],
    apply: (frame, local) => {
      opts.live(frame, opts.before, local, batter?.id)
      frame.crowd = opts.result === 'homer' ? 1 : contact ? 0.85 : 0.4
      frame.zoneH = opts.height
      const pitcherIdNow = pitcher?.id
      if (pitcherIdNow) {
        const spot = DEFENSE.P
        const clipTime =
          local < tRelease
            ? (local / tRelease) * PITCH_RELEASE * (pitcher?.anims.pitch.duration ?? 1.2)
            : PITCH_RELEASE * (pitcher?.anims.pitch.duration ?? 1.2) + (local - tRelease)
        put(frame, pitcherIdNow, {
          x: spot.x,
          y: 0,
          z: spot.z,
          yaw: spot.yaw,
          clip: 'pitch',
          time: clipTime,
          hat: 'cap',
          glove: true,
        })
        if (local < tRelease) frame.stickHand = { id: pitcherIdNow, side: pitcher?.throws === 'L' ? 'L' : 'R' }
      }
      if (batter) {
        const spot = batterSpot(batter.bats, pitcher?.throws ?? 'R')
        const swingDur = batter.anims.swing.duration
        const contactAt = SWING_CONTACT * swingDur
        const swingStart = tPlate - contactAt
        const swinging = pitch.action !== 'take' && pitch.action !== 'hbp' && local >= swingStart
        put(frame, batter.id, {
          ...spot,
          y: 0,
          clip: swinging ? 'swing' : 'routine',
          time: swinging ? local - swingStart : local,
          bat: true,
          hat: 'helmet',
          glove: false,
        })
      }
      if (local >= tRelease && !(contact && local > tPlate)) {
        const sample = sampleAt(flight.samples, local - tRelease)
        const spin = ((flight.rpm * Math.PI) / 30) * (local - tRelease)
        frame.ball = {
          x: sample.x,
          y: sample.y,
          z: sample.z,
          ax: flight.axis.x,
          ay: flight.axis.y,
          az: flight.axis.z,
          angle: spin,
          blur: Math.min(1.2, flight.rpm / 2100),
        }
      }
      if (contact && local >= tPlate) {
        let bt = local - tPlate
        if (contact.blockedAt != null && opts.result !== 'homer' && bt > contact.blockedAt) bt = contact.blockedAt
        const sample = sampleAt(contact.samples, bt)
        const y = contact.blockedAt != null && opts.result !== 'homer' && local - tPlate > contact.blockedAt
          ? Math.max(0.4, fenceDrop(sample.y, local - tPlate - contact.blockedAt))
          : sample.y
        frame.ball = {
          x: sample.x,
          y,
          z: sample.z,
          ax: contact.axis.x,
          ay: contact.axis.y,
          az: contact.axis.z,
          angle: ((contact.rpm * Math.PI) / 30) * bt,
          blur: Math.min(1.1, contact.rpm / 2400),
        }
        const fielder = nearest(opts.defenders, sample.x, sample.z)
        if (fielder && pitch.action === 'contact') {
          const u = smooth(clamp((local - tPlate) / Math.max(0.6, Math.min(contact.hang, 2.8)), 0, 1))
          put(frame, fielder.player.id, {
            x: mix(fielder.spot.x, sample.x, u),
            y: 0,
            z: mix(fielder.spot.z, sample.z, u),
            yaw: yawToward(sample.x, sample.z),
            clip: 'run',
            time: local,
            glove: true,
            hat: 'cap',
          })
        }
      }
      if (local > tPlate + 0.15) {
        const umpClip: BuiltInClip =
          call.includes('스트라이크') ? 'umpStrike' : call === '파울' || call === '볼' || call === '볼넷' ? 'umpBall' : call.includes('아웃') || call === '병살' ? 'umpOut' : 'umpSafe'
        put(frame, 'ump-hp', { x: 0, y: 0, z: -3.35, yaw: 0, clip: umpClip, time: local - tPlate, hat: 'cap', glove: false })
      }
    },
    camera: (local) => {
      if (local < SET * 0.7 && batter) {
        const spot = batterSpot(batter.bats, pitcher?.throws ?? 'R')
        const side = batter.bats === 'L' ? -1 : 1
        return look([spot.x + side * 3.2, 1.55, spot.z + 0.2], [spot.x, 1.45, spot.z], 24)
      }
      if (contact && local > tPlate + 0.15) {
        const sample = sampleAt(contact.samples, Math.max(0, local - tPlate))
        return look([sample.x + 14, sample.y + 7, sample.z - 12], [sample.x, Math.max(1, sample.y), sample.z], 28)
      }
      if (local > tPlate) return look([0, 2.0, -5.2], [0, 1.35, 5], 28)
      return look([0, 8.5, 52], [0, 1.35, 6], 18)
    },
    hud: (local) =>
      opts.hudOf({
        pitch: { name: PITCH_LABEL[pitch.type], velo: pitch.velocityKmh, rpm: pitch.rpm },
        zone:
          local > tPlate - 0.05
            ? { x: flight.plate.x, y: flight.plate.y, top: zone.top, bot: zone.bot, half: zone.halfW, call: flight.inZone ? '스트라이크' : '볼' }
            : null,
        banner: local > tPlate + 0.45 ? call : undefined,
        lower: batter
          ? { kicker: `${batter.number}`, title: batter.name, detail: `${pitch.velocityKmh}km/h · ${Math.round(pitch.rpm)}rpm` }
          : undefined,
      }),
  }))
  void opts.stadiumWall
  void opts.homeId
  void opts.awayId
}

function fenceDrop(y: number, since: number) {
  return Math.max(0.35, y - since * 3)
}

function nearest(list: Defender[], x: number, z: number): Defender | null {
  let best: Defender | null = null
  let dist = 1e9
  for (const item of list) {
    if (item.pos === 'P' || item.pos === 'C') continue
    const d = Math.hypot(item.spot.x - x, item.spot.z - z)
    if (d < dist) {
      dist = d
      best = item
    }
  }
  return best
}
