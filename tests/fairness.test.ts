import { describe, expect, it } from 'vitest'
import { BIKE_HALF_WIDTH, MAX_LIVES, difficulty, isHazard, moveLane, newGame, spawnRow, step } from '../src/logic'
import { createRng } from '../src/rng'

// A reference escape corridor changes by only one lane every 60 metres.
// Both lanes must be clear 20m either side of a switch; no gap widening.
const route = [1, 2, 3, 2, 1, 0]
const safeLane = (distance: number) => route[Math.floor(Math.max(0, distance) / 60) % route.length]!
function reserved(pos: number): number[] {
  const segment = Math.floor(pos / 60), offset = pos % 60
  return [safeLane(pos), ...(offset < 20 ? [safeLane(Math.max(0, (segment - 1) * 60))] : []), ...(offset > 40 ? [safeLane((segment + 1) * 60)] : [])]
}

describe('bounded escape-corridor policy (not human pacing proof)', () => {
  it('leaves the reference corridor clear when creating dense rows', () => {
    for (const seed of [1, 61, 94]) {
      const rng = createRng(seed)
      for (let pos = 40; pos < 4000; pos += 7) {
        const row = spawnRow(rng, pos, difficulty(120), true)
        for (const hazard of row.filter(e => isHazard(e.kind))) {
          for (const lane of reserved(pos)) expect(Math.abs(hazard.x - lane), `seed=${seed} pos=${pos}`).toBeGreaterThanOrEqual(hazard.halfWidth + BIKE_HALF_WIDTH)
        }
      }
    }
  })

  for (const seed of [1, 61, 94]) for (const mode of ['normal', 'wet', 'wet-boost'] as const) for (const dt of [1 / 60, 0.05]) for (const pickups of [true, false]) {
    it(`replays actual adjacent moveLane/step: ${seed}/${mode}/dt=${dt}/pickups=${pickups}`, () => {
      const game = newGame(createRng(seed))
      if (mode !== 'normal') { game.time = 120; game.rain = 1000; game.nextRain = 1e9 }
      if (mode === 'wet-boost') game.boost = 1000
      const seconds = mode === 'normal' ? 600 : 150
      let events = 0, lastEvent = -Infinity, minimumCadence = Infinity
      for (let frame = 0; frame < Math.round(seconds / dt); frame++) {
        if (!pickups) game.entities = game.entities.filter(e => isHazard(e.kind))
        const target = safeLane(game.distance)
        if (target !== game.laneTarget) {
          expect(Math.abs(target - game.laneTarget)).toBe(1)
          moveLane(game, target > game.laneTarget ? 1 : -1)
          minimumCadence = Math.min(minimumCadence, frame - lastEvent)
          lastEvent = frame; events++
        }
        step(game, dt)
        expect(game.lives, `seed=${seed} mode=${mode} frame=${frame}`).toBe(MAX_LIVES)
        expect(game.entities.some(e => isHazard(e.kind) && Math.abs(e.pos - game.distance) < (e.len + 2) / 2 && Math.abs(e.x - game.x) < e.halfWidth + BIKE_HALF_WIDTH)).toBe(false)
      }
      expect(events).toBeGreaterThan(5)
      expect(minimumCadence * dt).toBeGreaterThanOrEqual(1.2)
    })
  }
})
