// Pure game logic (no DOM, no canvas) so it can be unit-tested.
// World units: meters. `pos` is the absolute distance along the road; the bike
// sits at `distance`. Lanes are numbered 0..LANES-1, x is a float lane position.
import { pickWeighted, range, type Rng } from './rng'

export const LANES = 4
export const MAX_LIVES = 3
export const BIKE_LEN = 2
export const BIKE_HALF_WIDTH = 0.32
export const HIT_COOLDOWN = 1.5
export const BOOST_TIME = 4
export const UMBRELLA_TIME = 8
export const SPAWN_AHEAD = 60
export const SCORE = { parcel: 50, fuel: 20, umbrella: 30 } as const

export type HazardKind = 'car' | 'bus' | 'pothole' | 'pedestrian'
export type ItemKind = 'parcel' | 'fuel' | 'umbrella'
export type Kind = HazardKind | ItemKind

export interface Entity {
  kind: Kind
  pos: number
  x: number
  len: number
  halfWidth: number
  /** Lanes per second sideways (pedestrians crossing). */
  vx: number
  dead: boolean
}

export interface Difficulty {
  speed: number
  /** Meters between spawn rows. */
  gap: number
  /** Max hazards in one row (always < LANES, so a free lane exists). */
  maxHazards: number
  itemChance: number
}

export function difficulty(t: number): Difficulty {
  const k = Math.min(1, t / 120)
  return {
    speed: 14 + 20 * k,
    gap: 16 - 9 * k,
    maxHazards: t < 15 ? 1 : t < 45 ? 2 : LANES - 1,
    itemChance: 0.45 - 0.15 * k,
  }
}

const SIZE: Record<Kind, { len: number; halfWidth: number }> = {
  car: { len: 4, halfWidth: 0.38 },
  bus: { len: 7, halfWidth: 0.42 },
  pothole: { len: 1.6, halfWidth: 0.4 },
  pedestrian: { len: 1, halfWidth: 0.25 },
  parcel: { len: 1.4, halfWidth: 0.35 },
  fuel: { len: 1.4, halfWidth: 0.35 },
  umbrella: { len: 1.4, halfWidth: 0.35 },
}

export const isHazard = (k: Kind): k is HazardKind => k === 'car' || k === 'bus' || k === 'pothole' || k === 'pedestrian'

export function makeEntity(kind: Kind, pos: number, x: number, vx = 0): Entity {
  return { kind, pos, x, vx, ...SIZE[kind], dead: false }
}

/** Do two things overlap? Longitudinal by distance, sideways by lane x. */
export function overlaps(a: Entity, b: Entity): boolean {
  return Math.abs(a.pos - b.pos) < (a.len + b.len) / 2 && Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth
}

const HAZARD_WEIGHTS: { kind: HazardKind; weight: number }[] = [
  { kind: 'car', weight: 5 },
  { kind: 'bus', weight: 2 },
  { kind: 'pothole', weight: 3 },
  { kind: 'pedestrian', weight: 2 },
]
const ITEM_WEIGHTS: { kind: ItemKind; weight: number }[] = [
  { kind: 'parcel', weight: 6 },
  { kind: 'fuel', weight: 2 },
  { kind: 'umbrella', weight: 2 },
]

/** One row of traffic: hazards in at most `maxHazards` lanes (never all lanes) plus maybe an item. */
export function spawnRow(rng: Rng, pos: number, d: Difficulty, raining: boolean): Entity[] {
  const lanes = [0, 1, 2, 3].sort(() => rng() - 0.5)
  const count = Math.min(d.maxHazards, LANES - 1, 1 + Math.floor(rng() * d.maxHazards))
  const out: Entity[] = []
  for (let i = 0; i < count; i++) {
    const kind = pickWeighted(rng, HAZARD_WEIGHTS).kind
    const lane = lanes[i]!
    if (kind === 'pedestrian') {
      const dir = lane < LANES / 2 ? 1 : -1
      out.push(makeEntity(kind, pos, lane, dir * range(rng, 0.8, 1.4)))
    } else out.push(makeEntity(kind, pos, lane))
  }
  if (rng() < d.itemChance) {
    // Items go in a hazard-free lane, offset a bit so they sit between rows.
    const kind = pickWeighted(rng, ITEM_WEIGHTS.filter((w) => w.kind !== 'umbrella' || raining)).kind
    out.push(makeEntity(kind, pos + d.gap / 2, lanes[count]!))
  }
  return out
}

