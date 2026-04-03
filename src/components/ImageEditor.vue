<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import type { SliceRegion } from '../types'
import { useDragInteraction } from '../composables/useDragInteraction'
import { useAppStore } from '../composables/useAppStore'

const store = useAppStore()
const item = computed(() => store.currentItem.value)
const sliceRegion = computed(() => store.currentRegion.value)
const dark = computed(() => store.isDark.value)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// 缩放与平移状态
const zoomLevel = ref(1)
const panOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
let panStart = { x: 0, y: 0 }
let panStartOffset = { x: 0, y: 0 }

// 标尺尺寸
const RULER_SIZE = 24

// 编辑器控件
const localTolerance = ref(0)
const borderTop = ref(0)
const borderBottom = ref(0)
const borderLeft = ref(0)
const borderRight = ref(0)

watch(() => item.value?.id, () => {
  if (item.value) {
    localTolerance.value = item.value.tolerance
    fitToView()
  }
})

watch(() => sliceRegion.value, (r) => {
  if (r && item.value) {
    const img = item.value.image
    borderTop.value = r.top
    borderBottom.value = img.naturalHeight - r.bottom
    borderLeft.value = r.left
    borderRight.value = img.naturalWidth - r.right
  }
}, { immediate: true, deep: true })

function applyBorderInput() {
  if (!item.value) return
  const img = item.value.image
  const region: SliceRegion = {
    left: Math.max(0, borderLeft.value),
    right: Math.min(img.naturalWidth - 1, img.naturalWidth - borderRight.value),
    top: Math.max(0, borderTop.value),
    bottom: Math.min(img.naturalHeight - 1, img.naturalHeight - borderBottom.value),
  }
  if (region.right < region.left) region.right = region.left
  if (region.bottom < region.top) region.bottom = region.top
  store.updateRegion(region)
}

function onToleranceChange() {
  if (!item.value) return
  item.value.tolerance = localTolerance.value
  store.recompute(localTolerance.value)
}

function onRecompute() {
  store.recompute(localTolerance.value)
}

// 计算画布到图片的坐标变换
function getScale() { return zoomLevel.value }
function getOffset() {
  const container = containerRef.value
  if (!container) return { x: RULER_SIZE, y: RULER_SIZE }
  return {
    x: panOffset.value.x + RULER_SIZE,
    y: panOffset.value.y + RULER_SIZE,
  }
}

function getImageSize() {
  if (!item.value) return null
  return { width: item.value.image.naturalWidth, height: item.value.image.naturalHeight }
}

const drag = useDragInteraction(
  () => canvasRef.value,
  () => sliceRegion.value,
  getImageSize,
  getScale,
  getOffset,
  (updated) => store.updateRegion(updated),
)

// 滚轮缩放
function onWheel(e: WheelEvent) {
  if (!item.value) return
  e.preventDefault()
  const rect = containerRef.value!.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const oldZoom = zoomLevel.value
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
  const newZoom = Math.min(20, Math.max(0.1, oldZoom * factor))

  // 以鼠标位置为中心缩放
  const o = getOffset()
  panOffset.value = {
    x: mouseX - (mouseX - o.x) * (newZoom / oldZoom) - RULER_SIZE,
    y: mouseY - (mouseY - o.y) * (newZoom / oldZoom) - RULER_SIZE,
  }
  zoomLevel.value = newZoom
  nextTick(drawCanvas)
}

// 适应视图
function fitToView() {
  const container = containerRef.value
  const currentImg = item.value
  if (!container || !currentImg) return
  const cw = container.clientWidth - RULER_SIZE - 20
  const ch = container.clientHeight - RULER_SIZE - 20
  const iw = currentImg.image.naturalWidth
  const ih = currentImg.image.naturalHeight
  const scale = Math.min(cw / iw, ch / ih, 4)
  zoomLevel.value = scale
  panOffset.value = {
    x: (cw - iw * scale) / 2 + 10,
    y: (ch - ih * scale) / 2 + 10,
  }
  nextTick(drawCanvas)
}

// 棋盘格图案（缓存，适配暗色模式）
let checkerPattern: CanvasPattern | null = null
let checkerDark = false
function getCheckerPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
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

