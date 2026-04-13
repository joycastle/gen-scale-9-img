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
      <div class="relative bg-white dark:bg-[#252526] rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-[#444] sticky top-0 bg-white dark:bg-[#252526] rounded-t-xl z-10">
          <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Slice9 Editor 使用说明</h2>
          <button
            class="w-6 h-6 rounded-md hover:bg-gray-100 dark:hover:bg-[#3c3c3c] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">导入图片</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li>拖拽 PNG 文件或文件夹到图片列表面板，支持递归扫描子文件夹</li>
              <li>也可点击 <strong>+</strong> 按钮选择文件，支持多选</li>
              <li>导入时自动裁剪四周全透明边缘，并计算初始九宫格裁切区域</li>
              <li>同名图片自动去重</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">图片列表</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li>点击切换当前编辑图片，hover 出现删除按钮</li>
              <li>标题栏可切换 <strong>列表 / 网格</strong> 两种视图</li>
              <li>缩略图实时反映裁切结果</li>
              <li>点击垃圾桶按钮一键清空全部</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">编辑裁切区域</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>拖拽裁切线</strong> — 拖拽蓝色虚线调整可拉伸区域边界，hover 显示像素坐标</li>
              <li><strong>Border T/B/L/R</strong> — 手动输入边距数值（对应 Cocos Sprite Frame Border），回车应用</li>
              <li><strong>容差</strong> — 滑块调整自动检测灵敏度（0~30），越大越宽容相似像素</li>
              <li><strong>重新计算</strong> — 以当前容差重新自动检测裁切区域</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">视图操作</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>滚轮</strong> — 以鼠标位置为中心缩放（10% ~ 2000%）</li>
              <li><strong>鼠标中键拖拽</strong> — 平移画布</li>
              <li><strong>双击画布</strong> — 适应窗口大小（也可点击"适应"按钮）</li>
              <li>缩放 ≥ 400% 时自动显示像素网格</li>
              <li>顶部和左侧标尺随缩放自动调整刻度间距，右下角显示当前缩放百分比</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">快捷键</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>Ctrl/Cmd + Z</strong> — 撤销</li>
              <li><strong>Ctrl/Cmd + Shift + Z</strong> — 重做</li>
              <li><strong>Esc</strong> — 关闭此对话框</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">预览面板</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>裁切结果</strong> — 四角拼合预览，展示导出后 .9.png 的实际内容</li>
              <li><strong>拉伸预览</strong> — 模拟九宫格拉伸效果，拖拽右侧/底部/右下角蓝色手柄调整目标尺寸</li>
              <li><strong>Alpha Bleeding 预览</strong> — 显示 bleeding 处理后的 RGB 通道（alpha 强制为不透明），便于检查颜色扩散效果</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">导出</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li><strong>Alpha Bleeding</strong> — 勾选后，导出时将不透明像素颜色扩散到相邻透明像素，防止纹理采样时出现黑边</li>
              <li><strong>导出当前</strong> — 下载当前图片的 .9.png 和对应的 .border.json 配置文件</li>
              <li><strong>批量导出</strong> — 多张图片时可用，打包为 ZIP（含所有 .9.png 和统一的 border-config.json）</li>
              <li>.9.png 格式：四角像素 + 2px 透明边距，兼容蓝湖命名格式（如 .9@3x.png）</li>
            </ul>
          </section>

          <section>
            <h3 class="font-medium text-gray-800 dark:text-gray-200 mb-1">界面布局</h3>
            <ul class="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400">
              <li>面板支持拖拽分割条调整大小，也可拖拽标签页重新排列或合并面板</li>
              <li>布局自动保存到浏览器本地存储，刷新后恢复</li>
              <li>点击标题栏 <strong>重置布局</strong> 按钮恢复默认</li>
              <li>右上角切换亮色/暗色主题，跟随系统自动切换</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
