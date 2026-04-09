import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { ImageItem, SliceRegion } from '../types'
import { computeSliceRegion } from '../utils/sliceAlgorithm'
import { useDarkMode } from './useDarkMode'

export interface AppStore {
  items: Ref<ImageItem[]>
  selectedId: Ref<string | null>
  currentItem: ComputedRef<ImageItem | null>
  currentRegion: ComputedRef<SliceRegion | null>
  isDark: Ref<boolean>
  enableAlphaBleeding: Ref<boolean>
  addItems: (newItems: ImageItem[]) => void
  removeItem: (id: string) => void
  clearAll: () => void
  selectItem: (id: string) => void
  updateRegion: (region: SliceRegion) => void
  updateRegionSilent: (region: SliceRegion) => void
  pushUndoSnapshot: () => void
  recompute: (tolerance: number) => void
  undo: () => void
  redo: () => void
}

const items = ref<ImageItem[]>([])
const selectedId = ref<string | null>(null)
const enableAlphaBleeding = ref(false)

const undoStack: SliceRegion[][] = []
const redoStack: SliceRegion[][] = []
const { isDark } = useDarkMode()

const currentItem = computed(() =>
  items.value.find(i => i.id === selectedId.value) ?? null
)
const currentRegion = computed(() =>
  currentItem.value?.sliceRegion ?? null
)

function addItems(newItems: ImageItem[]) {
  items.value.push(...newItems)
  if (!selectedId.value && newItems.length > 0) {
    selectedId.value = newItems[0].id
  }
  undoStack.length = 0
  redoStack.length = 0
}

function removeItem(id: string) {
  const idx = items.value.findIndex(i => i.id === id)
  if (idx >= 0) {
    const removed = items.value[idx]
    if (removed.image instanceof ImageBitmap) removed.image.close()
    items.value.splice(idx, 1)
  }
  if (selectedId.value === id) {
    selectedId.value = items.value.length > 0 ? items.value[0].id : null
  }
  undoStack.length = 0
  redoStack.length = 0
}

function clearAll() {
  for (const item of items.value) {
    if (item.image instanceof ImageBitmap) item.image.close()
  }
  items.value = []
  selectedId.value = null
  undoStack.length = 0
  redoStack.length = 0
}

function selectItem(id: string) {
  selectedId.value = id
}

function snapshotRegions(): SliceRegion[] {
  return items.value.map(i => ({ ...i.sliceRegion }))
}

function updateRegion(region: SliceRegion) {
  if (currentItem.value) {
    undoStack.push(snapshotRegions())
    redoStack.length = 0
    currentItem.value.sliceRegion = { ...region }
  }
}

function updateRegionSilent(region: SliceRegion) {
  if (currentItem.value) {
    currentItem.value.sliceRegion = { ...region }
  }
}

function pushUndoSnapshot() {
  undoStack.push(snapshotRegions())
  redoStack.length = 0
}

function recompute(tolerance: number) {
  if (!currentItem.value) return
  undoStack.push(snapshotRegions())
  redoStack.length = 0
  const region = computeSliceRegion(currentItem.value.imageData, tolerance)
  currentItem.value.sliceRegion = region
  currentItem.value.tolerance = tolerance
}

function undo() {
  if (undoStack.length === 0) return
  const prev = undoStack.pop()!
  redoStack.push(snapshotRegions())
  prev.forEach((region, idx) => {
    if (items.value[idx]) items.value[idx].sliceRegion = region
  })
}

function redo() {
  if (redoStack.length === 0) return
  const next = redoStack.pop()!
  undoStack.push(snapshotRegions())
  next.forEach((region, idx) => {
    if (items.value[idx]) items.value[idx].sliceRegion = region
  })
}

export function useAppStore(): AppStore {
  return {
    items,
    selectedId,
    currentItem,
    currentRegion,
    isDark,
    enableAlphaBleeding,
    addItems,
    removeItem,
    clearAll,
    selectItem,
    updateRegion,
    updateRegionSilent,
    pushUndoSnapshot,
    recompute,
    undo,
    redo,
  }
}
