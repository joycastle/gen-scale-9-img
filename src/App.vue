<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ImageItem, SliceRegion } from './types'
import { sliceRegionToBoard } from './types'
import { computeSliceRegion } from './utils/sliceAlgorithm'
import { exportSlice9, downloadBlob } from './utils/imageExport'
import { useDarkMode } from './composables/useDarkMode'
import ImagePanel from './components/ImagePanel.vue'
import ImageEditor from './components/ImageEditor.vue'
import SlicePreview from './components/SlicePreview.vue'
import SplitPane from './components/SplitPane.vue'
import HelpDialog from './components/HelpDialog.vue'
import JSZip from 'jszip'

const { isDark, init: initDark, toggle: toggleDark } = useDarkMode()

const items = ref<ImageItem[]>([])
const selectedId = ref<string | null>(null)
const showHelp = ref(false)

onMounted(() => initDark())

const currentItem = computed(() =>
  items.value.find(i => i.id === selectedId.value) ?? null
)

const currentRegion = computed(() =>
  currentItem.value?.sliceRegion ?? null
)

const enableAlphaBleeding = ref(false)

function onAddItems(newItems: ImageItem[]) {
  items.value.push(...newItems)
  if (!selectedId.value && newItems.length > 0) {
    selectedId.value = newItems[0].id
  }
}

function onRemoveItem(id: string) {
  const idx = items.value.findIndex(i => i.id === id)
  if (idx >= 0) items.value.splice(idx, 1)
  if (selectedId.value === id) {
    selectedId.value = items.value.length > 0 ? items.value[0].id : null
  }
}

function onSelectItem(id: string) {
  selectedId.value = id
}

function onUpdateRegion(region: SliceRegion) {
  if (currentItem.value) {
    currentItem.value.sliceRegion = { ...region }
  }
}

function onRecompute(tolerance: number) {
  if (!currentItem.value) return
  const region = computeSliceRegion(currentItem.value.imageData, tolerance)
  currentItem.value.sliceRegion = region
  currentItem.value.tolerance = tolerance
}

function generateBoardConfig(): string {
  const config: Record<string, { top: number; bottom: number; left: number; right: number }> = {}
  for (const item of items.value) {
    const name = item.name.replace(/\.png$/i, '')
    const board = sliceRegionToBoard(
      item.sliceRegion,
      item.image.naturalWidth,
      item.image.naturalHeight,
    )
    config[name] = board
  }
  return JSON.stringify(config, null, 2)
}

async function exportCurrent() {
  const item = currentItem.value
  if (!item) return
  const blob = await exportSlice9(item.image, item.sliceRegion, enableAlphaBleeding.value)
  const name = item.name.replace(/\.png$/i, '') + '.9.png'
  downloadBlob(blob, name)

  // Also export single config
  const configName = item.name.replace(/\.png$/i, '')
  const board = sliceRegionToBoard(
    item.sliceRegion,
    item.image.naturalWidth,
    item.image.naturalHeight,
  )
  const configStr = JSON.stringify({ [configName]: board }, null, 2)
  const configBlob = new Blob([configStr], { type: 'application/json' })
  downloadBlob(configBlob, configName + '.board.json')
}

async function exportAll() {
  if (items.value.length === 0) return
  if (items.value.length === 1) {
    await exportCurrent()
    return
  }
  const zip = new JSZip()
  for (const item of items.value) {
    const blob = await exportSlice9(item.image, item.sliceRegion, enableAlphaBleeding.value)
    const name = item.name.replace(/\.png$/i, '') + '.9.png'
    zip.file(name, blob)
  }
  // Add board config
  zip.file('board-config.json', generateBoardConfig())

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(zipBlob, 'slice9-export.zip')
}
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        </div>
        <h1 class="text-sm font-semibold text-gray-700 dark:text-gray-200">Slice9 Editor</h1>
      </div>
      <div class="flex items-center gap-2.5">
        <label class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <input type="checkbox" v-model="enableAlphaBleeding" class="accent-blue-500 w-3.5 h-3.5" />
          Alpha Bleeding
        </label>
        <div class="w-px h-5 bg-gray-200 dark:bg-gray-600" />
        <button
          v-if="currentItem"
          class="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors shadow-sm"
          @click="exportCurrent"
        >
          导出当前
        </button>
        <button
          v-if="items.length > 1"
          class="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-md transition-colors shadow-sm"
          @click="exportAll"
        >
          批量导出 ({{ items.length }})
        </button>
        <div class="w-px h-5 bg-gray-200 dark:bg-gray-600" />
        <button
          class="w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          @click="toggleDark"
          :title="isDark ? '切换到亮色模式' : '切换到暗色模式'"
        >
          <!-- Sun icon (shown in dark mode) -->
          <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <!-- Moon icon (shown in light mode) -->
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
        <button
          class="w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          @click="showHelp = true"
          title="使用说明"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Main content -->
    <div class="flex-1 min-h-0">
      <SplitPane :sizes="[220, -1, 320]" :min-sizes="[180, 300, 240]" storage-key="slice9-split-h">
        <template #panel-0>
          <ImagePanel
            :items="items"
            :selected-id="selectedId"
            @add="onAddItems"
            @remove="onRemoveItem"
            @select="onSelectItem"
          />
        </template>

        <template #panel-1>
          <ImageEditor
            :item="currentItem"
            :slice-region="currentRegion"
            :dark="isDark"
            @update:slice-region="onUpdateRegion"
            @recompute="onRecompute"
          />
        </template>

        <template #panel-2>
          <SlicePreview
            :item="currentItem"
            :slice-region="currentRegion"
            :dark="isDark"
          />
        </template>
      </SplitPane>
    </div>

    <HelpDialog v-if="showHelp" @close="showHelp = false" />
  </div>
</template>
