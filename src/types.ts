export type PitchType = 'FF' | 'SI' | 'CT' | 'SL' | 'CB' | 'CH' | 'FS' | 'KN'

export type Position = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH'

export type Hand = 'R' | 'L' | 'S'

export type FaceStyle = 'photo' | 'card' | 'night'

export type PlayResult =
  | 'strikeout'
  | 'walk'
  | 'hbp'
  | 'single'
  | 'double'
  | 'triple'
  | 'homer'
  | 'infield_hit'
  | 'flyout'
  | 'lineout'
  | 'popup'
  | 'groundout'
  | 'sac_fly'
  | 'sac_bunt'
  | 'gidp'
  | 'fielders_choice'
  | 'error'

export type PitchAction = 'take' | 'swing_miss' | 'foul' | 'contact' | 'hbp'

export type ReviewKind = 'abs' | 'safeout' | 'fairfoul' | 'homer' | 'catch'

export const BONE_NAMES = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'shoulderL',
  'elbowL',
  'wristL',
  'shoulderR',
  'elbowR',
  'wristR',
  'thighL',
  'shinL',
  'footL',
  'thighR',
  'shinR',
  'footR',
] as const

export type BoneName = (typeof BONE_NAMES)[number]

export type Euler3 = [number, number, number]

export type Pose = {
  bones: Record<BoneName, Euler3>
  offset: [number, number, number]
}

export type Clip = {
  duration: number
  loop: boolean
  keys: { t: number; pose: Pose }[]
}

export type PlayerAnims = {
  routine: Clip
  swing: Clip
  hrCeremony: Clip
  pitch: Clip
}

export type BodySpec = {
  heightCm: number
  build: number
  shoulder: number
  armLength: number
  legLength: number
  headScale: number
}

export type Player = {
  id: string
  teamId: string
  name: string
  number: number
  position: Position
  bats: Hand
  throws: 'R' | 'L'
  body: BodySpec
  skin: string
  hair: string
  faceStyle: FaceStyle
  /** 사용자가 올린 원본. */
  faceSource?: string
  /** 머리에 입힐 1024 텍스처. */
  faceTexture?: string
  anims: PlayerAnims
}

export type Team = {
  id: string
  name: string
  short: string
  city: string
  primary: string
  secondary: string
  emblem?: string
}

export type StadiumId =
  | 'jamsil'
  | 'gocheok'
  | 'incheon'
  | 'suwon'
  | 'daejeon'
  | 'daegu'
  | 'sajik'
  | 'gwangju'
  | 'changwon'

export type Pitch = {
  id: string
  type: PitchType
  velocityKmh: number
  rpm: number
  /** 포수 시점에서 1루 방향이 +. 미터. */
  plateX: number
  /** 홈 플레이트 통과 높이. 미터. */
  plateY: number
  action: PitchAction
  contact?: {
    exitVelocityKmh: number
    launchAngle: number
    /** 중견이 0, 1루(우익) 방향이 +. 도. */
    sprayAngle: number
    hitRpm: number
    /** 맞추고 싶은 비거리. 비우면 타구속도와 발사각만으로 계산. */
    distanceM: number | null
  }
  review?: {
    kind: ReviewKind
    overturn: boolean
  }
}

export type PaEvent = {
  id: string
  kind: 'pa'
  batterId: string
  pitches: Pitch[]
  /** 인플레이의 최종 기록. 삼진·볼넷은 공이 끝나면 자동. */
  result: PlayResult | null
}

export type StealEvent = {
  id: string
  kind: 'steal'
  from: 1 | 2 | 3
  success: boolean
  review?: { overturn: boolean }
}

export type MoundEvent = {
  id: string
  kind: 'mound'
  team: 'home' | 'away'
  pitcherId: string
}

export type MatchEvent = PaEvent | StealEvent | MoundEvent

export type Half = 'top' | 'bottom'

export type GameState = {
  inning: number
  half: Half
  outs: number
  balls: number
  strikes: number
  bases: [string | null, string | null, string | null]
  awayScore: number
  homeScore: number
  awayBatterIndex: number
  homeBatterIndex: number
  awayPitcherId: string
  homePitcherId: string
  gameOver: boolean
  walkoff: boolean
}

export type Opening = {
  inning: number
  half: Half
  outs: number
  awayScore: number
  homeScore: number
  bases: [string | null, string | null, string | null]
  awayBatterIndex: number
  homeBatterIndex: number
}

export type Match = {
  id: string
  title: string
  homeTeamId: string
  awayTeamId: string
  stadiumId: StadiumId
  night: boolean
  dateLabel: string
  homeLineup: string[]
  awayLineup: string[]
  homePitcherId: string
  awayPitcherId: string
  opening: Opening
  events: MatchEvent[]
  createdAt: number
}

export const PITCH_LABEL: Record<PitchType, string> = {
  FF: '포심',
  SI: '싱커',
  CT: '커터',
  SL: '슬라이더',
  CB: '커브',
  CH: '체인지업',
  FS: '스플리터',
  KN: '너클',
}

export const RESULT_LABEL: Record<PlayResult, string> = {
  strikeout: '삼진',
  walk: '볼넷',
  hbp: '몸에 맞는 공',
  single: '안타',
  double: '2루타',
  triple: '3루타',
  homer: '홈런',
  infield_hit: '내야 안타',
  flyout: '플라이 아웃',
  lineout: '라인드라이브 아웃',
  popup: '내야 뜬공',
  groundout: '땅볼 아웃',
  sac_fly: '희생플라이',
  sac_bunt: '희생번트',
  gidp: '병살',
  fielders_choice: '야수 선택',
  error: '실책',
}

export const POSITION_LABEL: Record<Position, string> = {
  P: '투수',
  C: '포수',
  '1B': '1루수',
  '2B': '2루수',
  '3B': '3루수',
  SS: '유격수',
  LF: '좌익수',
  CF: '중견수',
  RF: '우익수',
  DH: '지명타자',
}

export const ACTION_LABEL: Record<PitchAction, string> = {
  take: '루킹',
  swing_miss: '헛스윙',
  foul: '파울',
  contact: '인플레이',
  hbp: '사구',
}