// 绘制画布
function drawCanvas() {
  const canvas = canvasRef.value
  const container = containerRef.value
  const currentImg = item.value
  const region = sliceRegion.value
  if (!canvas || !container || !currentImg) return

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

  // 背景
  ctx.fillStyle = dark.value ? '#111827' : '#f3f4f6'
  ctx.fillRect(0, 0, cw, ch)

  const s = zoomLevel.value
  const o = getOffset()
  const iw = currentImg.image.naturalWidth
  const ih = currentImg.image.naturalHeight

  // --- 绘制图片区域 ---
  ctx.save()
  ctx.beginPath()
  ctx.rect(RULER_SIZE, RULER_SIZE, cw - RULER_SIZE, ch - RULER_SIZE)
  ctx.clip()

  // 图片下方的棋盘格背景 - 裁剪到图片边界
  ctx.save()
  ctx.beginPath()
  ctx.rect(o.x, o.y, iw * s, ih * s)
  ctx.clip()
  ctx.fillStyle = getCheckerPattern(ctx)
  ctx.fillRect(o.x, o.y, iw * s, ih * s)
  ctx.restore()

  // 图片
  ctx.save()
  ctx.translate(o.x, o.y)
  ctx.scale(s, s)
  ctx.imageSmoothingEnabled = s < 1
  ctx.drawImage(currentImg.image, 0, 0)
  ctx.restore()

  // 像素网格（缩放 > 4x 时显示）
  if (s >= 4) {
    ctx.save()
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= iw; x++) {
      const px = o.x + x * s
      if (px >= RULER_SIZE && px <= cw) {
        ctx.beginPath(); ctx.moveTo(px, Math.max(RULER_SIZE, o.y)); ctx.lineTo(px, Math.min(ch, o.y + ih * s)); ctx.stroke()
      }
    }
    for (let y = 0; y <= ih; y++) {
      const py = o.y + y * s
      if (py >= RULER_SIZE && py <= ch) {
        ctx.beginPath(); ctx.moveTo(Math.max(RULER_SIZE, o.x), py); ctx.lineTo(Math.min(cw, o.x + iw * s), py); ctx.stroke()
      }
    }
    ctx.restore()
  }

  // 切片线
  if (region) {
    const hoverTarget = drag.hovering.value
    const dragTarget = drag.dragging.value

    // 可拉伸区域高亮 - 斜线条纹
    ctx.save()
    const rx = o.x + region.left * s
    const ry = o.y + region.top * s
    const rw = (region.right - region.left) * s
    const rh = (region.bottom - region.top) * s
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
    ctx.fillRect(rx, ry, rw, rh)

    // 条纹图案
    const stripeCanvas = document.createElement('canvas')
    stripeCanvas.width = 8; stripeCanvas.height = 8
    const sctx = stripeCanvas.getContext('2d')!
    sctx.strokeStyle = 'rgba(59, 130, 246, 0.12)'
    sctx.lineWidth = 1
    sctx.beginPath(); sctx.moveTo(0, 8); sctx.lineTo(8, 0); sctx.stroke()
    const stripePattern = ctx.createPattern(stripeCanvas, 'repeat')!
    ctx.fillStyle = stripePattern
    ctx.fillRect(rx, ry, rw, rh)
    ctx.restore()

    // 绘制每条切片线
    const lines: { target: 'left' | 'right' | 'top' | 'bottom'; isVertical: boolean; pos: number }[] = [
      { target: 'left', isVertical: true, pos: region.left },
      { target: 'right', isVertical: true, pos: region.right },
      { target: 'top', isVertical: false, pos: region.top },
      { target: 'bottom', isVertical: false, pos: region.bottom },
    ]

    for (const line of lines) {
      const isActive = dragTarget === line.target
      const isHover = hoverTarget === line.target
      const lineColor = isActive ? 'rgba(37, 99, 235, 1)' : isHover ? 'rgba(59, 130, 246, 0.9)' : 'rgba(59, 130, 246, 0.6)'
      const lineWidth = isActive ? 2 : isHover ? 1.5 : 1
      const dash = isActive ? [] : [4, 3]

      ctx.save()
      ctx.strokeStyle = lineColor
      ctx.lineWidth = lineWidth
      ctx.setLineDash(dash)
      ctx.beginPath()
      if (line.isVertical) {
        const px = o.x + line.pos * s
        ctx.moveTo(px, Math.max(RULER_SIZE, o.y))
        ctx.lineTo(px, Math.min(ch, o.y + ih * s))
      } else {
        const py = o.y + line.pos * s
        ctx.moveTo(Math.max(RULER_SIZE, o.x), py)
        ctx.lineTo(Math.min(cw, o.x + iw * s), py)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // 边缘手柄方块
      const handleSize = 6
      ctx.fillStyle = lineColor
      if (line.isVertical) {
        const px = o.x + line.pos * s
        ctx.fillRect(px - handleSize / 2, Math.max(RULER_SIZE, o.y) - 1, handleSize, handleSize)
        ctx.fillRect(px - handleSize / 2, Math.min(ch, o.y + ih * s) - handleSize + 1, handleSize, handleSize)
      } else {
        const py = o.y + line.pos * s
        ctx.fillRect(Math.max(RULER_SIZE, o.x) - 1, py - handleSize / 2, handleSize, handleSize)
        ctx.fillRect(Math.min(cw, o.x + iw * s) - handleSize + 1, py - handleSize / 2, handleSize, handleSize)
      }

      // 拖拽或悬停时显示坐标标签
      if (isActive || isHover) {
        const label = `${line.pos}px`
        ctx.font = '11px ui-monospace, monospace'
        ctx.fillStyle = 'rgba(37, 99, 235, 0.9)'
        const tm = ctx.measureText(label)
        if (line.isVertical) {
          const px = o.x + line.pos * s
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.fillRect(px + 4, RULER_SIZE + 4, tm.width + 6, 16)
          ctx.fillStyle = 'rgba(37, 99, 235, 0.9)'
          ctx.fillText(label, px + 7, RULER_SIZE + 16)
        } else {
          const py = o.y + line.pos * s
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.fillRect(RULER_SIZE + 4, py + 4, tm.width + 6, 16)
          ctx.fillStyle = 'rgba(37, 99, 235, 0.9)'
          ctx.fillText(label, RULER_SIZE + 7, py + 16)
        }
      }

      ctx.restore()
    }
  }

  ctx.restore()

  // --- 标尺 ---
  drawRulers(ctx, cw, ch, o, s, iw, ih)
}

