import type { SliceRegion } from '../types'

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

  // Find longest run of similar columns
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

  // Find longest run of similar rows
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

export function getImageDataFromImage(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}
