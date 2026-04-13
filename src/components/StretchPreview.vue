<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useAppStore } from '../composables/useAppStore'
import { getCheckerPattern } from '../utils/canvasPattern'
import { getImageSize } from '../utils/sliceAlgorithm'

const store = useAppStore()
const item = computed(() => store.currentItem.value)
const sliceRegion = computed(() => store.currentRegion.value)
const dark = computed(() => store.isDark.value)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const previewWidth = ref(300)
const previewHeight = ref(200)
const viewScale = ref(1)
let offscreenCanvas: HTMLCanvasElement | null = null

// 边缘拖拽状态
type EdgeTarget = 'right' | 'bottom' | 'corner' | null
const edgeDragging = ref<EdgeTarget>(null)
const edgeHovering = ref<EdgeTarget>(null)
let edgeDragStart = { x: 0, y: 0, w: 0, h: 0 }

const EDGE_HIT = 6

// 计算显示区域
function getDisplayBounds() {
  const container = containerRef.value
  const currentImg = item.value
  const region = sliceRegion.value
  if (!container || !currentImg || !region) return null

  const img = currentImg.image
  const { left, right, top, bottom } = region
  const pw = previewWidth.value
  const ph = previewHeight.value

  const leftW = left + 1
  const rightW = getImageSize(img).width - right
  const topH = top + 1
  const bottomH = getImageSize(img).height - bottom

  const centerDW = Math.max(0, pw - leftW - rightW)
  const centerDH = Math.max(0, ph - topH - bottomH)
  const actualW = leftW + centerDW + rightW
  const actualH = topH + centerDH + bottomH

  const cw = container.clientWidth
  const ch = container.clientHeight
  const scale = viewScale.value

  const ox = (cw - actualW * scale) / 2
  const oy = (ch - actualH * scale) / 2 + 8

  const x0 = Math.round(ox)
  const y0 = Math.round(oy)
  const x3 = Math.round(ox + actualW * scale)
  const y3 = Math.round(oy + actualH * scale)

  return { x0, y0, x3, y3, scale, actualW, actualH, leftW, rightW, topH, bottomH, centerDW, centerDH }
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

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, cw, ch)

  const bounds = getDisplayBounds()
  if (!bounds) return

  const img = currentImg.image
  const { left, right, top, bottom } = region
  const { x0, y0, x3, y3, scale, leftW, rightW, topH, bottomH, centerDW, centerDH } = bounds

  const centerSW = Math.max(0, right - left - 1)
  const centerSH = Math.max(0, bottom - top - 1)
  const srcX = centerSW > 0 ? left + 1 : left
  const srcW = centerSW > 0 ? centerSW : 1
  const srcY = centerSH > 0 ? top + 1 : top
  const srcH = centerSH > 0 ? centerSH : 1

  // 棋盘格
  ctx.save()
  ctx.beginPath()
  ctx.rect(x0, y0, x3 - x0, y3 - y0)
  ctx.clip()
  ctx.fillStyle = getCheckerPattern(ctx, dark.value)
  ctx.fillRect(x0, y0, x3 - x0, y3 - y0)
  ctx.restore()

  // 在离屏 canvas 以 1:1 绘制九宫格，避免缩放产生亚像素接缝
  if (!offscreenCanvas) offscreenCanvas = document.createElement('canvas')
  offscreenCanvas.width = bounds.actualW
  offscreenCanvas.height = bounds.actualH
  const offCtx = offscreenCanvas.getContext('2d')
  if (!offCtx) return

  const oLeftW = leftW
  const oRightX = leftW + centerDW
  const oTopH = topH
  const oBottomY = topH + centerDH

  // 四角
  offCtx.drawImage(img, 0, 0, leftW, topH, 0, 0, oLeftW, oTopH)
  offCtx.drawImage(img, right, 0, rightW, topH, oRightX, 0, rightW, oTopH)
  offCtx.drawImage(img, 0, bottom, leftW, bottomH, 0, oBottomY, oLeftW, bottomH)
  offCtx.drawImage(img, right, bottom, rightW, bottomH, oRightX, oBottomY, rightW, bottomH)
  // 水平边
  if (centerDW > 0) {
    offCtx.drawImage(img, srcX, 0, srcW, topH, oLeftW, 0, centerDW, oTopH)
    offCtx.drawImage(img, srcX, bottom, srcW, bottomH, oLeftW, oBottomY, centerDW, bottomH)
  }
  // 垂直边
  if (centerDH > 0) {
    offCtx.drawImage(img, 0, srcY, leftW, srcH, 0, oTopH, oLeftW, centerDH)
    offCtx.drawImage(img, right, srcY, rightW, srcH, oRightX, oTopH, rightW, centerDH)
  }
  // 中心
  if (centerDW > 0 && centerDH > 0) {
    offCtx.drawImage(img, srcX, srcY, srcW, srcH, oLeftW, oTopH, centerDW, centerDH)
  }

  // 一次性缩放绘制到显示 canvas
  ctx.imageSmoothingEnabled = scale < 1
  ctx.drawImage(offscreenCanvas, x0, y0, x3 - x0, y3 - y0)

  // 右侧边缘手柄
  const isRightActive = edgeDragging.value === 'right' || edgeDragging.value === 'corner'
  const isRightHover = edgeHovering.value === 'right' || edgeHovering.value === 'corner'
  ctx.strokeStyle = isRightActive ? 'rgba(37,99,235,1)' : isRightHover ? 'rgba(59,130,246,0.8)' : 'rgba(59,130,246,0.4)'
  ctx.lineWidth = isRightActive || isRightHover ? 2.5 : 1.5
  ctx.beginPath(); ctx.moveTo(x3, y0); ctx.lineTo(x3, y3); ctx.stroke()

  // 底部边缘手柄
  const isBottomActive = edgeDragging.value === 'bottom' || edgeDragging.value === 'corner'
  const isBottomHover = edgeHovering.value === 'bottom' || edgeHovering.value === 'corner'
  ctx.strokeStyle = isBottomActive ? 'rgba(37,99,235,1)' : isBottomHover ? 'rgba(59,130,246,0.8)' : 'rgba(59,130,246,0.4)'
  ctx.lineWidth = isBottomActive || isBottomHover ? 2.5 : 1.5
  ctx.beginPath(); ctx.moveTo(x0, y3); ctx.lineTo(x3, y3); ctx.stroke()

  // 右下角三角形
  const isCornerActive = edgeDragging.value === 'corner'
  const isCornerHover = edgeHovering.value === 'corner'
  ctx.fillStyle = isCornerActive ? 'rgba(37,99,235,1)' : isCornerHover ? 'rgba(59,130,246,0.8)' : 'rgba(59,130,246,0.5)'
  ctx.beginPath()
  ctx.moveTo(x3, y3)
  ctx.lineTo(x3 - 10, y3)
  ctx.lineTo(x3, y3 - 10)
  ctx.closePath()
  ctx.fill()

  // 上方和左侧边框（细线，不可交互）
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x3, y0); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y3); ctx.stroke()

  // 尺寸标签
  ctx.fillStyle = '#9ca3af'
  ctx.font = '10px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`${previewWidth.value} x ${previewHeight.value}`, cw / 2, y0 - 4)
}

