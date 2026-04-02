<script setup lang="ts">
import { onMounted } from 'vue'
import { sliceRegionToBorder } from './types'
import { exportSlice9, downloadBlob } from './utils/imageExport'
import { useDarkMode } from './composables/useDarkMode'
import { useAppStore } from './composables/useAppStore'
import { DockviewVue } from 'dockview-vue'
import type { DockviewReadyEvent, DockviewApi, AddPanelOptions } from 'dockview-vue'
import 'dockview-vue/dist/styles/dockview.css'
import HelpDialog from './components/HelpDialog.vue'
import JSZip from 'jszip'

const { isDark, init: initDark, toggle: toggleDark } = useDarkMode()
const store = useAppStore()

import { ref } from 'vue'
const showHelpRef = ref(false)

let dockApi: DockviewApi | null = null

function generateBorderConfig(): string {
  const config: Record<string, { top: number; bottom: number; left: number; right: number }> = {}
  for (const item of store.items.value) {
    const name = item.name.replace(/\.png$/i, '')
    const border = sliceRegionToBorder(item.sliceRegion, item.image.naturalWidth, item.image.naturalHeight)
    config[name] = border
  }
  return JSON.stringify(config, null, 2)
}

async function exportCurrent() {
  const item = store.currentItem.value
  if (!item) return
  const blob = await exportSlice9(item.image, item.sliceRegion, store.enableAlphaBleeding.value)
  downloadBlob(blob, item.name.replace(/\.png$/i, '') + '.9.png')
  const configName = item.name.replace(/\.png$/i, '')
  const border = sliceRegionToBorder(item.sliceRegion, item.image.naturalWidth, item.image.naturalHeight)
  downloadBlob(new Blob([JSON.stringify({ [configName]: border }, null, 2)], { type: 'application/json' }), configName + '.border.json')
}

async function exportAll() {
  if (store.items.value.length === 0) return
  if (store.items.value.length === 1) { await exportCurrent(); return }
  const zip = new JSZip()
  for (const item of store.items.value) {
    const blob = await exportSlice9(item.image, item.sliceRegion, store.enableAlphaBleeding.value)
    zip.file(item.name.replace(/\.png$/i, '') + '.9.png', blob)
  }
  zip.file('border-config.json', generateBorderConfig())
  downloadBlob(await zip.generateAsync({ type: 'blob' }), 'slice9-export.zip')
}

const LAYOUT_KEY = 'slice9-dock-layout'

function onDockReady(event: DockviewReadyEvent) {
  dockApi = event.api

  event.api.onDidLayoutChange(() => {
    if (dockApi) {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(dockApi.toJSON()))
    }
  })

  const saved = localStorage.getItem(LAYOUT_KEY)
  if (saved) {
    try {
      event.api.fromJSON(JSON.parse(saved))
      return
    } catch { /* fall through */ }
  }

  event.api.addPanel({ id: 'imagePanel', component: 'ImagePanel', title: '图片列表' })
  event.api.addPanel({ id: 'imageEditor', component: 'ImageEditor', title: '编辑器', position: { referencePanel: 'imagePanel', direction: 'right' } } as AddPanelOptions)
  event.api.addPanel({ id: 'stretchPreview', component: 'StretchPreview', title: '拉伸预览', position: { referencePanel: 'imageEditor', direction: 'right' } } as AddPanelOptions)
  event.api.addPanel({ id: 'cutPreview', component: 'CutPreview', title: '裁切结果', position: { referencePanel: 'imagePanel', direction: 'below' } } as AddPanelOptions)
}

function resetLayout() {
  localStorage.removeItem(LAYOUT_KEY)
  window.location.reload()
}

onMounted(() => initDark())
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
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
          <input type="checkbox" v-model="store.enableAlphaBleeding.value" class="accent-blue-500 w-3.5 h-3.5" />
          Alpha Bleeding
        </label>
        <div class="w-px h-5 bg-gray-200 dark:bg-gray-600" />
        <button v-if="store.currentItem.value" class="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors shadow-sm" @click="exportCurrent">导出当前</button>
        <button v-if="store.items.value.length > 1" class="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-md transition-colors shadow-sm" @click="exportAll">批量导出 ({{ store.items.value.length }})</button>
        <div class="w-px h-5 bg-gray-200 dark:bg-gray-600" />
        <button class="w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" @click="resetLayout" title="重置布局">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
        <button class="w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" @click="toggleDark" :title="isDark ? '亮色模式' : '暗色模式'">
          <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        </button>
        <button class="w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" @click="showHelpRef = true" title="使用说明">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </div>
    </header>

    <div class="flex-1 min-h-0">
      <DockviewVue
        :class="isDark ? 'dockview-theme-dark' : 'dockview-theme-light'"
        class="dv-custom"
        @ready="onDockReady"
      />
    </div>

    <HelpDialog v-if="showHelpRef" @close="showHelpRef = false" />
  </div>
</template>

<style>
.dv-custom { height: 100%; }

/* Hide close buttons on all tabs */
.dv-tab .dv-default-tab .dv-default-tab-action { display: none !important; }

/* Light theme overrides - target elements directly */
.dockview-theme-light .dv-tabs-and-actions-container {
  background-color: #f3f3f3 !important;
}
.dockview-theme-light .dv-groupview {
  background-color: white !important;
}
.dockview-theme-light .dv-active-group .dv-tabs-container > .dv-active-tab {
  background-color: white !important;
  color: rgb(51, 51, 51) !important;
}
.dockview-theme-light .dv-active-group .dv-tabs-container > .dv-inactive-tab {
  background-color: #ececec !important;
  color: rgba(51, 51, 51, 0.7) !important;
}
.dockview-theme-light .dv-inactive-group .dv-tabs-container > .dv-active-tab {
  background-color: white !important;
  color: rgba(51, 51, 51, 0.7) !important;
}
.dockview-theme-light .dv-inactive-group .dv-tabs-container > .dv-inactive-tab {
  background-color: #ececec !important;
  color: rgba(51, 51, 51, 0.35) !important;
}
.dockview-theme-light .dv-content-container {
  background-color: white !important;
}
</style>
