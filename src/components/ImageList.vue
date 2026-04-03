<script setup lang="ts">
import { ref } from 'vue'
import type { ImageItem } from '../types'
import { computeSliceRegion, getImageDataFromImage, trimImage } from '../utils/sliceAlgorithm'
import { useAppStore } from '../composables/useAppStore'

const store = useAppStore()

const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const savedView = localStorage.getItem('slice9-view-mode')
const viewMode = ref<'list' | 'grid'>(savedView === 'grid' ? 'grid' : 'list')

function setViewMode(mode: 'list' | 'grid') {
  viewMode.value = mode
  localStorage.setItem('slice9-view-mode', mode)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave(e: DragEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
    isDragging.value = false
  }
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const items = e.dataTransfer?.items
  if (items) {
    const files = await collectPngFiles(items)
    processFiles(files)
  }
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) processFiles(Array.from(input.files).filter(f => f.type === 'image/png'))
  input.value = ''
}

// 从 DataTransferItemList 递归收集所有 PNG 文件
async function collectPngFiles(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = []
  const entries: FileSystemEntry[] = []
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.()
    if (entry) entries.push(entry)
  }
  await traverseEntries(entries, files)
  return files
}

async function traverseEntries(entries: FileSystemEntry[], result: File[]): Promise<void> {
  for (const entry of entries) {
    if (entry.isFile) {
      const file = await entryToFile(entry as FileSystemFileEntry)
      if (file.type === 'image/png') result.push(file)
    } else if (entry.isDirectory) {
      const children = await readDirectory(entry as FileSystemDirectoryEntry)
      await traverseEntries(children, result)
    }
  }
}

function entryToFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

function readDirectory(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = dir.createReader()
    const all: FileSystemEntry[] = []
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) { resolve(all); return }
        all.push(...entries)
        readBatch() // readEntries 可能分批返回
      }, reject)
    }
    readBatch()
  })
}

function processFiles(files: File[]) {
  const promises = files.map(file => loadImage(file))
  Promise.all(promises).then(newItems => {
    store.addItems(newItems)
  })
}

function loadImage(file: File): Promise<ImageItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = async () => {
        const trimmed = await trimImage(img)
        const imageData = getImageDataFromImage(trimmed)
        const sliceRegion = computeSliceRegion(imageData, 0)
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          image: trimmed,
          imageData,
          sliceRegion,
          alphaBleeding: false,
          tolerance: 0,
        })
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
</script>

<template>
  <div
    class="flex flex-col h-full bg-white dark:bg-gray-800 relative"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Drop overlay -->
    <Transition name="fade">
      <div
        v-if="isDragging"
        class="absolute inset-0 z-10 bg-blue-500/10 dark:bg-blue-400/15 border-2 border-dashed border-blue-400 rounded flex items-center justify-center"
      >
        <div class="text-blue-500 dark:text-blue-400 text-sm font-medium">释放以上传 PNG</div>
      </div>
    </Transition>

    <!-- Panel title bar -->
    <div class="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 flex-shrink-0">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span class="text-xs font-medium text-gray-600 dark:text-gray-300">图片</span>
        <span class="text-xs text-gray-400 dark:text-gray-500">{{ store.items.value.length }}</span>
      </div>
      <div class="flex items-center gap-1">
        <!-- Add button -->
        <button
          class="w-5 h-5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          @click="fileInputRef?.click()"
          title="添加图片"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <!-- Clear all button -->
        <button
          v-if="store.items.value.length > 0"
          class="w-5 h-5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          @click="store.clearAll()"
          title="清空全部"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        <!-- List view -->
        <button
          class="w-5 h-5 rounded flex items-center justify-center transition-colors"
          :class="viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-600 dark:hover:text-gray-300'"
          @click="setViewMode('list')"
          title="列表视图"
        >
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
            <rect x="1" y="1" width="14" height="3" rx="1"/><rect x="1" y="6" width="14" height="3" rx="1"/><rect x="1" y="11" width="14" height="3" rx="1"/>
          </svg>
        </button>
        <!-- Grid view -->
        <button
          class="w-5 h-5 rounded flex items-center justify-center transition-colors"
          :class="viewMode === 'grid' ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200' : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-600 dark:hover:text-gray-300'"
          @click="setViewMode('grid')"
          title="网格视图"
        >
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
            <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
          </svg>
        </button>
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/png"
      multiple
      class="hidden"
      @change="onFileInput"
    />

    <!-- Image list -->
    <div class="flex-1 overflow-y-auto min-h-0 p-2">
      <!-- Empty state -->
      <div v-if="store.items.value.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <svg class="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p class="text-xs">拖拽 PNG 到此处</p>
        <p class="text-[10px] mt-0.5 opacity-60">或点击 + 按钮选择</p>
      </div>

      <!-- Grid view -->
      <div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 gap-1.5">
        <div
          v-for="item in store.items.value"
          :key="item.id"
          class="relative group rounded-md overflow-hidden cursor-pointer transition-all border-2"
          :class="item.id === store.selectedId.value
            ? 'border-blue-400 shadow-sm shadow-blue-100 dark:shadow-blue-900/30 scale-[1.02]'
            : 'border-transparent hover:border-gray-200 dark:hover:border-gray-600'"
          @click="store.selectItem(item.id)"
        >
          <div class="aspect-square bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] dark:bg-[repeating-conic-gradient(#374151_0%_25%,#1f2937_0%_50%)] bg-[length:8px_8px] flex items-center justify-center p-1">
            <img :src="item.image.src" :alt="item.name" class="max-w-full max-h-full object-contain" />
          </div>
          <div class="px-1 py-0.5 bg-white dark:bg-gray-800">
            <p class="text-[10px] text-gray-500 dark:text-gray-400 truncate text-center">{{ item.name }}</p>
          </div>
          <button
            class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/40 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            @click.stop="store.removeItem(item.id)"
          >
            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- List view -->
      <div v-else class="space-y-0.5">
        <div
          v-for="item in store.items.value"
          :key="item.id"
          class="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer group transition-colors"
          :class="item.id === store.selectedId.value
            ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-300 dark:ring-blue-700'
            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'"
          @click="store.selectItem(item.id)"
        >
          <div class="w-8 h-8 flex-shrink-0 rounded bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] dark:bg-[repeating-conic-gradient(#374151_0%_25%,#1f2937_0%_50%)] bg-[length:6px_6px] flex items-center justify-center">
            <img :src="item.image.src" :alt="item.name" class="max-w-full max-h-full object-contain" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-700 dark:text-gray-300 truncate">{{ item.name }}</p>
            <p class="text-[10px] text-gray-400 dark:text-gray-500">{{ item.image.naturalWidth }} x {{ item.image.naturalHeight }}</p>
          </div>
          <button
            class="w-4 h-4 flex-shrink-0 rounded-full hover:bg-red-500 text-gray-400 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            @click.stop="store.removeItem(item.id)"
          >
            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
