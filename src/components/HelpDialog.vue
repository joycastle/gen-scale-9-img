<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  close: []
}>()

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center" @click.self="emit('close')">
      <div class="absolute inset-0 bg-black/40" />
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-xl z-10">
          <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Slice9 Editor 使用说明</h2>
          <button
            class="w-6 h-6 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            @click="emit('close')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 space-y-4">
          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">上传图片</h3>
            <p>拖拽 PNG 到图片列表面板或点击 <strong>+</strong> 按钮选择文件，支持批量上传。上传后自动计算九宫格裁切区域。</p>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">图片列表</h3>
            <p>点击切换编辑对象，hover 出现删除按钮。标题栏可切换列表/网格视图。</p>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">编辑裁切区域</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>拖拽裁切线</strong> — 拖拽蓝色虚线调整区域，hover 显示坐标</li>
              <li><strong>Border T/B/L/R</strong> — 手动输入边距数值（对应 Cocos Sprite Frame Border）</li>
              <li><strong>方向键</strong> — hover 裁切线后按方向键 ±1px 微调</li>
              <li><strong>容差</strong> — 滑块调整自动检测灵敏度（0~30），点击"重新计算"应用</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">视图操作</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>滚轮</strong> — 以鼠标为中心缩放（10%~2000%）</li>
              <li><strong>中键拖拽</strong> — 平移画布</li>
              <li><strong>双击</strong> — 重新缩放适应窗口</li>
              <li>缩放 ≥ 400% 自动显示像素网格与标尺</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">预览</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>裁切结果</strong> — 四角拼合预览，即导出后的 .9.png 实际效果</li>
              <li><strong>拉伸预览</strong> — 九宫格拉伸预览，拖拽右侧/底部蓝色手柄调整目标尺寸</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">导出</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>Alpha Bleeding</strong> — 扩散不透明像素颜色到相邻透明像素，防止双线性插值黑边</li>
              <li><strong>导出当前</strong> — 下载 .9.png 和 .border.json</li>
              <li><strong>批量导出</strong> — 打包 ZIP（含所有 .9.png 和 border-config.json）</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">界面</h3>
            <p>面板分割条可拖拽调整大小，布局自动保存。点击重置按钮恢复默认布局。右上角切换亮色/暗色主题。</p>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
