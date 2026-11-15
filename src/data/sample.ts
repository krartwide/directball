import { defaultAnims } from '../lib/clips.ts'
import { buildHeadTexture, skinFromSeed } from '../lib/face.ts'
import type { BodySpec, Hand, Match, Pitch, Player, Position, Team } from '../types.ts'

const LINEUP: Position[] = ['CF', '2B', 'LF', '1B', 'DH', '3B', 'SS', 'RF', 'C', 'P', 'P']

type Club = {
  id: string
  name: string
  short: string
  city: string
  primary: string
  secondary: string
  mark: 'eagle' | 'wave' | 'apple' | 'pine'
  names: string[]
  bats: Hand[]
  throws: Array<'R' | 'L'>
  tall: number[]
}

const CLUBS: Club[] = [
  {
    id: 't-hangang',
    name: '서울 한강',
    short: '한강',
    city: '서울',
    primary: '#163a73',
    secondary: '#e8b15a',
    mark: 'eagle',
    names: ['하도람', '배지호', '심우진', '강이안', '문하준', '노태경', '표민재', '구자운', '남시현', '서도윤', '백시우'],
    bats: ['R', 'R', 'L', 'R', 'L', 'R', 'R', 'R', 'R', 'R', 'R'],
    throws: ['R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R'],
    tall: [178, 174, 181, 186, 188, 183, 176, 185, 180, 193, 186],
  },
  {
    id: 't-pado',
    name: '부산 파도',
    short: '파도',
    city: '부산',
    primary: '#0e6e6a',
    secondary: '#f4f7f2',
    mark: 'wave',
    names: ['진태양', '마준혁', '오세린', '범기탁', '라온유', '피재민', '독고은', '방시율', '호연우', '차민석', '설이준'],
    bats: ['R', 'R', 'L', 'R', 'R', 'R', 'L', 'R', 'R', 'R', 'L'],
    throws: ['R', 'R', 'R', 'R', 'R', 'R', 'L', 'R', 'R', 'R', 'L'],
    tall: [182, 175, 170, 184, 179, 187, 177, 173, 181, 189, 185],
  },
  {
    id: 't-neunggeum',
    name: '대구 능금',
    short: '능금',
    city: '대구',
    primary: '#9d2430',
    secondary: '#1b1b1b',
    mark: 'apple',
    names: ['한결우', '도윤재', '설하람', '기태양', '무진서', '나기준', '풍이안', '석민호', '단하늘', '위지한', '목시후'],
    bats: ['L', 'R', 'R', 'R', 'L', 'R', 'R', 'R', 'R', 'R', 'R'],
    throws: ['L', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'L'],
    tall: [176, 180, 183, 185, 190, 178, 174, 182, 177, 191, 184],
  },
  {
    id: 't-songnim',
    name: '광주 송림',
    short: '송림',
    city: '광주',
    primary: '#1e6b3a',
    secondary: '#f2d24b',
    mark: 'pine',
    names: ['소이든', '갈태오', '빈주안', '담시온', '려강민', '학도윤', '포하늘', '근시우', '엽민재', '산이준', '림하준'],
    bats: ['R', 'R', 'L', 'R', 'R', 'R', 'L', 'R', 'R', 'R', 'R'],
    throws: ['R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'L', 'R'],
    tall: [181, 173, 179, 186, 177, 184, 175, 180, 178, 188, 183],
  },
]

function hash(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return h >>> 0
}

function bodyFor(id: string, heightCm: number): BodySpec {
  const n = hash(id)
  return {
    heightCm,
    build: 0.28 + (n % 55) / 100,
    shoulder: 0.92 + (n % 24) / 100,
    armLength: 0.95 + (n % 14) / 100,
    legLength: 0.95 + ((n >>> 5) % 12) / 100,
    headScale: 0.94 + ((n >>> 9) % 12) / 80,
  }
}

function emblem(kind: Club['mark'], primary: string, secondary: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = primary
  ctx.beginPath()
  ctx.arc(128, 128, 120, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = secondary
  ctx.lineWidth = 10
  ctx.stroke()
  ctx.fillStyle = secondary
  ctx.strokeStyle = secondary
  if (kind === 'eagle') {
    ctx.beginPath()
    ctx.moveTo(128, 48)
    ctx.quadraticCurveTo(210, 110, 150, 196)
    ctx.quadraticCurveTo(128, 150, 106, 196)
    ctx.quadraticCurveTo(46, 110, 128, 48)
    ctx.fill()
  } else if (kind === 'wave') {
    ctx.lineWidth = 14
    ctx.beginPath()
    ctx.moveTo(48, 120)
    ctx.bezierCurveTo(80, 80, 100, 160, 128, 120)
    ctx.bezierCurveTo(156, 80, 176, 160, 208, 120)
    ctx.stroke()
  } else if (kind === 'apple') {
    ctx.beginPath()
    ctx.arc(128, 140, 58, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#d8f5c8'
    ctx.beginPath()
    ctx.moveTo(128, 86)
    ctx.quadraticCurveTo(150, 60, 168, 78)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(128, 46)
    ctx.lineTo(168, 190)
    ctx.lineTo(88, 190)
    ctx.closePath()
    ctx.fill()
  }
  return canvas.toDataURL('image/png')
}

export async function createSampleLibrary(): Promise<{ teams: Team[]; players: Player[]; matches: Match[] }> {
  const teams: Team[] = []
  const players: Player[] = []
  for (const club of CLUBS) {
    teams.push({
      id: club.id,
      name: club.name,
      short: club.short,
      city: club.city,
      primary: club.primary,
      secondary: club.secondary,
      emblem: emblem(club.mark, club.primary, club.secondary),
    })
    for (let i = 0; i < club.names.length; i += 1) {
      const id = `${club.id}-${i}`
      const name = club.names[i] ?? '선수'
      const colors = skinFromSeed(id + name)
      const bats = club.bats[i] ?? 'R'
      const throws = club.throws[i] ?? 'R'
      const faceTexture = await buildHeadTexture({ style: 'card', skin: colors.skin, hair: colors.hair, seed: id })
      const player: Player = {
        id,
        teamId: club.id,
        name,
        number: [51, 7, 24, 34, 10, 5, 6, 27, 44, 18, 11][i] ?? i + 1,
        position: LINEUP[i] ?? 'DH',
        bats,
        throws,
        body: bodyFor(id, club.tall[i] ?? 180),
        skin: colors.skin,
        hair: colors.hair,
        faceStyle: 'card',
        faceTexture,
        anims: defaultAnims(throws, bats),
      }
      if (name === '문하준') player.body = { ...player.body, build: 0.86, shoulder: 1.12 }
      if (name === '서도윤') player.body = { ...player.body, heightCm: 193, armLength: 1.08 }
      players.push(player)
    }
  }
  return { teams, players, matches: [walkoff(), save()] }
}

function pitch(partial: Omit<Pitch, 'id'> & { id: string }): Pitch {
  return partial
}

function walkoff(): Match {
  return {
    id: 'm-walkoff',
    title: '한강의 끝내기',
    homeTeamId: 't-hangang',
    awayTeamId: 't-pado',
    stadiumId: 'jamsil',
    night: true,
    dateLabel: '잠실 · 나이트',
    homeLineup: Array.from({ length: 9 }, (_, i) => `t-hangang-${i}`),
    awayLineup: Array.from({ length: 9 }, (_, i) => `t-pado-${i}`),
    homePitcherId: 't-hangang-9',
    awayPitcherId: 't-pado-9',
    opening: {
      inning: 9,
      half: 'bottom',
      outs: 0,
      awayScore: 3,
      homeScore: 2,
      bases: ['t-hangang-1', null, null],
      awayBatterIndex: 4,
      homeBatterIndex: 3,
    },
    createdAt: 1,
    events: [
      {
        id: 'pa-k',
        kind: 'pa',
        batterId: 't-hangang-3',
        result: 'strikeout',
        pitches: [
          pitch({ id: 'k1', type: 'FF', velocityKmh: 149, rpm: 2380, plateX: 0.12, plateY: 0.92, action: 'take' }),
          pitch({
            id: 'k2',
            type: 'SL',
            velocityKmh: 133,
            rpm: 2680,
            plateX: -0.28,
            plateY: 0.62,
            action: 'take',
            review: { kind: 'abs', overturn: false },
          }),
          pitch({ id: 'k3', type: 'FF', velocityKmh: 151, rpm: 2440, plateX: 0.02, plateY: 1.02, action: 'swing_miss' }),
        ],
      },
      { id: 'steal-2', kind: 'steal', from: 1, success: true },
      {
        id: 'pa-hr',
        kind: 'pa',
        batterId: 't-hangang-4',
        result: 'homer',
        pitches: [
          pitch({ id: 'h1', type: 'CB', velocityKmh: 119, rpm: 2740, plateX: 0.05, plateY: 0.42, action: 'take' }),
          pitch({
            id: 'h2',
            type: 'CT',
            velocityKmh: 142,
            rpm: 2280,
            plateX: -0.04,
            plateY: 0.84,
            action: 'contact',
            contact: { exitVelocityKmh: 168, launchAngle: 28, sprayAngle: -8, hitRpm: 2200, distanceM: 128 },
          }),
        ],
      },
    ],
  }
}

function save(): Match {
  return {
    id: 'm-save',
    title: '마운드의 세리머니',
    homeTeamId: 't-hangang',
    awayTeamId: 't-pado',
    stadiumId: 'sajik',
    night: true,
    dateLabel: '사직 · 9회초',
    homeLineup: Array.from({ length: 9 }, (_, i) => `t-hangang-${i}`),
    awayLineup: Array.from({ length: 9 }, (_, i) => `t-pado-${i}`),
    homePitcherId: 't-hangang-9',
    awayPitcherId: 't-pado-9',
    opening: {
      inning: 9,
      half: 'top',
      outs: 2,
      awayScore: 1,
      homeScore: 3,
      bases: [null, null, null],
      awayBatterIndex: 0,
      homeBatterIndex: 2,
    },
    createdAt: 2,
    events: [
      {
        id: 'pa-save',
        kind: 'pa',
        batterId: 't-pado-0',
        result: 'strikeout',
        pitches: [
          pitch({ id: 's1', type: 'FF', velocityKmh: 147, rpm: 2360, plateX: -0.16, plateY: 0.78, action: 'take' }),
          pitch({ id: 's2', type: 'SL', velocityKmh: 131, rpm: 2710, plateX: 0.22, plateY: 0.58, action: 'swing_miss' }),
          pitch({
            id: 's3',
            type: 'FF',
            velocityKmh: 150,
            rpm: 2410,
            plateX: 0.18,
            plateY: 0.7,
            action: 'take',
            review: { kind: 'abs', overturn: false },
          }),
        ],
      },
    ],
  }
}
