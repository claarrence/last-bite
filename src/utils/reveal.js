// One small directive for scroll reveals, with no animation library.
const observers = new WeakMap()

export const vReveal = {
  mounted(element, binding) {
    if (
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return
    element.classList.add('scroll-reveal', 'reveal-pending')
    if (binding.value === 'lift') element.classList.add('reveal-lift')
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        element.classList.remove('reveal-pending')
        observer.disconnect()
      },
      { threshold: 0.08 },
    )
    observers.set(element, observer)
    observer.observe(element)
  },
  unmounted(element) {
    observers.get(element)?.disconnect()
    observers.delete(element)
  },
}
