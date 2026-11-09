import { BIKE_LEN, isRaining, LANES, difficulty, type Entity, type Game } from './logic'

/** Visible road length in meters; the bike sits at BIKE_Y of the canvas height. */
const VIEW_M = 36
const BIKE_Y = 0.78

export interface Layout {
  w: number
  h: number
  roadX: number
  roadW: number
  laneW: number
  pxM: number
}

export function layoutFor(w: number, h: number): Layout {
  const roadW = Math.min(w * 0.94, h * 0.58, 540)
  return { w, h, roadX: (w - roadW) / 2, roadW, laneW: roadW / LANES, pxM: h / VIEW_M }
}

const laneCenter = (l: Layout, x: number): number => l.roadX + (x + 0.5) * l.laneW

// Floating texts for pick-ups and crashes
export interface FloatingText {
  x: number
  y: number
  text: string
  color: string
  alpha: number
  vy: number
  time: number
}
export const floatingTexts: FloatingText[] = []

export function addFloatingText(x: number, y: number, text: string, color = '#ffd23f'): void {
  floatingTexts.push({ x, y, text, color, alpha: 1, vy: -40, time: 0 })
}

interface Smoke {
  x: number
  y: number
  r: number
  alpha: number
}
const smokes: Smoke[] = []

/** Draw rounded rectangle helper */
function roundedRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath()
  c.roundRect(x - w / 2, y - h / 2, w, h, r)
}

/** Draw realistic top-down car */
function drawCar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  c.save()
  // Shadow
  c.fillStyle = 'rgba(0, 0, 0, 0.45)'
  roundedRect(c, x + 3, y + 4, w * 0.94, h * 0.96, 8)
  c.fill()

  // Palette based on seed
  const carColors = [
    { main: '#d32f2f', dark: '#9a0007', roof: '#b71c1c' }, // Red
    { main: '#1976d2', dark: '#004ba0', roof: '#0d47a1' }, // Blue
    { main: '#37474f', dark: '#102027', roof: '#263238' }, // Dark Grey
    { main: '#eeeeee', dark: '#bcbcbc', roof: '#e0e0e0' }, // Pearl White
    { main: '#ff8f00', dark: '#c56000', roof: '#e65100' }, // Amber Orange
  ]
  const color = carColors[Math.abs(Math.floor(seed)) % carColors.length]!

  // Tires
  c.fillStyle = '#1a1a1a'
  const tireW = w * 0.18
  const tireH = h * 0.22
  roundedRect(c, x - w * 0.46, y - h * 0.28, tireW, tireH, 3)
  c.fill()
  roundedRect(c, x + w * 0.46, y - h * 0.28, tireW, tireH, 3)
  c.fill()
  roundedRect(c, x - w * 0.46, y + h * 0.28, tireW, tireH, 3)
  c.fill()
  roundedRect(c, x + w * 0.46, y + h * 0.28, tireW, tireH, 3)
  c.fill()

  // Main Car Body
  const grad = c.createLinearGradient(x - w / 2, y, x + w / 2, y)
  grad.addColorStop(0, color.dark)
  grad.addColorStop(0.3, color.main)
  grad.addColorStop(0.7, color.main)
  grad.addColorStop(1, color.dark)
  c.fillStyle = grad
  roundedRect(c, x, y, w * 0.88, h, 10)
  c.fill()
  c.strokeStyle = 'rgba(0,0,0,0.3)'
  c.lineWidth = 1.5
  c.stroke()

  // Headlights (facing downward/forward)
  c.fillStyle = '#fff9c4'
  roundedRect(c, x - w * 0.32, y + h * 0.46, w * 0.2, h * 0.08, 3)
  c.fill()
  roundedRect(c, x + w * 0.32, y + h * 0.46, w * 0.2, h * 0.08, 3)
  c.fill()

  // Headlight beam cone on road
  const beamGrad = c.createLinearGradient(x, y + h * 0.5, x, y + h * 0.5 + 45)
  beamGrad.addColorStop(0, 'rgba(255, 250, 200, 0.35)')
  beamGrad.addColorStop(1, 'rgba(255, 250, 200, 0)')
  c.fillStyle = beamGrad
  c.beginPath()
  c.moveTo(x - w * 0.4, y + h * 0.5)
  c.lineTo(x - w * 0.55, y + h * 0.5 + 45)
  c.lineTo(x + w * 0.55, y + h * 0.5 + 45)
  c.lineTo(x + w * 0.4, y + h * 0.5)
  c.closePath()
  c.fill()

  // Taillights
  c.fillStyle = '#ff1744'
  roundedRect(c, x - w * 0.32, y - h * 0.47, w * 0.22, h * 0.06, 2)
  c.fill()
  roundedRect(c, x + w * 0.32, y - h * 0.47, w * 0.22, h * 0.06, 2)
  c.fill()

  // Windshield & Rear glass
  c.fillStyle = '#455a64'
  // Front Windshield
  roundedRect(c, x, y + h * 0.16, w * 0.72, h * 0.22, 5)
  c.fill()
  c.fillStyle = 'rgba(255,255,255,0.4)'
  c.beginPath()
  c.moveTo(x - w * 0.3, y + h * 0.22)
  c.lineTo(x + w * 0.1, y + h * 0.08)
  c.lineTo(x + w * 0.2, y + h * 0.08)
  c.lineTo(x - w * 0.2, y + h * 0.22)
  c.closePath()
  c.fill()

  // Rear Windshield
  c.fillStyle = '#37474f'
  roundedRect(c, x, y - h * 0.24, w * 0.68, h * 0.16, 4)
  c.fill()

  // Roof
  c.fillStyle = color.roof
  roundedRect(c, x, y - h * 0.04, w * 0.68, h * 0.34, 4)
  c.fill()

  // Side mirrors
  c.fillStyle = color.dark
  roundedRect(c, x - w * 0.49, y + h * 0.16, w * 0.1, h * 0.08, 2)
  c.fill()
  roundedRect(c, x + w * 0.49, y + h * 0.16, w * 0.1, h * 0.08, 2)
  c.fill()

  c.restore()
}

