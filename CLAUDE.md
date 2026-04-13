# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指引。

## 项目

Slice9 Editor — 一个将普通 PNG 图片转换为 `.9.png`（九宫格）拉伸图片的在线编辑器。

## 命令

```bash
npm run dev       # 启动开发服务器
npm run build     # 类型检查 (vue-tsc) 后使用 Vite 构建
npm run preview   # 预览生产构建
```

没有配置测试框架，也没有单独的 linter 配置，类型检查依赖 `tsconfig.json` 的 strict 模式（`noUnusedLocals`、`noUnusedParameters`）。

## 架构

Vue 3 + TypeScript + Vite，Tailwind CSS 做样式（class 模式的暗色模式）。

### 布局：Dockview 面板

`App.vue` 中的 `DockviewVue` 管理可拖拽的面板布局。面板组件在 `main.ts` 中**全局注册**（ImageList、ImageEditor、CutPreview、StretchPreview、AlphaBleedingPreview、SimpleTab），以便 Dockview 通过名称字符串解析。布局状态持久化到 `localStorage`，key 为 `slice9-dock-layout`。

### 状态：`useAppStore`（单例 composable）

状态定义在模块级别（不在 composable 函数内部），所有调用者共享同一份响应式 ref。包含：`items`（`ImageItem` 列表）、`selectedId`、undo/redo 栈（`SliceRegion[][]` 快照）、`enableAlphaBleeding`。

关键方法：`updateRegion`（带 undo）、`updateRegionSilent`（不记录 undo）、`recompute`、`undo`/`redo`。

### 核心算法：`src/utils/sliceAlgorithm.ts`

`computeSliceRegion(imageData, tolerance)` 通过寻找最长的相似列连续区间和相似行连续区间来自动检测可拉伸区域（像素级 RGBA 比较，支持容差）。`sliceRegionToBorder` 将区域坐标转换为 Android `.9.png` 的 border 格式。

### 图片处理流程

1. 用户拖入 PNG 文件 → `ImageEditor` 加载图片
2. `computeSliceRegion` 设置初始切片边界
3. `useDragInteraction` 处理 canvas 上的鼠标拖拽切片线（左/右/上/下）、键盘方向键微调、Cmd+Z 撤销
4. 导出：`exportSlice9` 在四个角绘制并留出 2px 透明边框间距（符合 `.9.png` 规范），可选应用 alpha bleeding

### 核心类型（`src/types.ts`）

- `SliceRegion`：`{ left, right, top, bottom }` — 可拉伸区域边缘的像素坐标
- `BorderConfig`：`{ top, bottom, left, right }` — Android border 值
- `ImageItem`：每个图片的完整状态，包括 `HTMLImageElement | ImageBitmap`、`ImageData`、`sliceRegion`、`tolerance`

### Composables

- `useAppStore` — 全局状态（单例模式）
- `useDarkMode` — class 模式的暗色模式切换
- `useDragInteraction` — canvas 上的鼠标/键盘交互，用于编辑切片边界
