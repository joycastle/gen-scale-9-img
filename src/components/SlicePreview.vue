<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { SliceRegion, ImageItem } from '../types'

const props = defineProps<{
  item: ImageItem | null
  sliceRegion: SliceRegion | null
  dark: boolean
}>()

// --- Cut result preview ---
const cutCanvasRef = ref<HTMLCanvasElement | null>(null)
const cutContainerRef = ref<HTMLDivElement | null>(null)

// --- Stretch preview ---
const stretchCanvasRef = ref<HTMLCanvasElement | null>(null)
const stretchContainerRef = ref<HTMLDivElement | null>(null)
const previewWidth = ref(300)
const previewHeight = ref(200)
const stretchZoom = ref(1)

// Corner drag state
const cornerDragging = ref<string | null>(null)
let cornerDragStart = { x: 0, y: 0, w: 0, h: 0 }

// Vertical split state
const savedRatio = localStorage.getItem('slice9-split-v')
const splitRatio = ref(savedRatio ? parseFloat(savedRatio) : 0.5)
const isSplitDragging = ref(false)
let splitDragStartY = 0
let splitDragStartRatio = 0
const wrapperRef = ref<HTMLDivElement | null>(null)
const MIN_PANEL_H = 100

// Checkerboard pattern
let checkerPattern: CanvasPattern | null = null
let checkerDark = false
function getChecker(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (checkerPattern && checkerDark === props.dark) return checkerPattern
  checkerDark = props.dark
  const pc = document.createElement('canvas')
  pc.width = 16; pc.height = 16
  const pctx = pc.getContext('2d')!
  if (props.dark) {
    pctx.fillStyle = '#1f2937'; pctx.fillRect(0, 0, 16, 16)
    pctx.fillStyle = '#374151'; pctx.fillRect(0, 0, 8, 8); pctx.fillRect(8, 8, 8, 8)
  } else {
    pctx.fillStyle = '#fafafa'; pctx.fillRect(0, 0, 16, 16)
    pctx.fillStyle = '#f0f0f0'; pctx.fillRect(0, 0, 8, 8); pctx.fillRect(8, 8, 8, 8)
  }
  checkerPattern = ctx.createPattern(pc, 'repeat')!
  return checkerPattern
}

// ===== Cut Result Preview =====
function drawCutPreview() {
  const canvas = cutCanvasRef.value
  const container = cutContainerRef.value
  const item = props.item
  const region = props.sliceRegion
  if (!canvas || !container || !item || !region) return

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

  const img = item.image
  const { left, right, top, bottom } = region
  const PADDING = 2

  const leftW = left + 1
  const rightW = img.naturalWidth - right
  const topH = top + 1
  const bottomH = img.naturalHeight - bottom

  const outW = leftW + rightW + PADDING * 2
  const outH = topH + bottomH + PADDING * 2

  const scale = Math.min((cw - 16) / outW, (ch - 28) / outH, 2)
  const ox = (cw - outW * scale) / 2
  const oy = (ch - outH * scale) / 2 + 8

  // Checkerboard - clipped to exact bounds
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, outW * scale, outH * scale)
  ctx.clip()
  ctx.fillStyle = getChecker(ctx)
  ctx.fillRect(ox, oy, outW * scale, outH * scale)
  ctx.restore()

  // Draw 4 corners
  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, leftW, topH, PADDING, PADDING, leftW, topH)
  ctx.drawImage(img, right, 0, rightW, topH, leftW + PADDING, PADDING, rightW, topH)
  ctx.drawImage(img, 0, bottom, leftW, bottomH, PADDING, topH + PADDING, leftW, bottomH)
  ctx.drawImage(img, right, bottom, rightW, bottomH, leftW + PADDING, topH + PADDING, rightW, bottomH)
  ctx.restore()

  // Border
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 1
  ctx.strokeRect(ox, oy, outW * scale, outH * scale)

  // Size label
  ctx.fillStyle = '#9ca3af'
  ctx.font = '10px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`${outW} x ${outH}`, cw / 2, oy - 4)
}

