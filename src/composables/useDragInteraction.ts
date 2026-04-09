import { ref, onUnmounted } from 'vue'
import type { SliceRegion } from '../types'

export type DragTarget = 'left' | 'right' | 'top' | 'bottom' | null

const HIT_THRESHOLD_PX = 8

export function useDragInteraction(
  canvasRef: () => HTMLCanvasElement | null,
  isActive: () => boolean,
  regionRef: () => SliceRegion | null,
  imageSize: () => { width: number; height: number } | null,
  scale: () => number,
  offset: () => { x: number; y: number },
  onUpdate: (region: SliceRegion) => void,
  onActivate: () => void,
  onDragStart: () => void,
  onDragEnd: () => void,
  onUndo: () => void,
  onRedo: () => void,
  onDblClick?: () => void,
) {
  const dragging = ref<DragTarget>(null)
  const hovering = ref<DragTarget>(null)
  const cursor = ref('default')
  const dragCoord = ref<{ x: number; y: number } | null>(null)

  function toImageCoords(clientX: number, clientY: number) {
    const canvas = canvasRef()
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const s = scale()
    const o = offset()
    return {
      x: (clientX - rect.left - o.x) / s,
      y: (clientY - rect.top - o.y) / s,
    }
  }

  function detectTarget(imgX: number, imgY: number, region: SliceRegion): DragTarget {
    const s = scale()
    const threshold = HIT_THRESHOLD_PX / s

    if (Math.abs(imgX - region.left) < threshold) return 'left'
    if (Math.abs(imgX - region.right) < threshold) return 'right'
    if (Math.abs(imgY - region.top) < threshold) return 'top'
    if (Math.abs(imgY - region.bottom) < threshold) return 'bottom'
    return null
  }

  function getCursor(target: DragTarget): string {
    if (target === 'left' || target === 'right') return 'ew-resize'
    if (target === 'top' || target === 'bottom') return 'ns-resize'
    return 'default'
  }

  function clampRegion(updated: SliceRegion): SliceRegion {
    const size = imageSize()
    if (!size) return updated
    return {
      left: Math.max(0, Math.min(updated.left, updated.right)),
      right: Math.min(size.width - 1, Math.max(updated.right, updated.left)),
      top: Math.max(0, Math.min(updated.top, updated.bottom)),
      bottom: Math.min(size.height - 1, Math.max(updated.bottom, updated.top)),
    }
  }

  function onMouseMove(e: MouseEvent) {
    const region = regionRef()
    if (!region) return

    const { x, y } = toImageCoords(e.clientX, e.clientY)

    if (dragging.value) {
      const updated = { ...region }
      switch (dragging.value) {
        case 'left': updated.left = Math.round(x); break
        case 'right': updated.right = Math.round(x); break
        case 'top': updated.top = Math.round(y); break
        case 'bottom': updated.bottom = Math.round(y); break
      }
      onUpdate(clampRegion(updated))
      dragCoord.value = { x: Math.round(x), y: Math.round(y) }
    } else {
      const target = detectTarget(x, y, region)
      hovering.value = target
      cursor.value = getCursor(target)
    }
  }

  function onMouseDown(e: MouseEvent) {
    const canvas = canvasRef()
    const region = regionRef()
    if (!canvas || !region) return
    // 仅响应鼠标左键
    if (e.button !== 0) return
    const { x, y } = toImageCoords(e.clientX, e.clientY)
    const target = detectTarget(x, y, region)
    if (target) {
      onActivate()
      dragging.value = target
      onDragStart()
      dragCoord.value = { x: Math.round(x), y: Math.round(y) }
      e.preventDefault()
    }
  }

  function onMouseUp() {
    if (dragging.value) {
      onDragEnd()
    }
    dragging.value = null
    dragCoord.value = null
  }

  function onKeyDown(e: KeyboardEvent) {
    const canvas = canvasRef()
    if (!canvas) return
    if (!isActive()) return
    // 不拦截输入框内的快捷键（如原生文本撤销）
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    const isMeta = e.metaKey || e.ctrlKey
    if (isMeta && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      onUndo()
      return
    }
    if (isMeta && e.key === 'z' && e.shiftKey) {
      e.preventDefault()
      onRedo()
      return
    }

    const region = regionRef()
    const target = hovering.value || dragging.value
    if (!region || !target) return

    let delta = 0
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') delta = -1
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') delta = 1
    else return

    e.preventDefault()
    onDragStart()
    const updated = { ...region }
    updated[target] += delta
    onUpdate(clampRegion(updated))
  }

  function onDblClickHandler() {
    onDblClick?.()
  }

  function attach(canvas: HTMLCanvasElement) {
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('dblclick', onDblClickHandler)
    canvas.tabIndex = 0
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keydown', onKeyDown)
  }

  function detach(canvas: HTMLCanvasElement) {
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mousedown', onMouseDown)
    canvas.removeEventListener('dblclick', onDblClickHandler)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('keydown', onKeyDown)
  }

  onUnmounted(() => {
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('keydown', onKeyDown)
  })

  return { dragging, hovering, cursor, dragCoord, attach, detach }
}