/** Draw authentic Indonesian MetroMini / Bus */
function drawBus(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  c.save()
  // Shadow
  c.fillStyle = 'rgba(0, 0, 0, 0.5)'
  roundedRect(c, x + 4, y + 5, w * 0.94, h * 0.96, 8)
  c.fill()

  // Wheels (Dual rear tires)
  c.fillStyle = '#1a1a1a'
  const tireW = w * 0.15
  const tireH = h * 0.14
  roundedRect(c, x - w * 0.46, y + h * 0.32, tireW, tireH, 3)
  c.fill()
  roundedRect(c, x + w * 0.46, y + h * 0.32, tireW, tireH, 3)
  c.fill()
  roundedRect(c, x - w * 0.46, y - h * 0.32, tireW, tireH * 1.3, 3)
  c.fill()
  roundedRect(c, x + w * 0.46, y - h * 0.32, tireW, tireH * 1.3, 3)
  c.fill()

  // MetroMini Body: Vibrant Orange with Navy Blue Stripe
  const grad = c.createLinearGradient(x - w / 2, y, x + w / 2, y)
  grad.addColorStop(0, '#d84315')
  grad.addColorStop(0.3, '#ff6f00')
  grad.addColorStop(0.7, '#ff6f00')
  grad.addColorStop(1, '#d84315')
  c.fillStyle = grad
  roundedRect(c, x, y, w * 0.88, h, 8)
  c.fill()

  // Blue livery stripe across length
  c.fillStyle = '#0d47a1'
  roundedRect(c, x, y, w * 0.88, h * 0.14, 2)
  c.fill()

  // Front windscreen
  c.fillStyle = '#37474f'
  roundedRect(c, x, y + h * 0.4, w * 0.78, h * 0.12, 4)
  c.fill()

  // Signboard above windscreen ("METROMINI")
  c.fillStyle = '#212121'
  roundedRect(c, x, y + h * 0.46, w * 0.55, h * 0.05, 2)
  c.fill()
  c.fillStyle = '#ffd600'
  c.font = `bold ${Math.max(7, Math.round(w * 0.14))}px sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText('METROMINI', x, y + h * 0.46)

  // Roof AC / Ventilation units
  c.fillStyle = '#eeeeee'
  roundedRect(c, x, y - h * 0.05, w * 0.5, h * 0.35, 4)
  c.fill()
  c.strokeStyle = '#bdbdbd'
  c.lineWidth = 1
  for (let i = -2; i <= 2; i++) {
    c.beginPath()
    c.moveTo(x - w * 0.2, y - h * 0.05 + i * (h * 0.06))
    c.lineTo(x + w * 0.2, y - h * 0.05 + i * (h * 0.06))
    c.stroke()
  }

  // Windows with passenger silhouettes
  c.fillStyle = '#263238'
  const winCount = 5
  const winStep = (h * 0.6) / winCount
  for (let i = 0; i < winCount; i++) {
    const wy = y - h * 0.28 + i * winStep
    roundedRect(c, x - w * 0.38, wy, w * 0.08, winStep * 0.7, 2)
    c.fill()
    roundedRect(c, x + w * 0.38, wy, w * 0.08, winStep * 0.7, 2)
    c.fill()
    // passenger head silhouette
    if ((i + 1) % 2 === 0) {
      c.fillStyle = '#546e7a'
      c.beginPath()
      c.arc(x - w * 0.38, wy, 2.5, 0, Math.PI * 2)
      c.arc(x + w * 0.38, wy, 2.5, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#263238'
    }
  }

  // Headlights
  c.fillStyle = '#fff9c4'
  roundedRect(c, x - w * 0.34, y + h * 0.48, w * 0.14, h * 0.04, 2)
  c.fill()
  roundedRect(c, x + w * 0.34, y + h * 0.48, w * 0.14, h * 0.04, 2)
  c.fill()

  // Headlight beam
  const beamGrad = c.createLinearGradient(x, y + h * 0.5, x, y + h * 0.5 + 55)
  beamGrad.addColorStop(0, 'rgba(255, 250, 200, 0.4)')
  beamGrad.addColorStop(1, 'rgba(255, 250, 200, 0)')
  c.fillStyle = beamGrad
  c.beginPath()
  c.moveTo(x - w * 0.42, y + h * 0.5)
  c.lineTo(x - w * 0.65, y + h * 0.5 + 55)
  c.lineTo(x + w * 0.65, y + h * 0.5 + 55)
  c.lineTo(x + w * 0.42, y + h * 0.5)
  c.closePath()
  c.fill()

  // Taillights
  c.fillStyle = '#d50000'
  roundedRect(c, x - w * 0.34, y - h * 0.48, w * 0.15, h * 0.04, 2)
  c.fill()
  roundedRect(c, x + w * 0.34, y - h * 0.48, w * 0.15, h * 0.04, 2)
  c.fill()

  c.restore()
}

/** Draw realistic puddle / pothole (lubang aspal berair) */
function drawPothole(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number): void {
  c.save()
  // Asphalt crack border
  c.fillStyle = '#1e222b'
  c.beginPath()
  c.ellipse(x, y, w * 0.52, h * 0.52, 0, 0, Math.PI * 2)
  c.fill()

  // Jagged hole edge
  c.fillStyle = '#111317'
  c.beginPath()
  c.ellipse(x, y, w * 0.45, h * 0.45, 0.1, 0, Math.PI * 2)
  c.fill()

  // Dirty brown/sky water reflection
  const waterGrad = c.createRadialGradient(x - w * 0.1, y - h * 0.1, 2, x, y, w * 0.4)
  waterGrad.addColorStop(0, '#3e4a59')
  waterGrad.addColorStop(0.7, '#242a33')
  waterGrad.addColorStop(1, '#15191f')
  c.fillStyle = waterGrad
  c.beginPath()
  c.ellipse(x, y, w * 0.4, h * 0.38, 0.1, 0, Math.PI * 2)
  c.fill()

  // Ripple rings
  const rip = (time * 2.5) % 1
  c.strokeStyle = `rgba(180, 210, 240, ${0.4 * (1 - rip)})`
  c.lineWidth = 1.2
  c.beginPath()
  c.ellipse(x, y, w * 0.35 * rip, h * 0.35 * rip, 0.1, 0, Math.PI * 2)
  c.stroke()

  c.restore()
}

/** Draw walking pedestrian */
function drawPedestrian(c: CanvasRenderingContext2D, x: number, y: number, w: number, vx: number, time: number): void {
  c.save()
  // Walking cycle animation
  const walkPhase = time * 7
  const legSwing = Math.sin(walkPhase) * 6
  const armSwing = Math.cos(walkPhase) * 5

  // Shadow
  c.fillStyle = 'rgba(0,0,0,0.35)'
  c.beginPath()
  c.ellipse(x, y + 2, w * 0.4, w * 0.25, 0, 0, Math.PI * 2)
  c.fill()

  // Feet
  c.fillStyle = '#212121'
  c.beginPath()
  c.ellipse(x - 3 + (vx > 0 ? legSwing : -legSwing), y + 6, 2.5, 4, 0, 0, Math.PI * 2)
  c.ellipse(x + 3 - (vx > 0 ? legSwing : -legSwing), y + 6, 2.5, 4, 0, 0, Math.PI * 2)
  c.fill()

  // Batik / Colored Shirt
  c.fillStyle = '#1e88e5'
  roundedRect(c, x, y, w * 0.55, w * 0.4, 4)
  c.fill()

  // Arms swinging
  c.fillStyle = '#ffcc80'
  c.beginPath()
  c.arc(x - w * 0.3, y + armSwing, 2.5, 0, Math.PI * 2)
  c.arc(x + w * 0.3, y - armSwing, 2.5, 0, Math.PI * 2)
  c.fill()

  // Head with hair
  c.fillStyle = '#3e2723'
  c.beginPath()
  c.arc(x, y - 2, w * 0.24, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#ffb74d'
  c.beginPath()
  c.arc(x, y, w * 0.18, 0, Math.PI * 2)
  c.fill()

  // Pedestrian zebra-stripes reminder below
  c.fillStyle = 'rgba(255, 255, 255, 0.18)'
  for (let i = -1; i <= 1; i++) {
    c.fillRect(x - w * 0.8, y + i * 8 - 1, w * 1.6, 3)
  }

  c.restore()
}

/** Draw high quality pickup items (Parcel, Fuel, Umbrella) */
function drawItem(c: CanvasRenderingContext2D, x: number, y: number, w: number, kind: string, time: number): void {
  c.save()
  const bob = Math.sin(time * 5 + x) * 4
  const py = y + bob

  // Glowing ground halo
  const haloColor = kind === 'parcel' ? 'rgba(255, 179, 0, 0.35)' : kind === 'fuel' ? 'rgba(76, 175, 80, 0.4)' : 'rgba(171, 71, 188, 0.4)'
  c.fillStyle = haloColor
  c.beginPath()
  c.ellipse(x, y + 10, w * 0.5, w * 0.25, 0, 0, Math.PI * 2)
  c.fill()

  // Sparkling rotating ring
  c.strokeStyle = kind === 'parcel' ? '#ffd54f' : kind === 'fuel' ? '#81c784' : '#ce93d8'
  c.lineWidth = 1.5
  c.setLineDash([4, 4])
  c.beginPath()
  c.ellipse(x, py, w * 0.48, w * 0.28, time * 2, 0, Math.PI * 2)
  c.stroke()
  c.setLineDash([])

  if (kind === 'parcel') {
    // 3D Cardboard delivery box
    const sz = w * 0.6
    c.fillStyle = '#a17238'
    roundedRect(c, x, py, sz, sz, 4)
    c.fill()
    // Box flaps & tape
    c.fillStyle = '#8d5d28'
    c.fillRect(x - sz / 2, py - 2, sz, 4)
    c.fillStyle = '#d7ccc8'
    c.fillRect(x - 3, py - sz / 2, 6, sz)
    // Fragile red label
    c.fillStyle = '#e53935'
    c.fillRect(x - sz * 0.35, py - sz * 0.35, sz * 0.3, sz * 0.2)
  } else if (kind === 'fuel') {
    // Red metal jerrycan
    const bw = w * 0.5
    const bh = w * 0.65
    c.fillStyle = '#d32f2f'
    roundedRect(c, x, py, bw, bh, 4)
    c.fill()
    // Handle
    c.fillStyle = '#b71c1c'
    roundedRect(c, x, py - bh * 0.48, bw * 0.5, bh * 0.2, 2)
    c.fill()
    // Fuel emblem
    c.fillStyle = '#fff'
    c.font = `bold ${Math.round(bw * 0.45)}px sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('⛽', x, py + 1)
  } else {
    // Colorful umbrella
    const ur = w * 0.4
    const grad = c.createLinearGradient(x - ur, py, x + ur, py)
    grad.addColorStop(0, '#e91e63')
    grad.addColorStop(0.33, '#9c27b0')
    grad.addColorStop(0.66, '#2196f3')
    grad.addColorStop(1, '#00e676')
    c.fillStyle = grad
    c.beginPath()
    c.arc(x, py - ur * 0.1, ur, Math.PI, 0)
    c.closePath()
    c.fill()
    // Umbrella tip & handle
    c.fillStyle = '#fff'
    c.fillRect(x - 1.5, py - ur * 0.1, 3, ur * 0.7)
    c.beginPath()
    c.arc(x + 3, py + ur * 0.6, 4.5, 0, Math.PI)
    c.stroke()
  }

  c.restore()
}