// 检测鼠标靠近哪条边
function detectEdge(mx: number, my: number): EdgeTarget {
  const bounds = getDisplayBounds()
  if (!bounds) return null
  const { x0, y0, x3, y3 } = bounds

  const nearRight = Math.abs(mx - x3) < EDGE_HIT && my >= y0 - EDGE_HIT && my <= y3 + EDGE_HIT
  const nearBottom = Math.abs(my - y3) < EDGE_HIT && mx >= x0 - EDGE_HIT && mx <= x3 + EDGE_HIT

  if (nearRight && nearBottom) return 'corner'
  if (nearRight) return 'right'
  if (nearBottom) return 'bottom'
  return null
}

function getCursorForEdge(target: EdgeTarget): string {
  if (target === 'right') return 'ew-resize'
  if (target === 'bottom') return 'ns-resize'
  if (target === 'corner') return 'nwse-resize'
  return 'default'
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const target = detectEdge(mx, my)
  if (target) {
    edgeDragging.value = target
    edgeDragStart = { x: e.clientX, y: e.clientY, w: previewWidth.value, h: previewHeight.value }
    e.preventDefault()
  }
}

function onMouseMove(e: MouseEvent) {
  if (edgeDragging.value) {
    const dx = e.clientX - edgeDragStart.x
    const dy = e.clientY - edgeDragStart.y
    const bounds = getDisplayBounds()
    if (!bounds) return
    // 居中布局下，actualW 增加 1 → 边缘只移动 scale/2，故需 ×2 补偿
    const pixelRatio = 2 / bounds.scale

    const currentImg = item.value
    const region = sliceRegion.value
    if (!currentImg || !region) return
    const leftW = region.left + 1
    const rightW = getImageSize(currentImg.image).width - region.right
    const topH = region.top + 1
    const bottomH = getImageSize(currentImg.image).height - region.bottom
    const minW = leftW + rightW
    const minH = topH + bottomH

    if (edgeDragging.value === 'right' || edgeDragging.value === 'corner') {
      previewWidth.value = Math.max(minW, Math.round(edgeDragStart.w + dx * pixelRatio))
    }
    if (edgeDragging.value === 'bottom' || edgeDragging.value === 'corner') {
      previewHeight.value = Math.max(minH, Math.round(edgeDragStart.h + dy * pixelRatio))
    }
  } else {
    // 悬停检测
    const canvas = canvasRef.value
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    edgeHovering.value = detectEdge(mx, my)
  }
}

