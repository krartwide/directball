import type { StadiumId } from '../types.ts'

export type Stadium = {
  id: StadiumId
  name: string
  city: string
  opened: string
  seats: number
  lf: number
  lcf: number
  cf: number
  rcf: number
  rf: number
  wall: number
  monster?: { side: 'rf' | 'lf'; from: number; height: number }
  dome: boolean
  turf: 'natural' | 'artificial'
  homeDugout: 'first' | 'third'
  seatA: string
  seatB: string
  accent: string
  skyTop: string
  skyHorizon: string
  haze: string
  blurb: string
}

export const STADIUMS: Stadium[] = [
  {
    id: 'jamsil',
    name: '잠실야구장',
    city: '서울 송파',
    opened: '1982',
    seats: 24411,
    lf: 100,
    lcf: 120,
    cf: 125,
    rcf: 120,
    rf: 100,
    wall: 2.6,
    dome: false,
    turf: 'natural',
    homeDugout: 'first',
    seatA: '#1d4e89',
    seatB: '#d8dde3',
    accent: '#f0b429',
    skyTop: '#16324d',
    skyHorizon: '#f2c9a0',
    haze: '#c9d5df',
    blurb: '좌우 100m, 가운데 125m. 담장은 낮고 가을 바람이 긴 타구를 붙잡습니다.',
  },
  {
    id: 'gocheok',
    name: '고척스카이돔',
    city: '서울 구로',
    opened: '2015',
    seats: 16783,
    lf: 99,
    lcf: 114,
    cf: 122,
    rcf: 114,
    rf: 99,
    wall: 4,
    dome: true,
    turf: 'artificial',
    homeDugout: 'first',
    seatA: '#243028',
    seatB: '#8ea58f',
    accent: '#d6ff4a',
    skyTop: '#121418',
    skyHorizon: '#2a3140',
    haze: '#1a1e24',
    blurb: '지붕이 닫힌 돔. 인조잔디 위로 조명이 고르게 떨어집니다.',
  },
  {
    id: 'incheon',
    name: '인천 SSG 랜더스필드',
    city: '인천 문학',
    opened: '2002',
    seats: 23000,
    lf: 95,
    lcf: 115,
    cf: 120,
    rcf: 115,
    rf: 95,
    wall: 2.8,
    dome: false,
    turf: 'natural',
    homeDugout: 'first',
    seatA: '#8d1d2c',
    seatB: '#1b1b1f',
    accent: '#ffb347',
    skyTop: '#1a3350',
    skyHorizon: '#f0d0b0',
    haze: '#d5e2ea',
    blurb: '폴대가 95m까지 들어온 타자 구장. 담장은 낮습니다.',
  },
  {
    id: 'suwon',
    name: '수원 KT 위즈파크',
    city: '수원',
    opened: '1989',
    seats: 22067,
    lf: 98,
    lcf: 115,
    cf: 120,
    rcf: 115,
    rf: 98,
    wall: 4,
    dome: false,
    turf: 'natural',
    homeDugout: 'first',
    seatA: '#1a1a1a',
    seatB: '#c81d25',
    accent: '#f2f2f2',
    skyTop: '#243044',
    skyHorizon: '#e7c7a4',
    haze: '#d7d3cc',
    blurb: '펜스 4m. 폴은 가깝고 담장은 쉽게 넘어가지 않습니다.',
  },
  {
    id: 'daejeon',
    name: '대전 한화생명 볼파크',
    city: '대전',
    opened: '2025',
    seats: 22000,
    lf: 99,
    lcf: 114,
    cf: 122,
    rcf: 104,
    rf: 95,
    wall: 2.8,
    monster: { side: 'rf', from: 18, height: 8 },
    dome: false,
    turf: 'natural',
    homeDugout: 'first',
    seatA: '#e87722',
    seatB: '#1c242b',
    accent: '#ffe08a',
    skyTop: '#1d3a52',
    skyHorizon: '#f3d2ae',
    haze: '#d5e0e6',
    blurb: '좌 99m, 우 95m. 우측에는 높이 8m 몬스터월이 있습니다.',
  },
  {
    id: 'daegu',
    name: '대구 삼성 라이온즈 파크',
    city: '대구',
    opened: '2016',
    seats: 24331,
    lf: 99.5,
    lcf: 107,
    cf: 122.5,
    rcf: 107,
    rf: 99.5,
    wall: 3.6,
    dome: false,
    turf: 'natural',
    homeDugout: 'third',
    seatA: '#1f4f86',
    seatB: '#d9e2ea',
    accent: '#7eb6ff',
    skyTop: '#20384e',
    skyHorizon: '#f0c9a4',
    haze: '#e4d5c4',
    blurb: '팔각에 가까운 담장. 좌우 중간이 깊게 파이지 않습니다.',
  },
  {
    id: 'sajik',
    name: '사직야구장',
    city: '부산',
    opened: '1985',
    seats: 24500,
    lf: 95.8,
    lcf: 113,
    cf: 121,
    rcf: 113,
    rf: 95.8,
    wall: 6,
    dome: false,
    turf: 'natural',
    homeDugout: 'first',
    seatA: '#0e3b2e',
    seatB: '#d5ddd4',
    accent: '#f2d24b',
    skyTop: '#1c4a62',
    skyHorizon: '#f6d7b8',
    haze: '#d5e4ea',
    blurb: '폴은 가깝지만 펜스가 6m. 높은 담장을 넘겨야 홈런입니다.',
  },
  {
    id: 'gwangju',
    name: '광주-기아 챔피언스 필드',
    city: '광주',
    opened: '2014',
    seats: 20500,
    lf: 99,
    lcf: 116,
    cf: 121,
    rcf: 116,
    rf: 99,
    wall: 2.6,
    dome: false,
    turf: 'natural',
    homeDugout: 'third',
    seatA: '#c4161c',
    seatB: '#1e1e1e',
    accent: '#ffd1d1',
    skyTop: '#243628',
    skyHorizon: '#f0d2b0',
    haze: '#d7e0d4',
    blurb: '열린 외야와 낮은 펜스. 바람이 타구를 데리고 나갑니다.',
  },
  {
    id: 'changwon',
    name: '창원 NC 파크',
    city: '창원',
    opened: '2019',
    seats: 22112,
    lf: 101,
    lcf: 107,
    cf: 122,
    rcf: 107,
    rf: 101,
    wall: 3.3,
    dome: false,
    turf: 'natural',
    homeDugout: 'first',
    seatA: '#14233b',
    seatB: '#c6a15a',
    accent: '#e7d7a8',
    skyTop: '#1e3d48',
    skyHorizon: '#f3d4b4',
    haze: '#d5e3df',
    blurb: '폴 101m, 가운데 122m. 좌우 중간 담장이 앞으로 나옵니다.',
  },
]

export function stadiumById(id: StadiumId): Stadium {
  return STADIUMS.find((stadium) => stadium.id === id) ?? STADIUMS[0]!
}

export function fenceDistance(angleDeg: number, stadium: Stadium): number {
  const angle = Math.max(-45, Math.min(45, angleDeg))
  const pts = [-45, -22.5, 0, 22.5, 45]
  const ds = [stadium.lf, stadium.lcf, stadium.cf, stadium.rcf, stadium.rf]
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i]!
    const b = pts[i + 1]!
    if (angle <= b) {
      const t = (angle - a) / (b - a || 1)
      return ds[i]! + (ds[i + 1]! - ds[i]!) * t
    }
  }
  return stadium.rf
}

export function fenceHeight(angleDeg: number, stadium: Stadium): number {
  const monster = stadium.monster
  if (!monster) return stadium.wall
  if (monster.side === 'rf' && angleDeg >= monster.from) return monster.height
  if (monster.side === 'lf' && angleDeg <= -monster.from) return monster.height
  return stadium.wall
}
