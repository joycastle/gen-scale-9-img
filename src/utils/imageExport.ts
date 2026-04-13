import type { SliceRegion } from '../types'
import { getImageSize } from './sliceAlgorithm'
import { alphaBleeding } from './alphaBleeding'

/** .9.png 四周透明边距（像素） */
export const SLICE9_PADDING = 2

export function exportSlice9(
  image: HTMLImageElement | ImageBitmap,
  region: SliceRegion,
  enableAlphaBleeding: boolean,
): Promise<Blob> {
  const { left, right, top, bottom } = region
  const { width: imgW, height: imgH } = getImageSize(image)

  // 四角尺寸
  const leftW = left + 1
  const rightW = imgW - right
  const topH = top + 1
  const bottomH = imgH - bottom

  const outW = leftW + rightW + SLICE9_PADDING * 2
  const outH = topH + bottomH + SLICE9_PADDING * 2

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Failed to get 2D context'))

  // 左上角
  ctx.drawImage(image, 0, 0, leftW, topH, SLICE9_PADDING, SLICE9_PADDING, leftW, topH)
  // 右上角
  ctx.drawImage(image, right, 0, rightW, topH, leftW + SLICE9_PADDING, SLICE9_PADDING, rightW, topH)
  // 左下角
  ctx.drawImage(image, 0, bottom, leftW, bottomH, SLICE9_PADDING, topH + SLICE9_PADDING, leftW, bottomH)
  // 右下角
  ctx.drawImage(image, right, bottom, rightW, bottomH, leftW + SLICE9_PADDING, topH + SLICE9_PADDING, rightW, bottomH)

  if (enableAlphaBleeding) {
    const resultData = ctx.getImageData(0, 0, outW, outH)
    const bledData = alphaBleeding(resultData)
    ctx.putImageData(bledData, 0, 0)
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = 0
      canvas.height = 0
      if (blob) resolve(blob)
      else reject(new Error('Failed to export PNG'))
    }, 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  requestAnimationFrame(() => URL.revokeObjectURL(url))
}