function onMouseUp() {
  edgeDragging.value = null
}

const cursorStyle = computed(() => {
  if (edgeDragging.value) return getCursorForEdge(edgeDragging.value)
  if (edgeHovering.value) return getCursorForEdge(edgeHovering.value)
  return 'default'
})

// 切换图片时重置预览尺寸为裁切后尺寸
watch(() => item.value?.id, () => {
  const currentImg = item.value
  const region = sliceRegion.value
  if (currentImg && region) {
    const leftW = region.left + 1
    const rightW = getImageSize(currentImg.image).width - region.right
    const topH = region.top + 1
    const bottomH = getImageSize(currentImg.image).height - region.bottom
    const initW = leftW + rightW + 4
    const initH = topH + bottomH + 4
    previewWidth.value = initW
    previewHeight.value = initH
    // 大图缩放至面板约一半大小，留出拖拽空间
    const cw = containerRef.value?.clientWidth ?? 300
    const ch = containerRef.value?.clientHeight ?? 200
    const fitScale = Math.min((cw * 0.5) / initW, (ch * 0.5) / initH)
    viewScale.value = fitScale < 1 ? fitScale : 1
  }
})

watch([
  () => item.value?.id,
  () => sliceRegion.value?.left, () => sliceRegion.value?.right,
  () => sliceRegion.value?.top, () => sliceRegion.value?.bottom,
  previewWidth, previewHeight, () => dark.value, edgeHovering, edgeDragging,
], () => {
  nextTick(draw)
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeObserver = new ResizeObserver(() => draw())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  if (offscreenCanvas) {
    offscreenCanvas.width = 0
    offscreenCanvas.height = 0
    offscreenCanvas = null
  }
})
</script>

<template>
  <div class="flex flex-col h-full bg-white dark:bg-[#1e1e1e]">
    <div
      ref="containerRef"
      class="flex-1 min-h-0 relative bg-gray-50 dark:bg-[#181818]"
      @mousedown="onMouseDown"
    >
      <canvas
        v-if="item"
        ref="canvasRef"
        class="absolute inset-0"
        :style="{ cursor: cursorStyle }"
      />
      <div v-else class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-xs">拉伸预览</div>
    </div>
  </div>
</template>
