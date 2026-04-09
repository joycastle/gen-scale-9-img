<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useAppStore } from '../composables/useAppStore'
import { alphaBleeding } from '../utils/alphaBleeding'
import { getCheckerPattern } from '../utils/canvasPattern'
import { getImageSize } from '../utils/sliceAlgorithm'

const store = useAppStore()
const item = computed(() => store.currentItem.value)
const sliceRegion = computed(() => store.currentRegion.value)
const dark = computed(() => store.isDark.value)
const bleedingEnabled = computed(() => store.enableAlphaBleeding.value)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

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

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, cw, ch)

  const img = currentImg.image
  const { left, right, top, bottom } = region
  const PADDING = 2

  const leftW = left + 1
  const rightW = getImageSize(img).width - right
  const topH = top + 1
  const bottomH = getImageSize(img).height - bottom

  const outW = leftW + rightW + PADDING * 2
  const outH = topH + bottomH + PADDING * 2

  // 在离屏画布上构建裁切图像
  const offscreen = document.createElement('canvas')
  offscreen.width = outW
  offscreen.height = outH
  const offCtx = offscreen.getContext('2d')!

  // 绘制四角
  offCtx.drawImage(img, 0, 0, leftW, topH, PADDING, PADDING, leftW, topH)
  offCtx.drawImage(img, right, 0, rightW, topH, leftW + PADDING, PADDING, rightW, topH)
  offCtx.drawImage(img, 0, bottom, leftW, bottomH, PADDING, topH + PADDING, leftW, bottomH)
  offCtx.drawImage(img, right, bottom, rightW, bottomH, leftW + PADDING, topH + PADDING, rightW, bottomH)

  // 获取图像数据并执行 alpha bleeding
  let originalData = offCtx.getImageData(0, 0, outW, outH)
  if (bleedingEnabled.value) {
    originalData = alphaBleeding(originalData)
  }

  // 将所有 alpha 强制设为 255 以显示 bleeding 后的 RGB
  for (let i = 0; i < outW * outH; i++) {
    originalData.data[i * 4 + 3] = 255
  }
  offCtx.putImageData(originalData, 0, 0)

  // 缩放绘制到显示画布
  const scale = Math.min((cw - 20) / outW, (ch - 32) / outH)
  const ox = (cw - outW * scale) / 2
  const oy = (ch - outH * scale) / 2 + 6

  // 棋盘格背景
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, outW * scale, outH * scale)
  ctx.clip()
  ctx.fillStyle = getCheckerPattern(ctx, dark.value)
  ctx.fillRect(ox, oy, outW * scale, outH * scale)
  ctx.restore()

  // 绘制 bleeding 结果（alpha=1）
  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(scale, scale)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(offscreen, 0, 0)

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

watch([() => item.value?.id, () => sliceRegion.value, () => dark.value, () => bleedingEnabled.value], () => {
  nextTick(draw)
}, { deep: true })

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeObserver = new ResizeObserver(() => draw())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="flex flex-col h-full bg-white dark:bg-[#1e1e1e]">
    <div ref="containerRef" class="flex-1 min-h-0 relative bg-gray-50 dark:bg-[#181818]">
      <canvas v-if="item" ref="canvasRef" class="absolute inset-0" />
      <div v-else class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-xs">Alpha Bleeding 预览</div>
    </div>
  </div>
</template>