function drawRulers(
  ctx: CanvasRenderingContext2D, cw: number, ch: number,
  o: { x: number; y: number }, s: number, iw: number, ih: number,
) {
  // 标尺背景
  ctx.fillStyle = dark.value ? '#1f2937' : '#f9fafb'
  ctx.fillRect(0, 0, cw, RULER_SIZE)
  ctx.fillRect(0, 0, RULER_SIZE, ch)
  ctx.fillStyle = dark.value ? '#374151' : '#e5e7eb'
  ctx.fillRect(0, RULER_SIZE, cw, 1)
  ctx.fillRect(RULER_SIZE, 0, 1, ch)

  // 角落
  ctx.fillStyle = dark.value ? '#111827' : '#f3f4f6'
  ctx.fillRect(0, 0, RULER_SIZE, RULER_SIZE)

  // 根据缩放选择刻度间距
  const pixelsPerUnit = s
  let tickInterval = 1
  const intervals = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
  for (const iv of intervals) {
    if (iv * pixelsPerUnit >= 40) { tickInterval = iv; break }
  }

  ctx.save()
  ctx.font = '9px ui-monospace, monospace'
  ctx.fillStyle = dark.value ? '#6b7280' : '#9ca3af'
  ctx.strokeStyle = dark.value ? '#4b5563' : '#d1d5db'
  ctx.lineWidth = 0.5

  // 水平标尺
  ctx.save()
  ctx.beginPath()
  ctx.rect(RULER_SIZE, 0, cw - RULER_SIZE, RULER_SIZE)
  ctx.clip()
  const xStart = Math.max(0, Math.floor(-o.x / s / tickInterval) * tickInterval)
  const xEnd = Math.min(iw, Math.ceil((cw - o.x) / s / tickInterval) * tickInterval)
  for (let x = xStart; x <= xEnd; x += tickInterval) {
    const px = o.x + x * s
    const isMainTick = x % (tickInterval * 5) === 0 || tickInterval >= 100
    ctx.beginPath()
    ctx.moveTo(px, isMainTick ? RULER_SIZE * 0.3 : RULER_SIZE * 0.6)
    ctx.lineTo(px, RULER_SIZE)
    ctx.stroke()
    if (isMainTick) {
      ctx.fillText(String(x), px + 2, RULER_SIZE * 0.5)
    }
  }
  ctx.restore()

  // 垂直标尺
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, RULER_SIZE, RULER_SIZE, ch - RULER_SIZE)
  ctx.clip()
  const yStart = Math.max(0, Math.floor(-o.y / s / tickInterval) * tickInterval)
  const yEnd = Math.min(ih, Math.ceil((ch - o.y) / s / tickInterval) * tickInterval)
  for (let y = yStart; y <= yEnd; y += tickInterval) {
    const py = o.y + y * s
    const isMainTick = y % (tickInterval * 5) === 0 || tickInterval >= 100
    ctx.beginPath()
    ctx.moveTo(isMainTick ? RULER_SIZE * 0.3 : RULER_SIZE * 0.6, py)
    ctx.lineTo(RULER_SIZE, py)
    ctx.stroke()
    if (isMainTick) {
      ctx.save()
      ctx.translate(RULER_SIZE * 0.4, py + 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(String(y), 0, 0)
      ctx.restore()
    }
  }
  ctx.restore()
  ctx.restore()

  // 缩放比例指示器
  ctx.save()
  ctx.font = '11px ui-monospace, monospace'
  ctx.fillStyle = dark.value ? 'rgba(156,163,175,0.7)' : 'rgba(107, 114, 128, 0.7)'
  ctx.textAlign = 'right'
  ctx.fillText(`${Math.round(s * 100)}%`, cw - 8, ch - 8)
  ctx.restore()
}

