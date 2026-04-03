<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed } from 'vue'
import { useAppStore } from '../composables/useAppStore'

const store = useAppStore()
const item = computed(() => store.currentItem.value)
const sliceRegion = computed(() => store.currentRegion.value)
const dark = computed(() => store.isDark.value)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

let checkerPattern: CanvasPattern | null = null
let checkerDark = false
function getChecker(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (checkerPattern && checkerDark === dark.value) return checkerPattern
  checkerDark = dark.value
  const pc = document.createElement('canvas')
  pc.width = 16; pc.height = 16
  const pctx = pc.getContext('2d')!
  if (dark.value) {
    pctx.fillStyle = '#1f2937'; pctx.fillRect(0, 0, 16, 16)
    pctx.fillStyle = '#374151'; pctx.fillRect(0, 0, 8, 8); pctx.fillRect(8, 8, 8, 8)
  } else {
    pctx.fillStyle = '#fafafa'; pctx.fillRect(0, 0, 16, 16)
    pctx.fillStyle = '#f0f0f0'; pctx.fillRect(0, 0, 8, 8); pctx.fillRect(8, 8, 8, 8)
  }
  checkerPattern = ctx.createPattern(pc, 'repeat')!
  return checkerPattern
}

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
  const rightW = img.naturalWidth - right
  const topH = top + 1
  const bottomH = img.naturalHeight - bottom

  const outW = leftW + rightW + PADDING * 2
  const outH = topH + bottomH + PADDING * 2

  const scale = Math.min((cw - 20) / outW, (ch - 32) / outH)
  const ox = (cw - outW * scale) / 2
  const oy = (ch - outH * scale) / 2 + 6

  // 棋盘格
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, outW * scale, outH * scale)
  ctx.clip()
  ctx.fillStyle = getChecker(ctx)
  ctx.fillRect(ox, oy, outW * scale, outH * scale)
  ctx.restore()

  // 绘制四角
  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, leftW, topH, PADDING, PADDING, leftW, topH)
  ctx.drawImage(img, right, 0, rightW, topH, leftW + PADDING, PADDING, rightW, topH)
  ctx.drawImage(img, 0, bottom, leftW, bottomH, PADDING, topH + PADDING, leftW, bottomH)
  ctx.drawImage(img, right, bottom, rightW, bottomH, leftW + PADDING, topH + PADDING, rightW, bottomH)
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

watch([() => item.value?.id, () => sliceRegion.value, () => dark.value], () => {
  nextTick(draw)
}, { deep: true })

onMounted(() => {
  const obs = new ResizeObserver(() => draw())
  if (containerRef.value) obs.observe(containerRef.value)
})
</script>

<template>
  <div class="flex flex-col h-full bg-white dark:bg-gray-800">
    <div ref="containerRef" class="flex-1 min-h-0 relative bg-gray-50 dark:bg-gray-900">
      <canvas v-if="item" ref="canvasRef" class="absolute inset-0" />
      <div v-else class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-xs">裁切预览</div>
    </div>
  </div>
</template>
