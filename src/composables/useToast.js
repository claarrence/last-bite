import { reactive } from 'vue'

// One shared toast so a message can survive a route change
// (e.g. "Listing posted" shown on the detail page after creating).
const toast = reactive({ message: '', variant: 'success', visible: false })
let timer

export function useToast() {
  function show(message, variant = 'success') {
    toast.message = message
    toast.variant = variant
    toast.visible = true
    clearTimeout(timer)
    timer = setTimeout(hide, 4000)
  }

  function hide() {
    toast.visible = false
  }

  return { toast, show, hide }
}
