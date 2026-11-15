import { stadiumById } from '../src/data/stadiums.ts'
import { presentContact, simulatePitch } from '../src/lib/physics.ts'

const ff = simulatePitch({
  type: 'FF',
  velocityKmh: 149,
  rpm: 2400,
  plateX: 0,
  plateY: 0.85,
  throws: 'R',
  heightCm: 188,
})
const sl = simulatePitch({
  type: 'SL',
  velocityKmh: 132,
  rpm: 2700,
  plateX: -0.15,
  plateY: 0.55,
  throws: 'R',
  heightCm: 188,
})
const kn = simulatePitch({
  type: 'KN',
  velocityKmh: 118,
  rpm: 180,
  plateX: 0.05,
  plateY: 0.7,
  throws: 'R',
  heightCm: 188,
})
const jamsil = stadiumById('jamsil')
const fly = presentContact(
  { exitVelocityKmh: 165, launchAngle: 28, sprayAngle: -6, hitRpm: 2100, distanceM: null },
  jamsil,
  null,
)
const homer = presentContact(
  { exitVelocityKmh: 168, launchAngle: 28, sprayAngle: -8, hitRpm: 2200, distanceM: 128 },
  jamsil,
  'homer',
)
const ground = presentContact(
  { exitVelocityKmh: 142, launchAngle: 4, sprayAngle: 12, hitRpm: 800, distanceM: 36 },
  jamsil,
  'groundout',
)

function line(label: string, text: string) {
  console.log(`${label.padEnd(18)} ${text}`)
}

line('FF plate', `${ff.plate.x.toFixed(3)}, ${ff.plate.y.toFixed(3)} zone ${ff.inZone} t ${ff.timeToPlate.toFixed(3)}`)
line('FF break cm', `x ${(ff.breakX * 100).toFixed(1)}  y ${(ff.breakY * 100).toFixed(1)}`)
line('SL break cm', `x ${(sl.breakX * 100).toFixed(1)}  y ${(sl.breakY * 100).toFixed(1)}`)
line('KN break cm', `x ${(kn.breakX * 100).toFixed(1)}  y ${(kn.breakY * 100).toFixed(1)}`)
line('fly', `${fly.distance.toFixed(1)}m hang ${fly.hang.toFixed(2)} apex ${fly.apex.toFixed(1)} HR ${fly.cleared}`)
line('homer', `${homer.distance.toFixed(1)}m HR ${homer.cleared} foul ${homer.foul}`)
line('ground', `${ground.distance.toFixed(1)}m HR ${ground.cleared}`)

if (Math.abs(ff.plate.x) > 0.03 || Math.abs(ff.plate.y - 0.85) > 0.04) {
  throw new Error('포심이 조준점을 통과하지 않습니다')
}
if (ff.breakY < 0.08) throw new Error('포심 라이즈가 너무 작습니다')
if (sl.breakX > -0.08) throw new Error('우완 슬라이더가 글러브 쪽으로 충분히 휘지 않습니다')
if (Math.abs(kn.breakX) > Math.abs(sl.breakX)) throw new Error('너클이 슬라이더보다 많이 휨')
if (fly.distance < 95 || fly.distance > 145) throw new Error(`플라이 비거리 ${fly.distance}`)
if (!homer.cleared || homer.distance < 115) throw new Error('홈런이 담장을 넘지 않습니다')
if (ground.cleared || ground.distance > 55) throw new Error('땅볼이 너무 깊게 나갑니다')
console.log('physics ok')
