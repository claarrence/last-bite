import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// Measure the two logos once, then interpolate their positions on scroll.
// One animation frame per scroll keeps the effect smooth without an animation library.
export function useLandingMotion(logo, navbar) {
  const progress = ref(0)
  const ready = ref(false)
  const reducedMotion = ref(false)
  const start = ref({ x: 0, y: 0, font: 104, gap: 18, icon: 78, spacing: -5 })
  const finish = ref({ x: 0, y: 0 })
  let distance = 250
  let frame = 0
  let layoutFrame = 0
  let preference

  const active = computed(() => ready.value && !reducedMotion.value && !navbar.value?.menuOpen)
  const navOpacity = computed(() => (active.value ? Math.max(0, (progress.value - 0.9) / 0.1) : 1))
  const mix = (a, b) => a + (b - a) * progress.value
  const logoStyle = computed(() => ({
    transform: `translate3d(${mix(start.value.x, finish.value.x)}px, ${mix(start.value.y, finish.value.y)}px, 0)`,
    fontSize: `${mix(start.value.font, 26)}px`,
    letterSpacing: `${mix(start.value.spacing, -0.6)}px`,
    '--logo-gap': `${mix(start.value.gap, 10)}px`,
    '--logo-icon-size': `${mix(start.value.icon, 34)}px`,
    opacity: 1 - navOpacity.value,
  }))
  const foodStyle = computed(() =>
    active.value
      ? {
          transform: `translate3d(0, ${-35 * progress.value}px, 0) rotate(${-9 * progress.value}deg) scale(${1 - progress.value * 0.12})`,
        }
      : {},
  )

  function update() {
    frame = 0
    progress.value = Math.min(1, Math.max(0, window.scrollY / distance))
  }

  function queueUpdate() {
    if (!frame) frame = requestAnimationFrame(update)
  }

  function measure() {
    const source = logo.value?.querySelector('.brand-logo')
    const target = navbar.value?.brandElement
    if (!source || !target) return
    const sourceBox = source.getBoundingClientRect()
    const targetBox = target.getBoundingClientRect()
    const style = getComputedStyle(source)
    start.value = {
      x: sourceBox.left,
      y: sourceBox.top + window.scrollY,
      font: parseFloat(style.fontSize),
      gap: parseFloat(style.gap),
      icon: source.querySelector('svg').getBoundingClientRect().width,
      spacing: parseFloat(style.letterSpacing),
    }
    // Measure inside the navbar so route changes cannot shift the docking point.
    const navbarTop = target.closest('nav').getBoundingClientRect().top
    finish.value = { x: targetBox.left, y: targetBox.top - navbarTop }
    distance = Math.max(160, start.value.y - finish.value.y + sourceBox.height * 0.5)
    // Set the current pose before showing the floating logo, including on a scrolled refresh.
    update()
    ready.value = true
  }

  function checkPreference() {
    reducedMotion.value = preference.matches
    queueUpdate()
  }

  onMounted(() => {
    preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    checkPreference()
    // Let the router restore the page position before the first animated pose is measured.
    layoutFrame = requestAnimationFrame(measure)
    window.addEventListener('scroll', queueUpdate, { passive: true })
    window.addEventListener('resize', measure)
    preference.addEventListener('change', checkPreference)
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    cancelAnimationFrame(layoutFrame)
    window.removeEventListener('scroll', queueUpdate)
    window.removeEventListener('resize', measure)
    preference?.removeEventListener('change', checkPreference)
  })

  return { active, navOpacity, logoStyle, foodStyle }
}
