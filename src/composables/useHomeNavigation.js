import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'

const homeEntrance = ref(0)

export function useHomeNavigation() {
  const router = useRouter()
  const homeHref = router.resolve({ name: 'home' }).href

  async function goHome(event) {
    // Keep normal browser behaviour for opening the logo link in another tab.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    const alreadyHome = router.currentRoute.value.name === 'home'
    if (!alreadyHome) homeEntrance.value++
    await router.push({ name: 'home' })
    if (alreadyHome) homeEntrance.value++
    await nextTick()
    // Stop the previous smooth scroll after its compositor update reaches the page.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return { homeHref, goHome, homeEntrance }
}
