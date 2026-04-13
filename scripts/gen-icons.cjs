const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function uint32BE(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n)
  return b
}

function chunk(type, data) {
  const typeB = Buffer.from(type)
  const len = uint32BE(data.length)
  const crc = uint32BE(crc32(Buffer.concat([typeB, data])))
  return Buffer.concat([len, typeB, data, crc])
}

function createPNG(size) {
  // Orange: #f97316 = 249, 115, 22
  // White emoji area (simplified: orange bg + white rounded rect)
  const pixels = []
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38 // emoji circle radius
  const pad = size * 0.12

  for (let y = 0; y < size; y++) {
    pixels.push(0) // filter byte
    for (let x = 0; x < size; x++) {
      const inCircle = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) < r
      if (inCircle) {
        // white inner circle
        pixels.push(255, 255, 255, 255)
      } else {
        // orange background
        pixels.push(249, 115, 22, 255)
      }
    }
  }

  const raw = Buffer.from(pixels)
  const compressed = zlib.deflateSync(raw)

  const ihdr = chunk('IHDR', Buffer.concat([
    uint32BE(size), uint32BE(size),
    Buffer.from([8, 2, 0, 0, 0]) // 8-bit, RGB+alpha, deflate, filter, interlace
  ]))

  // RGBA is depth 8, colortype 6
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(size, 0)
  ihdrData.writeUInt32BE(size, 4)
  ihdrData.writeUInt8(8, 8)   // bit depth
  ihdrData.writeUInt8(6, 9)   // color type: RGBA
  ihdrData.writeUInt8(0, 10)  // compression
  ihdrData.writeUInt8(0, 11)  // filter
  ihdrData.writeUInt8(0, 12)  // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdrChunk = chunk('IHDR', ihdrData)
  const idatChunk = chunk('IDAT', compressed)
  const iendChunk = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

const outDir = path.join(__dirname, '../public/icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [192, 512]) {
  const png = createPNG(size)
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png)
  console.log(`Created icon-${size}.png`)
}
