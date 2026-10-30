<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { searchAddress } from '@/utils/onemap'

// v-model is the address text; `select` fires with { address, lat, lng } when a OneMap result is
// picked, `clear` fires when the user edits the text again (so stale coordinates are dropped), and
// `results` fires with each search's results so a map can show them.
const model = defineModel({ type: String, default: '' })
defineProps({
  id: { type: String, default: 'address' },
  invalid: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['select', 'clear', 'results'])

const results = ref([])
const open = ref(false)
const searching = ref(false)
const searchError = ref('')
const active = ref(-1)
let timer = null
let controller = null

function cancelSearch() {
  clearTimeout(timer)
  clearTimeout(blurTimer)
  controller?.abort()
  controller = null
  searching.value = false
}

let blurTimer = null
onBeforeUnmount(cancelSearch)

// Map picks also change the address text, so they must cancel any pending text search.
watch(
  model,
  () => {
    cancelSearch()
    results.value = []
    emit('results', [])
    searchError.value = ''
    open.value = false
    active.value = -1
  },
  { flush: 'sync' },
)

async function onInput() {
  emit('clear')
  await nextTick()
  cancelSearch()
  if (model.value.trim().length >= 3) timer = setTimeout(runSearch, 300)
}

async function runSearch() {
  const request = new AbortController()
  controller = request
  searching.value = true
  const query = model.value
  try {
    const matches = await searchAddress(query, { signal: request.signal })
    if (request.signal.aborted || controller !== request || model.value !== query) return
    results.value = matches
    emit('results', matches)
    active.value = -1
    open.value = true
  } catch (err) {
    if (request.signal.aborted || controller !== request) return
    results.value = []
    emit('results', [])
    searchError.value = err.message
    open.value = false
  } finally {
    if (controller === request) searching.value = false
  }
}

function choose(result) {
  cancelSearch()
  model.value = result.address
  emit('select', result)
  open.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    open.value = false
    return
  }
  if (!open.value || !results.value.length) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    if (active.value < 0) {
      active.value = step === 1 ? 0 : results.value.length - 1
    } else {
      active.value = (active.value + step + results.value.length) % results.value.length
    }
  } else if (event.key === 'Enter') {
    event.preventDefault()
    choose(results.value[active.value < 0 ? 0 : active.value])
  }
}

function onBlur() {
  blurTimer = setTimeout(() => (open.value = false), 150)
}
</script>

<template>
  <div class="position-relative">
    <div class="input-group has-validation">
      <input
        :id="id"
        v-model="model"
        type="text"
        class="form-control"
        :class="{ 'is-invalid': invalid }"
        :placeholder="placeholder"
        autocomplete="off"
        role="combobox"
        :aria-expanded="open"
        :aria-controls="`${id}-results`"
        aria-autocomplete="list"
        :aria-activedescendant="open && active >= 0 ? `${id}-option-${active}` : undefined"
        :aria-busy="searching"
        data-testid="address"
        @input="onInput"
        @keydown="onKeydown"
        @focus="results.length && (open = true)"
        @blur="onBlur"
      />
      <span
        class="input-group-text"
        :class="pinned ? 'text-success' : 'text-secondary'"
        :title="pinned ? 'Pickup location selected' : 'Select a pickup location'"
      >
        <span v-if="searching" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <span v-else aria-hidden="true">{{ pinned ? '✓' : '⌖' }}</span>
      </span>
      <slot name="feedback" />
    </div>

    <span v-if="searching" class="visually-hidden" role="status">Searching addresses…</span>
    <ul
      v-if="open && results.length"
      :id="`${id}-results`"
      class="list-group position-absolute w-100 shadow z-3"
      role="listbox"
      data-testid="address-results"
    >
      <li
        v-for="(result, i) in results"
        :key="`${result.address}-${result.lat}-${result.lng}`"
        :id="`${id}-option-${i}`"
        role="option"
        :aria-selected="i === active"
        class="list-group-item list-group-item-action"
        :class="{ active: i === active }"
        @pointerdown.prevent="choose(result)"
      >
        <div class="fw-semibold small">{{ result.label }}</div>
        <div class="small" :class="i === active ? 'text-white-50' : 'text-secondary'">
          {{ result.address }}
        </div>
      </li>
    </ul>
    <div
      v-else-if="open && !searching && !searchError && model.trim().length >= 3"
      class="form-text"
    >
      No addresses found.
    </div>
    <div v-if="searchError" class="form-text text-danger" role="alert" data-testid="address-error">
      {{ searchError }}
    </div>
  </div>
</template>

<style scoped>
.list-group {
  top: 100%;
  max-height: 18rem;
  overflow-y: auto;
  cursor: pointer;
}
.list-group-item.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
}
</style>
