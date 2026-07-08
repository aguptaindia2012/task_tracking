// Generates the PWA icons (public/icon-192.png, public/icon-512.png) without
// any image dependencies: raw RGBA pixels -> zlib -> hand-built PNG chunks.
// Design: indigo rounded square with a white check mark.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function crc32(buf) {
  let c, table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, draw) {
  // raw scanlines: each row prefixed with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y)
      const o = row + 1 + x * 4
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// distance from point to line segment, for drawing the check stroke
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  const cx = x1 + t * dx, cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function makeIcon(size) {
  const bg = [79, 70, 229]      // indigo-600
  const radius = size * 0.22
  const stroke = size * 0.085
  // check mark: three points relative to the icon box
  const p1 = [size * 0.28, size * 0.53]
  const p2 = [size * 0.44, size * 0.69]
  const p3 = [size * 0.73, size * 0.34]
  return png(size, (x, y) => {
    // rounded-rect mask
    const rx = Math.max(0, Math.max(radius - x, x - (size - 1 - radius)))
    const ry = Math.max(0, Math.max(radius - y, y - (size - 1 - radius)))
    if (Math.hypot(rx, ry) > radius) return [0, 0, 0, 0]
    const d = Math.min(segDist(x, y, ...p1, ...p2), segDist(x, y, ...p2, ...p3))
    if (d < stroke) return [255, 255, 255, 255]
    if (d < stroke + 1.5) {
      // 1px antialias band blending white into the background
      const t = (d - stroke) / 1.5
      return [255 + (bg[0] - 255) * t, 255 + (bg[1] - 255) * t, 255 + (bg[2] - 255) * t, 255].map(Math.round)
    }
    return [...bg, 255]
  })
}

mkdirSync(join(root, 'public'), { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(root, 'public', `icon-${size}.png`), makeIcon(size))
  console.log(`public/icon-${size}.png written`)
}