// ===== Stretch Effect Preview =====
function drawStretchPreview() {
  const canvas = stretchCanvasRef.value
  const container = stretchContainerRef.value
  const item = props.item
  const region = props.sliceRegion
  if (!canvas || !container || !item || !region) return

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

  const img = item.image
  const { left, right, top, bottom } = region
  const pw = previewWidth.value
  const ph = previewHeight.value

  const leftW = left + 1
  const rightW = img.naturalWidth - right
  const topH = top + 1
  const bottomH = img.naturalHeight - bottom
  const centerSW = Math.max(0, right - left - 1)
  const centerSH = Math.max(0, bottom - top - 1)

  const centerDW = Math.max(0, pw - leftW - rightW)
  const centerDH = Math.max(0, ph - topH - bottomH)
  const actualW = leftW + centerDW + rightW
  const actualH = topH + centerDH + bottomH

  const fitScale = Math.min((cw - 32) / actualW, (ch - 44) / actualH)
  const scale = fitScale * stretchZoom.value
  const ox = (cw - actualW * scale) / 2
  const oy = (ch - actualH * scale) / 2 + 8

  // Pixel-rounded grid positions to avoid sub-pixel gaps
  const x0 = Math.round(ox)
  const x1 = Math.round(ox + leftW * scale)
  const x2 = Math.round(ox + (leftW + centerDW) * scale)
  const x3 = Math.round(ox + actualW * scale)
  const y0 = Math.round(oy)
  const y1 = Math.round(oy + topH * scale)
  const y2 = Math.round(oy + (topH + centerDH) * scale)
  const y3 = Math.round(oy + actualH * scale)

  // Checkerboard - clipped to exact bounds
  ctx.save()
  ctx.beginPath()
  ctx.rect(x0, y0, x3 - x0, y3 - y0)
  ctx.clip()
  ctx.fillStyle = getChecker(ctx)
  ctx.fillRect(x0, y0, x3 - x0, y3 - y0)
  ctx.restore()

  // Draw 9 slices using pixel-rounded coordinates (no ctx.scale)
  // Source stretch regions: fallback to 1px boundary when lines overlap
  const srcX = centerSW > 0 ? left + 1 : left
  const srcW = centerSW > 0 ? centerSW : 1
  const srcY = centerSH > 0 ? top + 1 : top
  const srcH = centerSH > 0 ? centerSH : 1

  // 4 corners (always drawn)
  ctx.drawImage(img, 0, 0, leftW, topH, x0, y0, x1 - x0, y1 - y0)
  ctx.drawImage(img, right, 0, rightW, topH, x2, y0, x3 - x2, y1 - y0)
  ctx.drawImage(img, 0, bottom, leftW, bottomH, x0, y2, x1 - x0, y3 - y2)
  ctx.drawImage(img, right, bottom, rightW, bottomH, x2, y2, x3 - x2, y3 - y2)

  // Horizontal edges
  if (x2 - x1 > 0) {
    ctx.drawImage(img, srcX, 0, srcW, topH, x1, y0, x2 - x1, y1 - y0)
    ctx.drawImage(img, srcX, bottom, srcW, bottomH, x1, y2, x2 - x1, y3 - y2)
  }
  // Vertical edges
  if (y2 - y1 > 0) {
    ctx.drawImage(img, 0, srcY, leftW, srcH, x0, y1, x1 - x0, y2 - y1)
    ctx.drawImage(img, right, srcY, rightW, srcH, x2, y1, x3 - x2, y2 - y1)
  }
  // Center
  if (x2 - x1 > 0 && y2 - y1 > 0) {
    ctx.drawImage(img, srcX, srcY, srcW, srcH, x1, y1, x2 - x1, y2 - y1)
  }

  // Border
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 1
  ctx.strokeRect(x0, y0, x3 - x0, y3 - y0)

  // Corner drag handles
  const handleSize = 8
  const corners = [
    { x: x0, y: y0, name: 'tl' },
    { x: x3, y: y0, name: 'tr' },
    { x: x0, y: y3, name: 'bl' },
    { x: x3, y: y3, name: 'br' },
  ]
  for (const c of corners) {
    ctx.fillStyle = 'rgba(59, 130, 246, 0.8)'
    ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize)
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 1
    ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize)
  }

  // Size label
  ctx.fillStyle = '#9ca3af'
  ctx.font = '10px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`${pw} x ${ph}`, cw / 2, oy - 4)
}

