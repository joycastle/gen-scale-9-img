// 基于 BFS 逐层扩散的 Alpha Bleeding 算法
// 参考: https://github.com/urraka/alpha-bleeding

export function alphaBleeding(imageData: ImageData): ImageData {
  const { width, height } = imageData
  const N = width * height
  const image = new Uint8ClampedArray(imageData.data)

  // opaque 状态标记:
  //   -1 (0xFF) = 原始不透明像素，可作为颜色源 (& 1 === 1)
  //   0xFE     = 本轮刚填充，暂不作为颜色源 (& 1 === 0)
  //   >>= 1 后变为 0x7F，下轮可作为颜色源 (& 1 === 1)
  const opaque = new Int8Array(N)
  const loose = new Uint8Array(N) // 是否为"远离边界的透明像素"

  let pending: number[] = []
  let pendingNext: number[] = []

  const offsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1],
  ]

  // 初始化：分类所有透明像素
  for (let i = 0; i < N; i++) {
    if (image[i * 4 + 3] === 0) {
      // 透明像素：检查是否与不透明像素相邻
      let isLoose = true
      const x = i % width
      const y = (i / width) | 0

      for (const [dx, dy] of offsets) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (image[(ny * width + nx) * 4 + 3] !== 0) {
            isLoose = false
            break
          }
        }
      }

      if (!isLoose) {
        pending.push(i) // 边界透明像素，优先处理
      } else {
        loose[i] = 1 // 远离边界，等后续轮次
      }
    } else {
      opaque[i] = -1 // 0xFF，原始不透明
    }
  }

  // BFS 逐层扩散
  while (pending.length > 0) {
    pendingNext = []

    for (const j of pending) {
      const x = j % width
      const y = (j / width) | 0
      const pi = j * 4

      let r = 0, g = 0, b = 0, count = 0

      for (const [dx, dy] of offsets) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const nIdx = ny * width + nx
        // 仅从已确定的像素取色（opaque & 1 === 1）
        if (opaque[nIdx] & 1) {
          const ni = nIdx * 4
          r += image[ni]
          g += image[ni + 1]
          b += image[ni + 2]
          count++
        }
      }

      if (count > 0) {
        image[pi] = (r / count) | 0
        image[pi + 1] = (g / count) | 0
        image[pi + 2] = (b / count) | 0
        // alpha 保持为 0
        opaque[j] = 0x7E as unknown as number // 本轮填充标记，& 1 === 0

        // 将相邻的 loose 像素加入下一轮
        for (const [dx, dy] of offsets) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const nIdx = ny * width + nx
          if (loose[nIdx]) {
            pendingNext.push(nIdx)
            loose[nIdx] = 0
          }
        }
      } else {
        // 本轮无邻居可取色，推迟到下一轮
        pendingNext.push(j)
      }
    }

    // 本轮填充的像素在下一轮变为可用颜色源
    if (pendingNext.length > 0) {
      for (const j of pending) {
        opaque[j] >>= 1
      }
    }

    pending = pendingNext
  }

  return new ImageData(image, width, height)
}
