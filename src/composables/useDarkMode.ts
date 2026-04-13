import { ref } from 'vue'

const isDark = ref(false)
let mediaQuery: MediaQueryList | null = null

function apply() {
  document.documentElement.classList.toggle('dark', isDark.value)
}

function onSystemChange(e: MediaQueryListEvent) {
  isDark.value = e.matches
  apply()
}

export function useDarkMode() {
  function init() {
    const stored = localStorage.getItem('slice9-dark')
    if (stored !== null) {
      isDark.value = stored === 'true'
    } else {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      isDark.value = mediaQuery.matches
      mediaQuery.addEventListener('change', onSystemChange)
    }
    apply()
  }

  function toggle() {
    isDark.value = !isDark.value
    localStorage.setItem('slice9-dark', String(isDark.value))
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', onSystemChange)
      mediaQuery = null
    }
    apply()
  }

  return { isDark, init, toggle }
}
