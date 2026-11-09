import { describe, expect, it } from 'vitest'
import {
  BEST_KEY, BOOST_TIME, HIT_COOLDOWN, LANES, MAX_LIVES, SCORE,
  difficulty, loadBest, makeEntity, moveLane, newGame, overlaps, saveBest, score, spawnRow, step, type Game, type KV,
} from '../src/logic'
import { createRng } from '../src/rng'

const memory = (init: Record<string, string> = {}): KV & { data: Record<string, string> } => ({
  data: init,
  getItem(k) {
    return this.data[k] ?? null
  },
  setItem(k, v) {
    this.data[k] = v
  },
})

/** A game with no random spawns in the way: park the spawner far ahead. */
const quiet = (): Game => {
  const g = newGame(createRng(7))
  g.nextSpawn = 1e9
  g.nextRain = 1e9
  return g
}

describe('collision', () => {
  it('overlaps when same lane and same position', () => {
    expect(overlaps(makeEntity('car', 10, 1), makeEntity('car', 11, 1))).toBe(true)
  })
  it('does not overlap in different lanes', () => {
    expect(overlaps(makeEntity('car', 10, 1), makeEntity('car', 10, 2))).toBe(false)
  })
  it('does not overlap when far apart along the road', () => {
    expect(overlaps(makeEntity('car', 10, 1), makeEntity('car', 30, 1))).toBe(false)
  })
  it('a hazard in the bike lane costs a life and starts the cooldown', () => {
    const g = quiet()
    g.entities.push(makeEntity('car', 1, 1))
    step(g, 0.016)
    expect(g.lives).toBe(MAX_LIVES - 1)
    expect(g.invulnerable).toBeGreaterThan(HIT_COOLDOWN - 0.1)
    expect(g.events).toContain('hit')
  })
  it('switching lanes avoids the hazard', () => {
    const g = quiet()
    moveLane(g, 1)
    g.x = 2
    g.entities.push(makeEntity('car', 1, 1))
    step(g, 0.016)
    expect(g.lives).toBe(MAX_LIVES)
  })
  it('cooldown prevents double hits, 3 hits end the game', () => {
    const g = quiet()
    g.entities.push(makeEntity('car', 1, 1), makeEntity('pothole', 1, 1))
    step(g, 0.016)
    expect(g.lives).toBe(MAX_LIVES - 1)
    for (let i = 0; i < 2; i++) {
      g.invulnerable = 0
      g.entities.push(makeEntity('bus', g.distance, g.x))
      step(g, 0.016)
    }
    expect(g.over).toBe(true)
    expect(g.events).toContain('over')
  })
  it('lane changes are clamped to the road', () => {
    const g = quiet()
    for (let i = 0; i < 10; i++) moveLane(g, -1)
    expect(g.laneTarget).toBe(0)
    for (let i = 0; i < 10; i++) moveLane(g, 1)
    expect(g.laneTarget).toBe(LANES - 1)
  })
})

describe('scoring', () => {
  it('distance adds to the score', () => {
    const g = quiet()
    for (let i = 0; i < 60; i++) step(g, 1 / 60)
    expect(score(g)).toBe(Math.floor(g.distance))
    expect(score(g)).toBeGreaterThan(10)
  })
  it('a parcel gives its bonus and disappears', () => {
    const g = quiet()
    g.entities.push(makeEntity('parcel', 1, 1))
    step(g, 0.016)
    expect(g.bonus).toBe(SCORE.parcel)
    expect(g.entities.some((e) => e.kind === 'parcel')).toBe(false)
  })
  it('fuel starts a boost that makes hazards harmless and scores extra', () => {
    const g = quiet()
    g.entities.push(makeEntity('fuel', 1, 1))
    step(g, 0.016)
    expect(g.boost).toBeGreaterThan(BOOST_TIME - 0.1)
    g.entities.push(makeEntity('car', g.distance, 1))
    step(g, 0.016)
    expect(g.lives).toBe(MAX_LIVES)
    expect(g.bonus).toBeGreaterThan(SCORE.fuel)
  })
  it('umbrella grants rain protection', () => {
    const g = quiet()
    g.rain = 10
    g.entities.push(makeEntity('umbrella', 1, 1))
    step(g, 0.016)
    expect(g.umbrella).toBeGreaterThan(0)
  })
})

describe('difficulty and spawning', () => {
  it('speed grows and the gap shrinks over time, then caps', () => {
    expect(difficulty(60).speed).toBeGreaterThan(difficulty(0).speed)
    expect(difficulty(60).gap).toBeLessThan(difficulty(0).gap)
    expect(difficulty(1000).speed).toBe(difficulty(120).speed)
  })
  it('allows more hazards per row later', () => {
    expect(difficulty(100).maxHazards).toBeGreaterThan(difficulty(0).maxHazards)
  })
  it('a row never blocks every lane', () => {
    const rng = createRng(42)
    for (let i = 0; i < 500; i++) {
      const row = spawnRow(rng, 100, difficulty(i % 150), i % 2 === 0)
      const blocked = new Set(row.filter((e) => e.kind !== 'parcel' && e.kind !== 'fuel' && e.kind !== 'umbrella').map((e) => Math.round(e.x)))
      expect(blocked.size).toBeLessThan(LANES)
    }
  })
  it('umbrellas only appear when it rains', () => {
    const rng = createRng(3)
    for (let i = 0; i < 400; i++) {
      expect(spawnRow(rng, 0, { ...difficulty(10), itemChance: 1 }, false).some((e) => e.kind === 'umbrella')).toBe(false)
    }
  })
  it('the same seed gives the same run', () => {
    const run = () => {
      const g = newGame(createRng(5))
      for (let i = 0; i < 300; i++) step(g, 1 / 60)
      return g.entities.length + ':' + g.distance.toFixed(3)
    }
    expect(run()).toBe(run())
  })
})

describe('high score storage', () => {
  it('starts at 0 and ignores garbage', () => {
    expect(loadBest(memory())).toBe(0)
    expect(loadBest(memory({ [BEST_KEY]: 'abc' }))).toBe(0)
    expect(loadBest(null)).toBe(0)
  })
  it('saves only a higher score', () => {
    const s = memory()
    expect(saveBest(s, 120)).toBe(120)
    expect(saveBest(s, 80)).toBe(120)
    expect(loadBest(s)).toBe(120)
    expect(saveBest(s, 300)).toBe(300)
  })
  it('survives a storage that throws', () => {
    const bad: KV = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    }
    expect(loadBest(bad)).toBe(0)
    expect(saveBest(bad, 50)).toBe(50)
  })
})
