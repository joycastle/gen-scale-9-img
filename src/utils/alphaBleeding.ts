export function alphaBleeding(imageData: ImageData, iterations: number = 32): ImageData {
  const { width, height } = imageData
  const data = new Uint8ClampedArray(imageData.data)
  const hasColor = new Uint8Array(width * height)

  // Mark pixels that have alpha > 0
  for (let i = 0; i < width * height; i++) {
    if (data[i * 4 + 3] > 0) {
      hasColor[i] = 1
    }
  }

  const offsets = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ]

  for (let iter = 0; iter < iterations; iter++) {
    let changed = false
    const newHasColor = new Uint8Array(hasColor)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        if (hasColor[idx]) continue

        let r = 0, g = 0, b = 0, count = 0
        for (const [dx, dy] of offsets) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const nIdx = ny * width + nx
          if (hasColor[nIdx]) {
            r += data[nIdx * 4]
            g += data[nIdx * 4 + 1]
            b += data[nIdx * 4 + 2]
            count++
          }
        }

        if (count > 0) {
          const pi = idx * 4
          data[pi] = Math.round(r / count)
          data[pi + 1] = Math.round(g / count)
          data[pi + 2] = Math.round(b / count)
          // alpha stays 0
          newHasColor[idx] = 1
          changed = true
        }
      }
    }

    hasColor.set(newHasColor)
    if (!changed) break
  }

  return new ImageData(data, width, height)
}
