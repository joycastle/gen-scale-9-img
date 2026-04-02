<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  sizes: [number, number, number]
  minSizes: [number, number, number]
  storageKey?: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const panelSizes = ref([...props.sizes])

let dragIndex = -1
let startX = 0
let startSizes: number[] = []

function loadSaved() {
  if (!props.storageKey) return
  const saved = localStorage.getItem(props.storageKey)
  if (saved) {
    try {
      const arr = JSON.parse(saved)
      if (Array.isArray(arr) && arr.length === 3) {
        panelSizes.value = arr
      }
    } catch { /* ignore */ }
  }
}

function saveSizes() {
  if (!props.storageKey) return
  localStorage.setItem(props.storageKey, JSON.stringify(panelSizes.value))
}

function getActualSizes(): number[] {
  const container = containerRef.value
  if (!container) return [...panelSizes.value]
  const totalW = container.clientWidth - 2 * 6
  const sizes = [...panelSizes.value]
  const flexIdx = sizes.findIndex(s => s < 0)
  if (flexIdx >= 0) {
    const fixed = sizes.reduce((sum, s, i) => i === flexIdx ? sum : sum + s, 0)
    sizes[flexIdx] = Math.max(props.minSizes[flexIdx], totalW - fixed)
  }
  return sizes
}

function onMouseDown(index: number, e: MouseEvent) {
  dragIndex = index
  startX = e.clientX
  startSizes = getActualSizes()
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (dragIndex < 0) return
  const delta = e.clientX - startX
  const leftIdx = dragIndex
  const rightIdx = dragIndex + 1
  let newLeft = startSizes[leftIdx] + delta
  let newRight = startSizes[rightIdx] - delta

  if (newLeft < props.minSizes[leftIdx]) {
    newLeft = props.minSizes[leftIdx]
    newRight = startSizes[leftIdx] + startSizes[rightIdx] - newLeft
  }
  if (newRight < props.minSizes[rightIdx]) {
    newRight = props.minSizes[rightIdx]
    newLeft = startSizes[leftIdx] + startSizes[rightIdx] - newRight
  }

  const sizes = [...startSizes]
  sizes[leftIdx] = newLeft
  sizes[rightIdx] = newRight
  panelSizes.value = sizes
}

function onMouseUp() {
  if (dragIndex < 0) return
  dragIndex = -1
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  saveSizes()
}

onMounted(() => {
  loadSaved()
  const container = containerRef.value
  if (container) {
    const totalW = container.clientWidth - 2 * 6
    const sizes = [...panelSizes.value]
    const flexIdx = sizes.findIndex(s => s < 0)
    if (flexIdx >= 0) {
      const fixed = sizes.reduce((sum, s, i) => i === flexIdx ? sum : sum + s, 0)
      sizes[flexIdx] = Math.max(props.minSizes[flexIdx], totalW - fixed)
      panelSizes.value = sizes
    }
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div ref="containerRef" class="flex h-full overflow-hidden">
    <div :style="{ width: panelSizes[0] + 'px', flexShrink: 0 }" class="min-w-0 overflow-hidden">
      <slot name="panel-0" />
    </div>
    <div
      class="w-1.5 flex-shrink-0 bg-gray-200 dark:bg-gray-600 hover:bg-blue-400 dark:hover:bg-blue-500 active:bg-blue-500 cursor-col-resize transition-colors relative group"
      @mousedown="onMouseDown(0, $event)"
    >
      <div class="absolute inset-y-0 -left-1 -right-1" />
    </div>
    <div :style="{ width: panelSizes[1] + 'px', flexShrink: 0 }" class="min-w-0 overflow-hidden flex-1">
      <slot name="panel-1" />
    </div>
    <div
      class="w-1.5 flex-shrink-0 bg-gray-200 dark:bg-gray-600 hover:bg-blue-400 dark:hover:bg-blue-500 active:bg-blue-500 cursor-col-resize transition-colors relative group"
      @mousedown="onMouseDown(1, $event)"
    >
      <div class="absolute inset-y-0 -left-1 -right-1" />
    </div>
    <div :style="{ width: panelSizes[2] + 'px', flexShrink: 0 }" class="min-w-0 overflow-hidden">
      <slot name="panel-2" />
    </div>
  </div>
</template>
