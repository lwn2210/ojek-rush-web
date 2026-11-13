import { describe, expect, it } from 'vitest'
import { newGame, score, saveBest, step } from '../src/logic'
import { createRng } from '../src/rng'

describe('boost score consistency', () => {
  it('returns whole points matching the canvas HUD after a real boost step', () => {
    const g = newGame(createRng(7))
    g.nextSpawn = 1e9
    g.boost = 4
    step(g, 1 / 60)
    expect(g.bonus).toBeGreaterThan(0)
    expect(g.bonus % 1).not.toBe(0)
    const hudScore = Math.floor(g.distance) + Math.floor(g.bonus)
    expect(score(g)).toBe(hudScore)
    expect(saveBest(null, score(g))).toBe(score(g))
  })
})