/** Draw Entity dispatcher */
function drawEntity(c: CanvasRenderingContext2D, l: Layout, e: Entity, y: number, time: number): void {
  const x = laneCenter(l, e.x)
  const w = e.halfWidth * 2 * l.laneW * 1.05
  const h = e.len * l.pxM

  switch (e.kind) {
    case 'car':
      drawCar(c, x, y, w, h, e.pos + e.x)
      break
    case 'bus':
      drawBus(c, x, y, w, h)
      break
    case 'pothole':
      drawPothole(c, x, y, w, h, time)
      break
    case 'pedestrian':
      drawPedestrian(c, x, y, w, e.vx, time)
      break
    default:
      drawItem(c, x, y, w, e.kind, time)
  }
}

/** Draw Player Ojek Scooter (detailed top-down Honda Beat / Vario + Gojek-style driver) */
function drawPlayer(c: CanvasRenderingContext2D, l: Layout, g: Game, bx: number, bikeY: number): void {
  c.save()

  // Banking tilt calculation when moving between lanes
  const targetX = laneCenter(l, g.laneTarget)
  const tilt = Math.max(-0.25, Math.min(0.25, (targetX - bx) * 0.008))
  c.translate(bx, bikeY)
  c.rotate(tilt)

  const bw = l.laneW * 0.38
  const blen = BIKE_LEN * l.pxM

  // Smoke puffs spawn near exhaust pipe
  if (g.boost <= 0 && Math.random() < 0.3) {
    smokes.push({ x: bx - bw * 0.2, y: bikeY + blen * 0.42, r: 2.5, alpha: 0.4 })
  }

  // Shadow
  c.fillStyle = 'rgba(0, 0, 0, 0.42)'
  c.beginPath()
  c.ellipse(3, 4, bw * 0.45, blen * 0.5, 0, 0, Math.PI * 2)
  c.fill()

  // Boost flame / glow aura
  if (g.boost > 0) {
    const auraGrad = c.createRadialGradient(0, blen * 0.3, 5, 0, 0, blen * 0.9)
    auraGrad.addColorStop(0, 'rgba(255, 215, 0, 0.7)')
    auraGrad.addColorStop(0.5, 'rgba(255, 110, 0, 0.4)')
    auraGrad.addColorStop(1, 'rgba(255, 60, 0, 0)')
    c.fillStyle = auraGrad
    c.beginPath()
    c.ellipse(0, 0, bw * 1.2, blen * 0.9, 0, 0, Math.PI * 2)
    c.fill()

    // Exhaust thrust flame
    c.fillStyle = '#ffab00'
    c.beginPath()
    c.moveTo(-bw * 0.2, blen * 0.5)
    c.lineTo(0, blen * 0.5 + 18 + Math.random() * 8)
    c.lineTo(bw * 0.2, blen * 0.5)
    c.closePath()
    c.fill()
  }

  // Front tire & rear tire
  c.fillStyle = '#111'
  roundedRect(c, 0, -blen * 0.42, bw * 0.2, blen * 0.2, 3)
  c.fill()
  roundedRect(c, 0, blen * 0.38, bw * 0.22, blen * 0.22, 3)
  c.fill()

  // Scooter Body (Glossy Green & Black)
  c.fillStyle = '#1b5e20'
  roundedRect(c, 0, 0, bw * 0.65, blen * 0.75, 6)
  c.fill()

  // Front Cowling & Headlight
  c.fillStyle = '#2e7d32'
  roundedRect(c, 0, -blen * 0.28, bw * 0.6, blen * 0.25, 4)
  c.fill()
  // Bright LED Headlight
  c.fillStyle = '#ffffff'
  roundedRect(c, 0, -blen * 0.38, bw * 0.35, blen * 0.08, 3)
  c.fill()

  // Headlight beam projecting upward on road
  const headlightBeam = c.createLinearGradient(0, -blen * 0.4, 0, -blen * 0.4 - 90)
  headlightBeam.addColorStop(0, 'rgba(255, 255, 255, 0.45)')
  headlightBeam.addColorStop(1, 'rgba(255, 255, 255, 0)')
  c.fillStyle = headlightBeam
  c.beginPath()
  c.moveTo(-bw * 0.2, -blen * 0.4)
  c.lineTo(-bw * 0.7, -blen * 0.4 - 90)
  c.lineTo(bw * 0.7, -blen * 0.4 - 90)
  c.lineTo(bw * 0.2, -blen * 0.4)
  c.closePath()
  c.fill()

  // Handlebars with side mirrors
  c.fillStyle = '#212121'
  roundedRect(c, 0, -blen * 0.25, bw * 0.85, blen * 0.06, 2)
  c.fill()
  // Mirrors
  roundedRect(c, -bw * 0.42, -blen * 0.28, bw * 0.1, blen * 0.05, 2)
  c.fill()
  roundedRect(c, bw * 0.42, -blen * 0.28, bw * 0.1, blen * 0.05, 2)
  c.fill()

  // Scooter Seat
  c.fillStyle = '#212121'
  roundedRect(c, 0, blen * 0.08, bw * 0.45, blen * 0.4, 4)
  c.fill()

  // Driver: Ojol Green Jacket with Black Shoulders & White Reflective Stripes
  // Torso
  c.fillStyle = '#00843d' // Gojek green
  roundedRect(c, 0, -blen * 0.02, bw * 0.58, blen * 0.32, 6)
  c.fill()
  // Black shoulder yoke
  c.fillStyle = '#212121'
  roundedRect(c, 0, -blen * 0.1, bw * 0.55, blen * 0.12, 3)
  c.fill()
  // White reflective safety stripes
  c.fillStyle = '#eeeeee'
  roundedRect(c, 0, -blen * 0.03, bw * 0.52, 2.5, 1)
  c.fill()

  // Arms gripping handlebar
  c.strokeStyle = '#00843d'
  c.lineWidth = bw * 0.14
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(-bw * 0.22, -blen * 0.06)
  c.lineTo(-bw * 0.32, -blen * 0.22)
  c.stroke()
  c.beginPath()
  c.moveTo(bw * 0.22, -blen * 0.06)
  c.lineTo(bw * 0.32, -blen * 0.22)
  c.stroke()

  // Helmet with glossy dark visor
  c.fillStyle = '#006930'
  c.beginPath()
  c.arc(0, -blen * 0.12, bw * 0.22, 0, Math.PI * 2)
  c.fill()
  // Glossy visor
  c.fillStyle = '#111'
  c.beginPath()
  c.ellipse(0, -blen * 0.16, bw * 0.18, bw * 0.1, 0, Math.PI, Math.PI * 2)
  c.fill()
  // Visor glint
  c.fillStyle = 'rgba(255, 255, 255, 0.6)'
  c.beginPath()
  c.arc(-bw * 0.08, -blen * 0.17, 2, 0, Math.PI * 2)
  c.fill()

  // Green Delivery Bag on Back of Bike
  c.fillStyle = '#004d25'
  roundedRect(c, 0, blen * 0.26, bw * 0.5, blen * 0.2, 4)
  c.fill()
  c.strokeStyle = '#a5d6a7'
  c.lineWidth = 1.2
  c.strokeRect(-bw * 0.2, blen * 0.19, bw * 0.4, blen * 0.14)

  // Umbrella shield over player
  if (g.umbrella > 0) {
    const ur = bw * 1.1
    const grad = c.createLinearGradient(-ur, 0, ur, 0)
    grad.addColorStop(0, '#ab47bc')
    grad.addColorStop(0.5, '#ba68c8')
    grad.addColorStop(1, '#8e24aa')
    c.fillStyle = grad
    c.beginPath()
    c.arc(0, 0, ur, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#e1bee7'
    c.lineWidth = 2
    c.stroke()
  }

  c.restore()
}

/** Main draw function */
export function draw(c: CanvasRenderingContext2D, g: Game, l: Layout, best: number): void {
  c.clearRect(0, 0, l.w, l.h)

  // 1. Sidewalk, curbs, and grass verge
  // Green grass background on edges
  c.fillStyle = '#2e3828'
  c.fillRect(0, 0, l.w, l.h)

  // Concrete sidewalk paved slabs
  const swW = (l.w - l.roadW) / 2
  c.fillStyle = '#484d59'
  c.fillRect(0, 0, swW, l.h)
  c.fillRect(l.roadX + l.roadW, 0, swW, l.h)

  // Pavement slab lines
  c.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  c.lineWidth = 1.5
  const slabH = 32
  const slabOff = (g.distance * l.pxM) % slabH
  for (let y = -slabH + slabOff; y < l.h + slabH; y += slabH) {
    c.beginPath()
    c.moveTo(0, y)
    c.lineTo(swW, y)
    c.moveTo(l.roadX + l.roadW, y)
    c.lineTo(l.w, y)
    c.stroke()
  }

  // 2. Asphalt Road with realistic dark tarmac
  c.fillStyle = '#22252c'
  c.fillRect(l.roadX, 0, l.roadW, l.h)

  // Curbs with alternating Indonesian Black & Yellow Hazard Stripes
  const curbW = 6
  const curbStep = 24
  const curbOff = (g.distance * l.pxM) % (curbStep * 2)
  for (let y = -curbStep * 2 + curbOff; y < l.h + curbStep * 2; y += curbStep) {
    const isYellow = Math.floor(y / curbStep) % 2 === 0
    c.fillStyle = isYellow ? '#fbc02d' : '#212121'
    c.fillRect(l.roadX - curbW, y, curbW, curbStep)
    c.fillRect(l.roadX + l.roadW, y, curbW, curbStep)
  }

  // 3. Dashed Lane Lines with reflective studs (mata kucing)
  const dash = 3.5 * l.pxM
  const off = (g.distance * l.pxM) % (dash * 2)
  c.fillStyle = '#f0f0f0'
  for (let i = 1; i < LANES; i++) {
    const lx = l.roadX + i * l.laneW
    for (let y = -dash * 2 + off; y < l.h + dash; y += dash * 2) {
      c.fillRect(lx - 2, y, 4, dash)
      // Reflective stud at start of each stripe
      c.fillStyle = '#ffd54f'
      c.fillRect(lx - 3, y - 2, 6, 3)
      c.fillStyle = '#f0f0f0'
    }
  }

  // 4. Streetlights glow along sidewalk
  const lampDist = 45 * l.pxM
  const lampOff = (g.distance * l.pxM) % lampDist
  for (let y = -lampDist + lampOff; y < l.h + lampDist; y += lampDist) {
    const lampGrad = c.createRadialGradient(l.roadX + 15, y, 5, l.roadX + 15, y, 80)
    lampGrad.addColorStop(0, 'rgba(255, 230, 160, 0.15)')
    lampGrad.addColorStop(1, 'rgba(255, 230, 160, 0)')
    c.fillStyle = lampGrad
    c.beginPath()
    c.arc(l.roadX + 15, y, 80, 0, Math.PI * 2)
    c.fill()
  }

  // 5. Draw Entities (Cars, Buses, Potholes, Items, Pedestrians)
  const bikeY = l.h * BIKE_Y
  for (const e of g.entities) {
    const y = bikeY - (e.pos - g.distance) * l.pxM
    if (y < -120 || y > l.h + 120) continue
    drawEntity(c, l, e, y, g.time)
  }

  // 5.5 Exhaust smoke particles
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i]!
    s.y += difficulty(g.time).speed * l.pxM * 0.4 * 0.016
    s.r += 0.35
    s.alpha -= 0.018
    c.fillStyle = `rgba(180, 195, 205, ${Math.max(0, s.alpha)})`
    c.beginPath()
    c.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    c.fill()
    if (s.alpha <= 0) smokes.splice(i, 1)
  }

  // 6. Player Bike (blinks while invulnerable from hit)
  const blink = g.invulnerable > 0 && g.boost <= 0 && Math.floor(g.time * 14) % 2 === 0
  if (!blink) {
    const bx = laneCenter(l, g.x)
    drawPlayer(c, l, g, bx, bikeY)
  }

  // 7. Dynamic Rain & Weather Effects
  if (isRaining(g)) {
    // Dark thunderstorm tint
    c.fillStyle = 'rgba(15, 22, 38, 0.35)'
    c.fillRect(0, 0, l.w, l.h)

    // Raindrop streaks
    c.strokeStyle = 'rgba(210, 230, 255, 0.65)'
    c.lineWidth = 1.2
    c.beginPath()
    for (let i = 0; i < 110; i++) {
      const rx = (i * 97.3) % l.w
      const ry = (i * 53.7 + g.time * 1100) % l.h
      c.moveTo(rx, ry)
      c.lineTo(rx - 5, ry + 16)
    }
    c.stroke()
  }

  // 8. Floating Scores / Notifications
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i]!
    ft.time += 0.016
    ft.y += ft.vy * 0.016
    ft.alpha = Math.max(0, 1 - ft.time * 1.5)
    c.save()
    c.fillStyle = ft.color
    c.globalAlpha = ft.alpha
    c.font = 'bold 18px sans-serif'
    c.textAlign = 'center'
    c.shadowColor = 'rgba(0,0,0,0.8)'
    c.shadowBlur = 4
    c.fillText(ft.text, ft.x, ft.y)
    c.restore()
    if (ft.alpha <= 0) floatingTexts.splice(i, 1)
  }

  // 9. Modern Polish HUD
  // HUD Background Glass Card
  c.save()
  c.fillStyle = 'rgba(20, 24, 34, 0.85)'
  c.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  c.lineWidth = 1
  roundedRect(c, 105, 55, 185, 88, 12)
  c.fill()
  c.stroke()

  c.fillStyle = '#ffd54f'
  c.font = 'bold 24px system-ui, sans-serif'
  c.textAlign = 'left'
  c.textBaseline = 'top'
  const currentScore = Math.floor(g.distance) + Math.floor(g.bonus)
  c.fillText(`⚡ ${currentScore}`, 22, 18)

  c.fillStyle = '#b0bec5'
  c.font = '600 13px system-ui, sans-serif'
  c.fillText(`Rekor: ${best}`, 24, 48)

  // Lives (Hearts)
  let hearts = ''
  for (let i = 0; i < 3; i++) {
    hearts += i < g.lives ? '❤️ ' : '🖤 '
  }
  c.font = '16px system-ui, sans-serif'
  c.fillText(hearts, 24, 68)

  // Speedometer widget on top right
  const spdW = 95
  const spdX = l.w - spdW / 2 - 16
  c.fillStyle = 'rgba(20, 24, 34, 0.85)'
  roundedRect(c, spdX, 40, spdW, 58, 10)
  c.fill()
  c.stroke()

  const currentSpeed = Math.round((g.boost > 0 ? difficulty(g.time).speed * 1.5 : difficulty(g.time).speed) * 3.6) // km/h
  c.fillStyle = g.boost > 0 ? '#ff9100' : '#4fc3f7'
  c.font = 'bold 20px system-ui, sans-serif'
  c.textAlign = 'center'
  c.fillText(`${currentSpeed}`, spdX, 20)
  c.fillStyle = '#90a4ae'
  c.font = '600 11px system-ui, sans-serif'
  c.fillText('KM/JAM', spdX, 46)

  // Status Banner on bottom center
  if (g.boost > 0) {
    c.fillStyle = 'rgba(255, 145, 0, 0.9)'
    roundedRect(c, l.w / 2, l.h - 45, 220, 36, 18)
    c.fill()
    c.fillStyle = '#fff'
    c.font = 'bold 15px system-ui, sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(`⚡ TURBO BOOST! ${g.boost.toFixed(1)}s`, l.w / 2, l.h - 45)
  } else if (g.umbrella > 0) {
    c.fillStyle = 'rgba(171, 71, 188, 0.9)'
    roundedRect(c, l.w / 2, l.h - 45, 220, 36, 18)
    c.fill()
    c.fillStyle = '#fff'
    c.font = 'bold 15px system-ui, sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(`☂ PAYUNG AKTIF! ${g.umbrella.toFixed(1)}s`, l.w / 2, l.h - 45)
  } else if (g.rain > 0) {
    c.fillStyle = 'rgba(41, 128, 185, 0.85)'
    roundedRect(c, l.w / 2, l.h - 45, 230, 32, 16)
    c.fill()
    c.fillStyle = '#fff'
    c.font = 'bold 13px system-ui, sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('🌧 Hujan Licin! Ambil Payung ☂', l.w / 2, l.h - 45)
  }

  c.restore()
}
