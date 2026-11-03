import { reactive } from 'vue'

const feedback = reactive({ active: false, label: '' })
const MINIMUM_DISPLAY_MS = 2000

// Start the real request immediately; keep its feedback visible for at least two seconds.
export function useActionFeedback() {
  async function runAction(label, action) {
    if (feedback.active) throw new Error('Please wait for the current action to finish.')
    feedback.active = true
    feedback.label = label
    const minimumDisplay = new Promise((resolve) => setTimeout(resolve, MINIMUM_DISPLAY_MS))
    try {
      return await action()
    } finally {
      // Also wait on errors, then let the caller show its normal error and preserve inputs.
      await minimumDisplay
      feedback.active = false
      feedback.label = ''
    }
  }

  return { feedback, runAction }
}
