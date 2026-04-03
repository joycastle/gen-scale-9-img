import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import ImageList from './components/ImageList.vue'
import ImageEditor from './components/ImageEditor.vue'
import CutPreview from './components/CutPreview.vue'
import StretchPreview from './components/StretchPreview.vue'
import AlphaBleedingPreview from './components/AlphaBleedingPreview.vue'

const app = createApp(App)
// 全局注册面板组件，供 dockview-vue 解析
app.component('ImageList', ImageList)
app.component('ImageEditor', ImageEditor)
app.component('CutPreview', CutPreview)
app.component('StretchPreview', StretchPreview)
app.component('AlphaBleedingPreview', AlphaBleedingPreview)
app.mount('#app')
