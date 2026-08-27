/**
 * Gera os ícones PNG do app sem depender de binário de imagem.
 *
 * A marca é a mesma ficha que o app desenha em CSS: anel dourado com entalhes
 * sobre fundo tinta, e miolo escuro com contorno. Rasteriza num buffer RGBA e
 * codifica o PNG à mão — IHDR + IDAT (deflate via zlib) + IEND.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const INK = [0x14, 0x17, 0x1f, 0xff]
const GOLD = [0xc9, 0xa2, 0x4b, 0xff]
const NOTCH = [0x2b, 0x32, 0x47, 0xff]

// ── Codificação PNG ──────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // profundidade de bits
  ihdr[9] = 6 // RGBA

  // Cada scanline é precedida pelo byte de filtro (0 = None).
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Desenho ──────────────────────────────────────────────────

function createCanvas(size, fill) {
  const buf = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) buf.set(fill, i * 4)
  return buf
}

function blend(buf, size, x, y, color, alpha) {
  if (alpha <= 0) return
  const i = (y * size + x) * 4
  const a = Math.min(1, alpha)
  for (let c = 0; c < 3; c++) {
    buf[i + c] = Math.round(buf[i + c] * (1 - a) + color[c] * a)
  }
  buf[i + 3] = 0xff
}

/**
 * Cobertura suavizada de um disco.
 *
 * Devolve quanto do pixel cai dentro do raio, entre 0 e 1. Sem isso a borda do
 * círculo fica serrilhada, o que aparece muito em 192px.
 */
function discCoverage(dist, radius) {
  if (dist <= radius - 0.5) return 1
  if (dist >= radius + 0.5) return 0
  return radius + 0.5 - dist
}

function drawChip(buf, size, { scale = 1 } = {}) {
  const center = size / 2
  const outer = 0.45 * size * scale
  const innerRing = 0.33 * size * scale
  const core = 0.3 * size * scale

  // Seis entalhes, como as listras da borda de uma ficha de mesa.
  const notches = 6
  const notchHalfWidth = Math.PI / 18 // 10° para cada lado

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - center
      const dy = y + 0.5 - center
      const dist = Math.hypot(dx, dy)

      // Anel dourado, com entalhes escuros em ângulos regulares.
      const inRing = discCoverage(dist, outer) * (1 - discCoverage(dist, innerRing))
      if (inRing > 0) {
        const angle = Math.atan2(dy, dx)
        const step = (Math.PI * 2) / notches
        const offset = Math.abs(((angle % step) + step + step / 2) % step) - step / 2
        const isNotch = Math.abs(offset) < notchHalfWidth
        blend(buf, size, x, y, isNotch ? NOTCH : GOLD, inRing)
      }

      // Miolo escuro com um fio dourado de contorno.
      const inCore = discCoverage(dist, core)
      if (inCore > 0) blend(buf, size, x, y, INK, inCore)
      const outline = discCoverage(dist, core + size * 0.012) - discCoverage(dist, core)
      if (outline > 0) blend(buf, size, x, y, GOLD, outline * 0.9)
    }
  }
}

function buildIcon(size, { maskable = false } = {}) {
  const buf = createCanvas(size, INK)
  // Zona segura do maskable: a marca encolhe para sobreviver ao recorte redondo.
  drawChip(buf, size, { scale: maskable ? 0.72 : 0.95 })
  return encodePng(size, size, buf)
}

// ── Saída ────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-512-maskable.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
]

for (const [name, size, opts] of targets) {
  const out = name === 'apple-touch-icon.png' ? resolve(OUT_DIR, '..', name) : resolve(OUT_DIR, name)
  writeFileSync(out, buildIcon(size, opts))
  console.log(`✓ ${name} (${size}×${size})`)
}