export interface Game {
  rng: Rng
  time: number
  distance: number
  bonus: number
  lives: number
  over: boolean
  laneTarget: number
  x: number
  invulnerable: number
  boost: number
  umbrella: number
  rain: number
  nextRain: number
  nextSpawn: number
  entities: Entity[]
  /** Events from the last step, for sound / effects. */
  events: GameEvent[]
}

export type GameEvent = 'hit' | 'parcel' | 'fuel' | 'umbrella' | 'over'

export function newGame(rng: Rng): Game {
  return {
    rng, time: 0, distance: 0, bonus: 0, lives: MAX_LIVES, over: false,
    laneTarget: 1, x: 1, invulnerable: 0, boost: 0, umbrella: 0,
    rain: 0, nextRain: 25, nextSpawn: 40, entities: [], events: [],
  }
}

export const score = (g: Game): number => Math.floor(g.distance) + g.bonus
export const isRaining = (g: Game): boolean => g.rain > 0 && g.umbrella <= 0

export function moveLane(g: Game, dir: -1 | 1): void {
  if (g.over) return
  g.laneTarget = Math.max(0, Math.min(LANES - 1, g.laneTarget + dir))
}

function bikeEntity(g: Game): Entity {
  return { kind: 'car', pos: g.distance, x: g.x, len: BIKE_LEN, halfWidth: BIKE_HALF_WIDTH, vx: 0, dead: false }
}

export function step(g: Game, dt: number): void {
  g.events = []
  if (g.over) return
  g.time += dt
  const d = difficulty(g.time)
  const speed = g.boost > 0 ? d.speed * 1.4 : d.speed
  g.distance += speed * dt
  // Boost doubles the distance score.
  if (g.boost > 0) g.bonus += speed * dt * 0.5

  // Sideways motion (slower on wet road).
  const rate = isRaining(g) ? 4.5 : 9
  const dx = g.laneTarget - g.x
  g.x += Math.sign(dx) * Math.min(Math.abs(dx), rate * dt)

  g.invulnerable = Math.max(0, g.invulnerable - dt)
  g.boost = Math.max(0, g.boost - dt)
  g.umbrella = Math.max(0, g.umbrella - dt)
  if (g.rain > 0) g.rain = Math.max(0, g.rain - dt)
  else if (g.time >= g.nextRain) {
    g.rain = range(g.rng, 10, 16)
    g.nextRain = g.time + g.rain + range(g.rng, 20, 35)
  }

  while (g.nextSpawn < g.distance + SPAWN_AHEAD) {
    g.entities.push(...spawnRow(g.rng, g.nextSpawn, d, g.rain > 0))
    g.nextSpawn += d.gap
  }

  const bike = bikeEntity(g)
  for (const e of g.entities) {
    if (e.dead) continue
    if (e.vx !== 0 && e.pos - g.distance < 35) e.x += e.vx * dt
    if (!overlaps(bike, e)) continue
    if (isHazard(e.kind)) {
      if (g.invulnerable > 0 || g.boost > 0) continue
      e.dead = true
      g.lives--
      g.invulnerable = HIT_COOLDOWN
      g.events.push('hit')
      if (g.lives <= 0) {
        g.over = true
        g.events.push('over')
      }
    } else {
      e.dead = true
      g.bonus += SCORE[e.kind]
      g.events.push(e.kind)
      if (e.kind === 'fuel') g.boost = BOOST_TIME
      if (e.kind === 'umbrella') g.umbrella = UMBRELLA_TIME
    }
  }
  g.entities = g.entities.filter((e) => !e.dead && e.pos > g.distance - 10)
}

// --- High score persistence ---
export const BEST_KEY = 'ojek-rush.best'
export interface KV {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

export function loadBest(store: KV | null): number {
  try {
    const n = Number(store?.getItem(BEST_KEY))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

/** Saves if `s` beats the stored best. Returns the best after the call. */
export function saveBest(store: KV | null, s: number): number {
  const best = loadBest(store)
  if (s <= best) return best
  try {
    store?.setItem(BEST_KEY, String(Math.floor(s)))
  } catch {
    /* storage full or blocked */
  }
  return Math.floor(s)
}
