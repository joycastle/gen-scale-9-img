<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { sliceRegionToBorder, getImageSize } from './utils/sliceAlgorithm'
import { exportSlice9, downloadBlob } from './utils/imageExport'
import { useDarkMode } from './composables/useDarkMode'
import { useAppStore } from './composables/useAppStore'
import { DockviewVue, themeDark, themeLight } from 'dockview-vue'
import type { DockviewReadyEvent, DockviewApi, AddPanelOptions } from 'dockview-vue'
import 'dockview-vue/dist/styles/dockview.css'
import HelpDialog from './components/HelpDialog.vue'
import JSZip from 'jszip'

const { isDark, init: initDark, toggle: toggleDark } = useDarkMode()
const store = useAppStore()
const version = __APP_VERSION__

const showHelpRef = ref(false)
const exporting = ref(false)

let dockApi: DockviewApi | null = null

// 生成导出文件名：名字中已包含 .9 则不再追加（兼容 .9@3x.png 等蓝湖格式）
function toSlice9Name(name: string): string {
  const base = name.replace(/\.png$/i, '')
  return base.includes('.9') ? base + '.png' : base + '.9.png'
}

function generateBorderConfig(): string {
  const config: Record<string, { top: number; bottom: number; left: number; right: number }> = {}
  for (const item of store.items.value) {
    const name = item.name.replace(/\.png$/i, '')
    const { width, height } = getImageSize(item.image)
    const border = sliceRegionToBorder(item.sliceRegion, width, height)
    config[name] = border
  }
  return JSON.stringify(config, null, 2)
}

async function exportCurrent() {
  const item = store.currentItem.value
  if (!item || exporting.value) return
  exporting.value = true
  try {
    const blob = await exportSlice9(item.image, item.sliceRegion, store.enableAlphaBleeding.value)
    downloadBlob(blob, toSlice9Name(item.name))
    const configName = item.name.replace(/\.png$/i, '')
    const { width, height } = getImageSize(item.image)
    const border = sliceRegionToBorder(item.sliceRegion, width, height)
    downloadBlob(new Blob([JSON.stringify({ [configName]: border }, null, 2)], { type: 'application/json' }), configName + '.border.json')
  } finally {
    exporting.value = false
  }
}

async function exportAll() {
  if (store.items.value.length === 0 || exporting.value) return
  if (store.items.value.length === 1) { await exportCurrent(); return }
  exporting.value = true
  try {
    const zip = new JSZip()
    for (const item of store.items.value) {
      const blob = await exportSlice9(item.image, item.sliceRegion, store.enableAlphaBleeding.value)
      zip.file(toSlice9Name(item.name), blob)
    }
    zip.file('border-config.json', generateBorderConfig())
    downloadBlob(await zip.generateAsync({ type: 'blob' }), 'slice9-export.zip')
  } finally {
    exporting.value = false
  }
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

  event.api.addPanel({ id: 'imageList', component: 'ImageList', title: '图片列表', tabComponent: 'SimpleTab' } as AddPanelOptions)
  event.api.addPanel({ id: 'imageEditor', component: 'ImageEditor', title: '编辑器', tabComponent: 'SimpleTab', position: { referencePanel: 'imageList', direction: 'right' } } as AddPanelOptions)
  event.api.addPanel({ id: 'stretchPreview', component: 'StretchPreview', title: '拉伸预览', tabComponent: 'SimpleTab', position: { referencePanel: 'imageEditor', direction: 'right' } } as AddPanelOptions)
  event.api.addPanel({ id: 'cutPreview', component: 'CutPreview', title: '裁切结果', tabComponent: 'SimpleTab', position: { referencePanel: 'imageList', direction: 'below' } } as AddPanelOptions)
  event.api.addPanel({ id: 'alphaBleedingPreview', component: 'AlphaBleedingPreview', title: 'Bleeding 预览', tabComponent: 'SimpleTab', position: { referencePanel: 'cutPreview' } } as AddPanelOptions)
  event.api.getPanel('cutPreview')!.api.setActive()
  event.api.getPanel('imageList')!.api.setActive()
}

function resetLayout() {
  localStorage.removeItem(LAYOUT_KEY)
  window.location.reload()
}

onMounted(() => initDark())
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-100 dark:bg-[#1e1e1e]">
    <header class="flex items-center justify-between px-4 py-2 bg-white dark:bg-[#252526] border-b border-gray-200 dark:border-[#444] shadow-sm flex-shrink-0">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        </div>
        <h1 class="text-sm font-semibold text-gray-700 dark:text-gray-200">Slice9 Editor</h1>
        <span class="text-xs text-gray-400 dark:text-gray-500">v{{ version }}</span>
      </div>
      <div class="flex items-center gap-2.5">
        <label class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <input type="checkbox" v-model="store.enableAlphaBleeding.value" class="accent-blue-500 w-3.5 h-3.5" />
          Alpha Bleeding
        </label>
        <div class="w-px h-5 bg-gray-200 dark:bg-[#444]" />
        <button v-if="store.currentItem.value" :disabled="exporting" class="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors shadow-sm disabled:opacity-50" @click="exportCurrent">{{ exporting ? '导出中...' : '导出当前' }}</button>
        <button v-if="store.items.value.length > 1" :disabled="exporting" class="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-md transition-colors shadow-sm disabled:opacity-50" @click="exportAll">{{ exporting ? '导出中...' : `批量导出 (${store.items.value.length})` }}</button>
        <div class="w-px h-5 bg-gray-200 dark:bg-[#444]" />
        <button class="w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-[#3c3c3c] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" @click="resetLayout" title="重置布局">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
        <button class="w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-[#3c3c3c] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" @click="toggleDark" :title="isDark ? '亮色模式' : '暗色模式'">
          <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        </button>
        <button class="w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-[#3c3c3c] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" @click="showHelpRef = true" title="使用说明">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </div>
    </header>

    <div class="flex-1 min-h-0">
      <DockviewVue
        :theme="isDark ? themeDark : themeLight"
        class="dv-custom"
        @ready="onDockReady"
      />
    </div>

    <HelpDialog v-if="showHelpRef" @close="showHelpRef = false" />
  </div>
</template>

<style>
.dv-custom { height: 100%; width: 100%; }
</style>
