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
  selectItem: (id: string) => void
  updateRegion: (region: SliceRegion) => void
  recompute: (tolerance: number) => void
}

const items = ref<ImageItem[]>([])
const selectedId = ref<string | null>(null)
const enableAlphaBleeding = ref(false)
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
}

function removeItem(id: string) {
  const idx = items.value.findIndex(i => i.id === id)
  if (idx >= 0) items.value.splice(idx, 1)
  if (selectedId.value === id) {
    selectedId.value = items.value.length > 0 ? items.value[0].id : null
  }
}

function selectItem(id: string) {
  selectedId.value = id
}

function updateRegion(region: SliceRegion) {
  if (currentItem.value) {
    currentItem.value.sliceRegion = { ...region }
  }
}

function recompute(tolerance: number) {
  if (!currentItem.value) return
  const region = computeSliceRegion(currentItem.value.imageData, tolerance)
  currentItem.value.sliceRegion = region
  currentItem.value.tolerance = tolerance
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
    selectItem,
    updateRegion,
    recompute,
  }
}