watch([() => item.value?.id, () => sliceRegion.value, () => drag.hovering.value, () => drag.dragging.value, () => dark.value], () => {
  nextTick(drawCanvas)
}, { deep: true })

onMounted(() => {
  // 平移监听 — 仅响应鼠标中键
  const container = containerRef.value
  if (container) {
    container.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 1) {
        isPanning.value = true
        panStart = { x: e.clientX, y: e.clientY }
        panStartOffset = { ...panOffset.value }
        e.preventDefault()
      }
    })
    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (isPanning.value) {
        panOffset.value = {
          x: panStartOffset.x + (e.clientX - panStart.x),
          y: panStartOffset.y + (e.clientY - panStart.y),
        }
        nextTick(drawCanvas)
      }
    })
    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 1) {
        isPanning.value = false
      }
    })
  }
  const observer = new ResizeObserver(() => {
    if (item.value) drawCanvas()
  })
  if (container) observer.observe(container)
})

// 画布可用时绑定拖拽交互
let dragAttached = false
watch(canvasRef, (canvas) => {
  if (canvas && !dragAttached) {
    drag.attach(canvas)
    dragAttached = true
  }
})

const imageSizeText = computed(() => {
  if (!item.value) return ''
  return `${item.value.image.naturalWidth} x ${item.value.image.naturalHeight}`
})

const canvasCursor = computed(() => {
  if (isPanning.value) return 'grabbing'
  if (drag.cursor.value !== 'default') return drag.cursor.value
  return 'default'
})
</script>

<template>
  <div class="flex flex-col h-full bg-white dark:bg-gray-800">
    <!-- Panel title -->
    <div class="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 flex-shrink-0">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span class="text-xs font-medium text-gray-600 dark:text-gray-300">编辑器</span>
        <span v-if="item" class="text-xs text-gray-400 dark:text-gray-500">{{ imageSizeText }}</span>
      </div>
      <div v-if="item" class="flex items-center gap-2">
        <button
          class="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors text-gray-600 dark:text-gray-300"
          @click="fitToView"
          title="适应窗口"
        >
          适应
        </button>
        <button
          class="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors text-gray-600 dark:text-gray-300"
          @click="onRecompute"
          title="重新计算裁切区域"
        >
          重新计算
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div v-if="item" class="flex flex-wrap items-center gap-3 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 text-xs">
      <div class="flex items-center gap-1">
        <label class="text-gray-500 dark:text-gray-400 font-medium">容差:</label>
        <input
          type="range" v-model.number="localTolerance"
          min="0" max="30" class="w-16 h-1 accent-blue-500"
          @change="onToleranceChange"
        />
        <span class="text-gray-400 dark:text-gray-500 w-5 text-right font-mono">{{ localTolerance }}</span>
      </div>

      <div class="w-px h-4 bg-gray-200 dark:bg-gray-600" />

      <!-- Border TBLR inputs (Cocos style) -->
      <div class="flex items-center gap-1.5">
        <label class="text-gray-500 dark:text-gray-400 font-medium">Border</label>
        <div class="flex items-center gap-0.5">
          <span class="text-gray-400 dark:text-gray-500">T</span>
          <input type="number" v-model.number="borderTop" class="w-16 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-1 text-center font-mono focus:border-blue-400 focus:outline-none" @change="applyBorderInput" />
        </div>
        <div class="flex items-center gap-0.5">
          <span class="text-gray-400 dark:text-gray-500">B</span>
          <input type="number" v-model.number="borderBottom" class="w-16 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-1 text-center font-mono focus:border-blue-400 focus:outline-none" @change="applyBorderInput" />
        </div>
        <div class="flex items-center gap-0.5">
          <span class="text-gray-400 dark:text-gray-500">L</span>
          <input type="number" v-model.number="borderLeft" class="w-16 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-1 text-center font-mono focus:border-blue-400 focus:outline-none" @change="applyBorderInput" />
        </div>
        <div class="flex items-center gap-0.5">
          <span class="text-gray-400 dark:text-gray-500">R</span>
          <input type="number" v-model.number="borderRight" class="w-16 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-1 text-center font-mono focus:border-blue-400 focus:outline-none" @change="applyBorderInput" />
        </div>
      </div>
    </div>

    <!-- Canvas -->
    <div
      ref="containerRef"
      class="flex-1 min-h-0 relative overflow-hidden"
      @wheel.prevent="onWheel"
      @dblclick="fitToView"
    >
      <canvas
        v-if="item"
        ref="canvasRef"
        class="absolute inset-0"
        :style="{ cursor: canvasCursor }"
      />
      <div v-else class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
        <div class="text-center">
          <svg class="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p>选择或上传一张图片</p>
        </div>
      </div>
    </div>
  </div>
</template>