// Corner drag handlers
function onStretchMouseDown(e: MouseEvent) {
  const canvas = stretchCanvasRef.value
  const container = stretchContainerRef.value
  const item = props.item
  const region = props.sliceRegion
  if (!canvas || !container || !item || !region) return

  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  const img = item.image
  const leftW = region.left + 1
  const rightW = img.naturalWidth - region.right
  const topH = region.top + 1
  const bottomH = img.naturalHeight - region.bottom
  const pw = previewWidth.value
  const ph = previewHeight.value
  const centerDW = Math.max(0, pw - leftW - rightW)
  const centerDH = Math.max(0, ph - topH - bottomH)
  const actualW = leftW + centerDW + rightW
  const actualH = topH + centerDH + bottomH

  const cw = container.clientWidth
  const ch = container.clientHeight
  const fitScale = Math.min((cw - 32) / actualW, (ch - 44) / actualH)
  const scale = fitScale * stretchZoom.value
  const ox = (cw - actualW * scale) / 2
  const oy = (ch - actualH * scale) / 2 + 8

  const x0 = Math.round(ox)
  const y0 = Math.round(oy)
  const x3 = Math.round(ox + actualW * scale)
  const y3 = Math.round(oy + actualH * scale)

  const corners = [
    { x: x0, y: y0, name: 'tl' },
    { x: x3, y: y0, name: 'tr' },
    { x: x0, y: y3, name: 'bl' },
    { x: x3, y: y3, name: 'br' },
  ]

  for (const c of corners) {
    if (Math.abs(mx - c.x) < 12 && Math.abs(my - c.y) < 12) {
      cornerDragging.value = c.name
      cornerDragStart = { x: e.clientX, y: e.clientY, w: pw, h: ph }
      e.preventDefault()
      return
    }
  }
}

function onStretchMouseMove(e: MouseEvent) {
  if (!cornerDragging.value || !props.item || !props.sliceRegion) return

  const region = props.sliceRegion
  const img = props.item.image
  const leftW = region.left + 1
  const rightW = img.naturalWidth - region.right
  const topH = region.top + 1
  const bottomH = img.naturalHeight - region.bottom
  const minW = leftW + rightW + 2
  const minH = topH + bottomH + 2

  const dx = e.clientX - cornerDragStart.x
  const dy = e.clientY - cornerDragStart.y
  const corner = cornerDragging.value

  let newW = cornerDragStart.w
  let newH = cornerDragStart.h

  if (corner === 'br' || corner === 'tr') newW = cornerDragStart.w + dx
  if (corner === 'bl' || corner === 'tl') newW = cornerDragStart.w - dx
  if (corner === 'br' || corner === 'bl') newH = cornerDragStart.h + dy
  if (corner === 'tr' || corner === 'tl') newH = cornerDragStart.h - dy

  previewWidth.value = Math.max(minW, Math.round(newW))
  previewHeight.value = Math.max(minH, Math.round(newH))
}

function onStretchMouseUp() {
  cornerDragging.value = null
}

// Vertical split drag
function onSplitMouseDown(e: MouseEvent) {
  isSplitDragging.value = true
  splitDragStartY = e.clientY
  splitDragStartRatio = splitRatio.value
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

function onSplitMouseMove(e: MouseEvent) {
  if (!isSplitDragging.value || !wrapperRef.value) return
  const totalH = wrapperRef.value.clientHeight
  const dy = e.clientY - splitDragStartY
  const delta = dy / totalH
  let newRatio = splitDragStartRatio + delta
  // Enforce min heights
  const minRatio = MIN_PANEL_H / totalH
  const maxRatio = 1 - MIN_PANEL_H / totalH
  newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio))
  splitRatio.value = newRatio
}

