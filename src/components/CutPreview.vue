<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useAppStore } from '../composables/useAppStore'
import { getCheckerPattern } from '../utils/canvasPattern'
import { getImageSize } from '../utils/sliceAlgorithm'
import { SLICE9_PADDING } from '../utils/imageExport'

const store = useAppStore()
const item = computed(() => store.currentItem.value)
const sliceRegion = computed(() => store.currentRegion.value)
const dark = computed(() => store.isDark.value)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
let offscreenCanvas: HTMLCanvasElement | null = null

function draw() {
  const canvas = canvasRef.value
  const container = containerRef.value
  const currentImg = item.value
  const region = sliceRegion.value
  if (!canvas || !container || !currentImg || !region) return

  const dpr = window.devicePixelRatio || 1
  const cw = container.clientWidth
  const ch = container.clientHeight
  canvas.width = cw * dpr
  canvas.height = ch * dpr
  canvas.style.width = cw + 'px'
  canvas.style.height = ch + 'px'

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, cw, ch)

  const img = currentImg.image
  const { left, right, top, bottom } = region

  const leftW = left + 1
  const rightW = getImageSize(img).width - right
  const topH = top + 1
  const bottomH = getImageSize(img).height - bottom

  const outW = leftW + rightW + SLICE9_PADDING * 2
  const outH = topH + bottomH + SLICE9_PADDING * 2

  const scale = Math.min((cw - 20) / outW, (ch - 32) / outH)
  const ox = (cw - outW * scale) / 2
  const oy = (ch - outH * scale) / 2 + 6

  // 棋盘格
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, outW * scale, outH * scale)
  ctx.clip()
  ctx.fillStyle = getCheckerPattern(ctx, dark.value)
  ctx.fillRect(ox, oy, outW * scale, outH * scale)
  ctx.restore()

  // 在离屏 canvas 以 1:1 绘制四角，避免缩放产生亚像素接缝
  if (!offscreenCanvas) offscreenCanvas = document.createElement('canvas')
  offscreenCanvas.width = outW
  offscreenCanvas.height = outH
  const offCtx = offscreenCanvas.getContext('2d')
  if (!offCtx) return
  offCtx.drawImage(img, 0, 0, leftW, topH, SLICE9_PADDING, SLICE9_PADDING, leftW, topH)
  offCtx.drawImage(img, right, 0, rightW, topH, leftW + SLICE9_PADDING, SLICE9_PADDING, rightW, topH)
  offCtx.drawImage(img, 0, bottom, leftW, bottomH, SLICE9_PADDING, topH + SLICE9_PADDING, leftW, bottomH)
  offCtx.drawImage(img, right, bottom, rightW, bottomH, leftW + SLICE9_PADDING, topH + SLICE9_PADDING, rightW, bottomH)

  // 一次性缩放绘制到显示 canvas
  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(scale, scale)
  ctx.imageSmoothingEnabled = scale < 1
  ctx.drawImage(offscreenCanvas, 0, 0)
  ctx.restore()

  // 边框
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 1
  ctx.strokeRect(ox, oy, outW * scale, outH * scale)

  // 尺寸标签
  ctx.fillStyle = '#9ca3af'
  ctx.font = '10px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`${outW} x ${outH}`, cw / 2, oy - 4)
}

watch([
  () => item.value?.id,
  () => sliceRegion.value?.left, () => sliceRegion.value?.right,
  () => sliceRegion.value?.top, () => sliceRegion.value?.bottom,
  () => dark.value,
], () => {
  nextTick(draw)
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeObserver = new ResizeObserver(() => draw())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (offscreenCanvas) {
    offscreenCanvas.width = 0
    offscreenCanvas.height = 0
    offscreenCanvas = null
  }
})
</script>

<template>
  <div class="flex flex-col h-full bg-white dark:bg-[#1e1e1e]">
    <div ref="containerRef" class="flex-1 min-h-0 relative bg-gray-50 dark:bg-[#181818]">
      <canvas v-if="item" ref="canvasRef" class="absolute inset-0" />
      <div v-else class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-xs">裁切预览</div>
    </div>
  </div>
</template>
