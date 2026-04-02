import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import ImagePanel from './components/ImagePanel.vue'
import ImageEditor from './components/ImageEditor.vue'
import CutPreview from './components/CutPreview.vue'
import StretchPreview from './components/StretchPreview.vue'

const app = createApp(App)
// Register panel components globally for dockview-vue's findComponent resolution
app.component('ImagePanel', ImagePanel)
app.component('ImageEditor', ImageEditor)
app.component('CutPreview', CutPreview)
app.component('StretchPreview', StretchPreview)
app.mount('#app')
