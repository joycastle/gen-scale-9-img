import type { SliceRegion, BorderConfig } from '../types'

export function getImageSize(image: HTMLImageElement | ImageBitmap): { width: number; height: number } {
  if (image instanceof HTMLImageElement) return { width: image.naturalWidth, height: image.naturalHeight }
  return { width: image.width, height: image.height }
}

export function sliceRegionToBorder(region: SliceRegion, imgWidth: number, imgHeight: number): BorderConfig {
  return {
    top: region.top,
    bottom: imgHeight - region.bottom,
    left: region.left,
    right: imgWidth - region.right,
  }
}

function columnsAreSimilar(
  data: Uint8ClampedArray,
  col1: number,
  col2: number,
  height: number,
  width: number,
  tolerance: number,
): boolean {
  for (let y = 0; y < height; y++) {
    const i1 = (y * width + col1) * 4
    const i2 = (y * width + col2) * 4
    if (
      Math.abs(data[i1] - data[i2]) > tolerance ||
      Math.abs(data[i1 + 1] - data[i2 + 1]) > tolerance ||
      Math.abs(data[i1 + 2] - data[i2 + 2]) > tolerance ||
      Math.abs(data[i1 + 3] - data[i2 + 3]) > tolerance
    ) {
      return false
    }
  }
  return true
}

function rowsAreSimilar(
  data: Uint8ClampedArray,
  row1: number,
  row2: number,
  width: number,
  stride: number,
  tolerance: number,
): boolean {
  const base1 = row1 * stride
  const base2 = row2 * stride
  for (let x = 0; x < width; x++) {
    const i1 = base1 + x * 4
    const i2 = base2 + x * 4
    if (
      Math.abs(data[i1] - data[i2]) > tolerance ||
      Math.abs(data[i1 + 1] - data[i2 + 1]) > tolerance ||
      Math.abs(data[i1 + 2] - data[i2 + 2]) > tolerance ||
      Math.abs(data[i1 + 3] - data[i2 + 3]) > tolerance
    ) {
      return false
    }
  }
  return true
}

interface Run {
  start: number
  end: number
  length: number
}

function findLongestSimilarRun(
  count: number,
  compareFn: (a: number, b: number) => boolean,
): Run {
  let bestStart = 0
  let bestLength = 1
  let currentStart = 0
  let currentLength = 1

  for (let i = 1; i < count; i++) {
    if (compareFn(i - 1, i)) {
      currentLength++
    } else {
      if (currentLength > bestLength) {
        bestLength = currentLength
        bestStart = currentStart
      }
      currentStart = i
      currentLength = 1
    }
  }
  if (currentLength > bestLength) {
    bestLength = currentLength
    bestStart = currentStart
  }

  return {
    start: bestStart,
    end: bestStart + bestLength - 1,
    length: bestLength,
  }
}

export function computeSliceRegion(
  imageData: ImageData,
  tolerance: number = 0,
): SliceRegion {
  const { data, width, height } = imageData
  const stride = width * 4

  // 查找最长的相似列连续区间
  const colRun = findLongestSimilarRun(width, (a, b) =>
    columnsAreSimilar(data, a, b, height, width, tolerance),
  )

  let left = colRun.start
  let right = colRun.end
  if (left === right) {
    const mid = Math.floor(width / 2)
    left = mid - 1
    right = mid
  }

  // 查找最长的相似行连续区间
  const rowRun = findLongestSimilarRun(height, (a, b) =>
    rowsAreSimilar(data, a, b, width, stride, tolerance),
  )

  let top = rowRun.start
  let bottom = rowRun.end
  if (top === bottom) {
    const mid = Math.floor(height / 2)
    top = mid - 1
    bottom = mid
  }

  return { left, right, top, bottom }
}

export function getImageDataFromImage(image: HTMLImageElement | ImageBitmap): ImageData {
  const canvas = document.createElement('canvas')
  const { width, height } = getImageSize(image)
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

// 裁掉四周完全透明的边缘，返回裁剪后的 ImageBitmap
export function trimImage(image: HTMLImageElement): Promise<HTMLImageElement | ImageBitmap> {
  const canvas = document.createElement('canvas')
  const w = image.naturalWidth
  const h = image.naturalHeight
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  const { data } = ctx.getImageData(0, 0, w, h)

  // 找上下左右边界
  let top = 0, bottom = h - 1, left = 0, right = w - 1

  // 上
  outer_top: for (; top < h; top++) {
    for (let x = 0; x < w; x++) {
      if (data[(top * w + x) * 4 + 3] !== 0) break outer_top
    }
  }
  // 下
  outer_bottom: for (; bottom > top; bottom--) {
    for (let x = 0; x < w; x++) {
      if (data[(bottom * w + x) * 4 + 3] !== 0) break outer_bottom
    }
  }
  // 左
  outer_left: for (; left < w; left++) {
    for (let y = top; y <= bottom; y++) {
      if (data[(y * w + left) * 4 + 3] !== 0) break outer_left
    }
  }
  // 右
  outer_right: for (; right > left; right--) {
    for (let y = top; y <= bottom; y++) {
      if (data[(y * w + right) * 4 + 3] !== 0) break outer_right
    }
  }

  // 无需裁剪
  if (top === 0 && bottom === h - 1 && left === 0 && right === w - 1) {
    return Promise.resolve(image)
  }

  // 全透明
  if (top > bottom || left > right) {
    return Promise.resolve(image)
  }

  const tw = right - left + 1
  const th = bottom - top + 1
  const trimCanvas = document.createElement('canvas')
  trimCanvas.width = tw
  trimCanvas.height = th
  const tCtx = trimCanvas.getContext('2d')!
  tCtx.drawImage(image, left, top, tw, th, 0, 0, tw, th)

  return createImageBitmap(trimCanvas)
}
