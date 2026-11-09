import './style.css'
import { Sfx } from './audio'
import { loadBest, moveLane, newGame, saveBest, score, step, type Game } from './logic'
import { draw, layoutFor, addFloatingText } from './render'
import { createRng } from './rng'

const canvas = document.getElementById('scene') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const $ = (id: string) => document.getElementById(id)!
const sfx = new Sfx()
const store = (() => {
  try {
    return window.localStorage
  } catch {
    return null
  }
})()

let game: Game = newGame(createRng(1))
let running = false
let best = loadBest(store)
let layout = layoutFor(innerWidth, innerHeight)

function resize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(innerWidth * dpr)
  canvas.height = Math.round(innerHeight * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  layout = layoutFor(innerWidth, innerHeight)
}
addEventListener('resize', resize)
resize()

function showBest(): void {
  $('best').textContent = best > 0 ? `Rekor: ${best}` : ''
}
showBest()

function start(): void {
  game = newGame(createRng((Date.now() ^ 0x5bd1e995) >>> 0))
  running = true
  $('menu').hidden = true
  $('over').hidden = true
}

function finish(): void {
  running = false
  const s = score(game)
  best = saveBest(store, s)
  $('over-score').textContent = String(s)
  $('over-km').textContent = `${Math.floor(game.distance)} m`
  $('over-best').textContent = String(best)
  $('over').hidden = false
}

$('start').addEventListener('click', start)
$('restart').addEventListener('click', start)
$('mute').addEventListener('click', () => {
  $('mute').textContent = sfx.toggleMute() ? '🔇' : '🔊'
})
$('mute').textContent = sfx.muted ? '🔇' : '🔊'

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (k === 'm') $('mute').click()
  if (!running) {
    if (k === 'enter' || k === ' ') start()
    return
  }
  if (k === 'arrowleft' || k === 'a') moveLane(game, -1)
  else if (k === 'arrowright' || k === 'd') moveLane(game, 1)
})

// Touch: swipe sideways, or tap the left/right half.
let touch: { x: number; y: number } | null = null
canvas.addEventListener('pointerdown', (e) => {
  touch = { x: e.clientX, y: e.clientY }
})
canvas.addEventListener('pointerup', (e) => {
  if (!touch || !running) return
  const dx = e.clientX - touch.x
  if (Math.abs(dx) > 24) moveLane(game, dx > 0 ? 1 : -1)
  else if (Math.abs(e.clientY - touch.y) < 10) moveLane(game, e.clientX > innerWidth / 2 ? 1 : -1)
  touch = null
})

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (running) {
    step(game, dt)
    for (const ev of game.events) {
      if (ev === 'hit') {
        sfx.crash()
        sfx.honk()
        addFloatingText(layout.w / 2, layout.h * 0.7, '💥 TABRAKAN! -1❤️', '#ff1744')
      } else if (ev === 'fuel') {
        sfx.plus()
        sfx.boost()
        addFloatingText(layout.w / 2, layout.h * 0.7, '⚡ TURBO BOOST! +20', '#ffd600')
      } else if (ev === 'parcel') {
        sfx.plus()
        addFloatingText(layout.w / 2, layout.h * 0.7, '📦 PAKET TERKIRIM! +50', '#00e676')
      } else if (ev === 'umbrella') {
        sfx.plus()
        addFloatingText(layout.w / 2, layout.h * 0.7, '☂ PAYUNG ANTI-HUJAN! +30', '#ce93d8')
      } else if (ev === 'over') sfx.gameOver()
    }
    if (game.over) finish()
  }
  draw(ctx, game, layout, best)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