function onSplitMouseUp() {
  if (!isSplitDragging.value) return
  isSplitDragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  localStorage.setItem('slice9-split-v', String(splitRatio.value))
}

// Stretch preview zoom (scroll wheel, centered)
function onStretchWheel(e: WheelEvent) {
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
  stretchZoom.value = Math.min(10, Math.max(0.2, stretchZoom.value * factor))
}

// Redraw on changes
watch([() => props.item?.id, () => props.sliceRegion, previewWidth, previewHeight, stretchZoom, () => props.dark], () => {
  nextTick(() => { drawCutPreview(); drawStretchPreview() })
}, { deep: true })

onMounted(() => {
  const obs1 = new ResizeObserver(() => drawCutPreview())
  const obs2 = new ResizeObserver(() => drawStretchPreview())
  if (cutContainerRef.value) obs1.observe(cutContainerRef.value)
  if (stretchContainerRef.value) obs2.observe(stretchContainerRef.value)

  window.addEventListener('mousemove', onStretchMouseMove)
  window.addEventListener('mouseup', onStretchMouseUp)
  window.addEventListener('mousemove', onSplitMouseMove)
  window.addEventListener('mouseup', onSplitMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onStretchMouseMove)
  window.removeEventListener('mouseup', onStretchMouseUp)
  window.removeEventListener('mousemove', onSplitMouseMove)
  window.removeEventListener('mouseup', onSplitMouseUp)
})
</script>

<template>
  <div ref="wrapperRef" class="flex flex-col h-full bg-white dark:bg-gray-800">
    <!-- Cut result preview -->
    <div class="min-h-0 flex flex-col" :style="{ flex: `${splitRatio} 1 0%` }">
      <div class="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 flex-shrink-0">
        <svg class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
        </svg>
        <span class="text-xs font-medium text-gray-600 dark:text-gray-300">裁切结果</span>
      </div>
      <div ref="cutContainerRef" class="flex-1 min-h-0 relative bg-gray-50 dark:bg-gray-900">
        <canvas v-if="item" ref="cutCanvasRef" class="absolute inset-0" />
        <div v-else class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-xs">裁切预览</div>
      </div>
    </div>

    <!-- Horizontal split divider -->
    <div
      class="h-1.5 flex-shrink-0 bg-gray-200 dark:bg-gray-600 hover:bg-blue-400 dark:hover:bg-blue-500 active:bg-blue-500 cursor-row-resize transition-colors relative"
      @mousedown="onSplitMouseDown"
    >
      <div class="absolute -top-1 -bottom-1 inset-x-0" />
    </div>

    <!-- Stretch effect preview -->
    <div class="min-h-0 flex flex-col" :style="{ flex: `${1 - splitRatio} 1 0%` }">
      <div class="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 flex-shrink-0">
        <svg class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
        <span class="text-xs font-medium text-gray-600 dark:text-gray-300">拉伸效果</span>
        <span class="text-xs text-gray-400 dark:text-gray-500 font-mono">{{ previewWidth }} x {{ previewHeight }}</span>
        <span v-if="stretchZoom !== 1" class="text-xs text-gray-400 dark:text-gray-500 font-mono">{{ Math.round(stretchZoom * 100) }}%</span>
      </div>
      <div
        ref="stretchContainerRef"
        class="flex-1 min-h-0 relative bg-gray-50 dark:bg-gray-900"
        @mousedown="onStretchMouseDown"
        @wheel.prevent="onStretchWheel"
      >
        <canvas v-if="item" ref="stretchCanvasRef" class="absolute inset-0" />
        <div v-else class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-xs">拉伸预览</div>
      </div>
    </div>
  </div>
</template>
