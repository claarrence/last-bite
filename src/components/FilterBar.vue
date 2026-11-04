<script setup>
// "Available now" and dietary checkboxes, plus a removable chip for every active filter.
// Used on both Browse and the map; both read and write the same filters store.
import FilterTag from '@/components/FilterTag.vue'
import { DIETARY_TAGS } from '@/utils/listingOptions'
import { useFiltersStore } from '@/stores/filters'

const filters = useFiltersStore()
</script>

<template>
  <div
    class="d-flex flex-wrap align-items-center gap-2 mb-3"
    role="group"
    aria-label="More filters"
  >
    <div class="form-check form-check-inline mb-0 me-3">
      <input
        id="filter-available-now"
        v-model="filters.availableNow"
        type="checkbox"
        class="form-check-input"
      />
      <label class="form-check-label small fw-semibold" for="filter-available-now"
        >Available now</label
      >
    </div>
    <span class="small text-secondary me-1">Dietary</span>
    <div v-for="tag in DIETARY_TAGS" :key="tag" class="form-check form-check-inline mb-0">
      <input
        :id="`filter-${tag}`"
        v-model="filters.selectedDietary"
        type="checkbox"
        :value="tag"
        class="form-check-input"
      />
      <label class="form-check-label small" :for="`filter-${tag}`">{{ tag }}</label>
    </div>
  </div>
  <div
    v-if="filters.activeTagsComputed.length"
    class="d-flex flex-wrap align-items-center gap-2 mb-3"
    aria-label="Active filters"
    data-testid="active-filters"
  >
    <FilterTag
      v-for="tag in filters.activeTagsComputed"
      :key="`${tag.filter}-${tag.label}`"
      :label="tag.label"
      @remove="filters.removeTagFunction(tag)"
    />
    <button
      v-if="filters.activeTagsComputed.length > 1"
      type="button"
      class="btn btn-link btn-sm text-secondary"
      @click="filters.clearAllFunction()"
    >
      Clear all
    </button>
  </div>
</template>
