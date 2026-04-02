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
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
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
        <div class="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 space-y-5">
          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1.5">上传图片</h3>
            <p>将 PNG 图片直接拖拽到左侧图片列表面板的任意位置，或点击标题栏的 <strong>+</strong> 按钮选择文件。支持多文件批量上传。上传后自动分析并计算最佳九宫格裁切区域。</p>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1.5">图片列表</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li>点击图片切换当前编辑对象</li>
              <li>标题栏可切换 <strong>列表</strong> / <strong>网格</strong> 视图</li>
              <li>hover 图片右上角出现删除按钮</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1.5">编辑裁切区域</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>拖拽裁切线</strong> — 直接拖拽编辑器中的蓝色虚线来调整裁切区域，hover 时线条高亮并显示坐标</li>
              <li><strong>Board T/B/L/R</strong> — 在工具栏手动输入数值，对应 Cocos Creator 的 Sprite Frame Border 设置（Top/Bottom/Left/Right 边距），裁切线间距至少 2px</li>
              <li><strong>方向键微调</strong> — hover 裁切线后按方向键 ±1px 精确调整位置</li>
              <li><strong>容差滑块</strong> — 调整自动检测灵敏度（0 = 精确匹配像素，值越大越宽松，适合有渐变或抗锯齿的图片，最大 30）</li>
              <li><strong>重新计算</strong> — 基于当前容差值重新自动检测裁切区域</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1.5">编辑器视图操作</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>鼠标滚轮</strong> — 以鼠标位置为中心缩放画布（0.1x ~ 20x）</li>
              <li><strong>鼠标中键拖拽</strong> — 平移画布</li>
              <li><strong>双击画布</strong> — 重置缩放，适应窗口</li>
              <li><strong>适应按钮</strong> — 同上，重置缩放</li>
              <li>缩放超过 400% 时自动显示<strong>像素网格</strong>，顶部和左侧有<strong>标尺刻度</strong></li>
              <li>右下角显示当前缩放百分比</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1.5">预览面板</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>裁切结果</strong>（上方）— 展示导出后的 .9.png 实际样子：四个角拼合，中间可拉伸区域已移除</li>
              <li><strong>拉伸效果</strong>（下方）— 展示九宫格拉伸到指定尺寸后的效果</li>
              <li>拖拽拉伸预览的<strong>四个角蓝色手柄</strong>可实时调整预览目标尺寸</li>
              <li>两个预览区之间的<strong>水平分割条</strong>可拖拽调整上下比例</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1.5">导出</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>Alpha Bleeding</strong> — 勾选后导出时自动将不透明像素的颜色扩散到相邻透明像素（alpha 保持 0），防止游戏引擎双线性插值产生黑边</li>
              <li><strong>导出当前</strong> — 同时下载 .9.png 切图 和 .board.json 配置文件</li>
              <li><strong>批量导出</strong>（2 张以上）— 打包为 ZIP，包含所有 .9.png 和统一的 board-config.json</li>
              <li>board.json 格式: <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">{"imageName": {"top":12, "bottom":15, "left":18, "right":20}}</code></li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1.5">界面布局</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li>左中右三栏之间的<strong>分割条</strong>可拖拽调整宽度，布局自动保存</li>
              <li>右上角 <strong>月亮/太阳</strong> 图标切换亮色/暗色主题，偏好自动保存</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
