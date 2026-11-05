<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  confirmLabel: { type: String, default: 'Confirm' },
  confirmVariant: { type: String, default: 'danger' },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <template v-if="open">
    <div
      class="modal d-block"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      data-testid="confirm-dialog"
      @keydown.esc="emit('cancel')"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5">{{ title }}</h2>
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              @click="emit('cancel')"
            ></button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              :disabled="busy"
              @click="emit('cancel')"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn"
              :class="`btn-${confirmVariant}`"
              :disabled="busy"
              data-testid="confirm-button"
              @click="emit('confirm')"
            >
              <span
                v-if="busy"
                class="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              ></span>
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop show"></div>
  </template>
</template>
