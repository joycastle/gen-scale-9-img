<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  params: {
    api: {
      title?: string
      onDidTitleChange?: (cb: (e: { title: string }) => void) => { dispose: () => void }
    }
    [key: string]: any
  }
}>()

const title = ref(props.params.api?.title ?? '')

let unsub: { dispose: () => void } | undefined
onMounted(() => {
  // 同步一次，因为 api.title 可能在 init 之后才可用
  if (props.params.api?.title) {
    title.value = props.params.api.title
  }
  unsub = props.params.api?.onDidTitleChange?.((event) => {
    title.value = event.title
  })
})
onBeforeUnmount(() => unsub?.dispose())
</script>

<template>
  <div class="dv-default-tab">
    <div class="dv-default-tab-content">{{ title }}</div>
  </div>
</template>
