import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'lastbite-filters'

// Filters saved by an earlier visit, or {} if there are none. localStorage only stores
// strings, so they are saved as JSON text. It can also be blocked (e.g. private browsing).
function loadSavedFilters() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

export const useFiltersStore = defineStore('filters', () => {
  // state: one ref per filter, starting from the saved filters when there are any
  const saved = loadSavedFilters()

  // search term
  const query = ref(typeof saved.query === 'string' ? saved.query : '')
  // does not filter out listings, just decides which order they appear in.
  // Not saved: "Nearest to me" would ask for the user's location as soon as the page opens.
  const sortBy = ref('newest')

  // tags
  const foodType = ref(['free', 'discounted'].includes(saved.foodType) ? saved.foodType : 'all')
  const selectedDietary = ref(Array.isArray(saved.selectedDietary) ? saved.selectedDietary : [])
  const availableNow = ref(saved.availableNow === true)

  // Save whenever a filter changes, so they survive a page refresh.
  // `deep` so ticking a checkbox (which changes the array's contents) also counts.
  watch(
    [query, foodType, selectedDietary, availableNow],
    () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            query: query.value,
            foodType: foodType.value,
            selectedDietary: selectedDietary.value,
            availableNow: availableNow.value,
          }),
        )
      } catch {
        // Storage is full or blocked: the filters still work, they just won't be remembered.
      }
    },
    { deep: true },
  )

  function matchesFunction(listing, now) {
    // Food type: say no if the user picked a type and this listing is a different type
    if (foodType.value !== 'all' && listing.listing_type !== foodType.value) {
      return false
    }

    // Search: say no if the typed text isn't in the title, address or description
    const search = query.value.trim().toLowerCase()
    const details = `${listing.title} ${listing.address} ${listing.description || ''}`.toLowerCase()
    if (!details.includes(search)) {
      return false
    }

    // Dietary: say no unless the listing has every tag the user ticked
    const listingTags = listing.dietary_tags ?? []
    if (!selectedDietary.value.every((tag) => listingTags.includes(tag))) {
      return false
    }

    // Available now: say no if the toggle is on and pickup hasn't started yet
    if (availableNow.value && new Date(listing.pickup_start) > now) {
      return false
    }

    return true
  }

  function clearAllFunction() {
    query.value = ''
    foodType.value = 'all'
    selectedDietary.value = []
    availableNow.value = false
  }

  const activeTagsComputed = computed(() => {
    const tags = []

    if (foodType.value !== 'all') {
      tags.push({
        filter: 'foodType',
        label: foodType.value === 'free' ? 'Free buffet' : 'Reservation food',
      })
    }

    if (query.value.trim() !== '') {
      tags.push({ filter: 'query', label: query.value.trim() })
    }

    if (selectedDietary.value !== '') {
      for (const tag of selectedDietary.value) {
        tags.push({ filter: 'selectedDietary', label: tag })
      }
    }

    if (availableNow.value) {
      tags.push({ filter: 'availableNow', label: 'Available now' })
    }

    return tags
  })

  // Turns off the one filter a tag stands for; other ticked dietary options stay ticked
  function removeTagFunction(tag) {
    if (tag.filter === 'foodType') foodType.value = 'all'
    if (tag.filter === 'query') query.value = ''
    if (tag.filter === 'availableNow') availableNow.value = false
    if (tag.filter === 'selectedDietary') {
      selectedDietary.value = selectedDietary.value.filter((t) => t !== tag.label)
    }
  }

  return {
    query,
    foodType,
    selectedDietary,
    availableNow,
    sortBy,
    matchesFunction,
    clearAllFunction,
    activeTagsComputed,
    removeTagFunction,
  }
})
