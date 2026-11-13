// Same-seed generation must not depend on JIT warmup or module importer.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.OJEK_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.OJEK_TEST_PORT || 4198);
(async () => {
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  const report = { errors: [], comparisons: [] };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Vite readiness timeout')), 10000);
      server.stdout.on('data', data => { if (data.toString().includes('127.0.0.1')) { clearTimeout(timer); resolve(); } });
      server.once('exit', code => { clearTimeout(timer); reject(Error('Vite exited ' + code)); });
    });
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    for (let context = 0; context < 2; context++) {
      const page = await browser.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
      await page.route('**/src/main.ts', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + '\nwindow.ojekReplay={reset:(seed)=>{game=newGame(createRng(seed));running=true;return game},tick:(dt)=>{step(game,dt);return game}};' });
      });
      await page.goto(`http://127.0.0.1:${port}/`);
      const result = await page.evaluate(async () => {
        const logic = await import('/src/logic.ts');
        const { createRng } = await import('/src/rng.ts');
        function stream(seed) {
          let calls = 0;
          const raw = createRng(seed), rng = () => { calls++; return raw(); };
          const rows = [];
          for (let row = 0; row < 300; row++) rows.push(logic.spawnRow(rng, row * 7, logic.difficulty(120), true));
          return { rows, calls };
        }
        const cold = stream(61);
        let mismatch = null;
        for (let run = 0; run < 40; run++) {
          const warm = stream(61);
          if (JSON.stringify(cold) !== JSON.stringify(warm)) {
            const row = cold.rows.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(warm.rows[i]));
            mismatch = { run, row, coldCalls: cold.calls, warmCalls: warm.calls, cold: cold.rows[row], warm: warm.rows[row] };
            break;
          }
        }
        const replays = [];
        const route = [1, 2, 3, 2, 1, 0];
        for (const seed of [1, 61, 94]) for (const wet of [false, true]) for (const dt of [1 / 60, 0.05]) {
          const game = window.ojekReplay.reset(seed);
          const expected = logic.newGame(createRng(seed));
          if (wet) for (const g of [game, expected]) { g.time = 120; g.rain = 1000; g.nextRain = 1e9; }
          let inputs = 0, hits = 0, overlaps = 0;
          const frames = Math.round((wet ? 150 : 600) / dt);
          for (let frame = 0; frame < frames; frame++) {
            const target = route[Math.floor(game.distance / 60) % route.length];
            if (target !== game.laneTarget) {
              const dir = Math.sign(target - game.laneTarget);
              window.dispatchEvent(new KeyboardEvent('keydown', { key: dir > 0 ? 'ArrowRight' : 'ArrowLeft' }));
              logic.moveLane(expected, dir); inputs++;
            }
            window.ojekReplay.tick(dt); logic.step(expected, dt);
            hits += game.events.includes('hit') ? 1 : 0;
            overlaps += game.entities.some(e => logic.isHazard(e.kind) && Math.abs(e.pos - game.distance) < (e.len + 2) / 2 && Math.abs(e.x - game.x) < e.halfWidth + logic.BIKE_HALF_WIDTH) ? 1 : 0;
          }
          replays.push({ seed, wet, dt, frames, inputs, hits, overlaps, lives: game.lives, parity: JSON.stringify(game) === JSON.stringify(expected) });
        }
        return { mismatch, rows: 300, repeats: 40, coldCalls: cold.calls, replays };
      });
      report.comparisons.push(result);
      assert.equal(result.mismatch, null, 'same seeded rows differ after browser warmup: ' + JSON.stringify(result.mismatch));
      for (const replay of result.replays) {
        assert.equal(replay.hits, 0, JSON.stringify(replay));
        assert.equal(replay.overlaps, 0, JSON.stringify(replay));
        assert.equal(replay.lives, 3, JSON.stringify(replay));
        assert.equal(replay.parity, true, JSON.stringify(replay));
        assert.ok(replay.inputs > 5);
      }
      await page.close();
    }
    assert.deepEqual(report.errors, []);
    report.passed = true;
  } finally {
    if (browser) await browser.close();
    server.kill();
    if (process.env.OJEK_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.OJEK_EVIDENCE_DIR, 'determinism-' + (process.env.OJEK_PHASE || 'result') + '.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
