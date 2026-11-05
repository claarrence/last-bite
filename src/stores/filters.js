import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useFiltersStore = defineStore('filters', () => {
  // state: one ref per filter

  // search term
  const query = ref('')
  // does not filter out listings, just decides which order they appear in
  const sortBy = ref('newest')

  // tags
  const foodType = ref('all')
  const selectedDietary = ref([])
  const availableNow = ref(false)


  function matchesFunction(listing, now) {
    // Food type: say no if the user picked a type and this listing is a different type
    if (foodType.value !== 'all' && listing.listing_type !== foodType.value) {
      return false
    }

    // Search check
    const trimLowerQuery = query.value.trim().toLowerCase()
    const listingDetails = ` ${listing.title} ${listing.address} ${listing.description || ''}`
      .toLowerCase()
      .trim()
    if (!listingDetails.includes(trimLowerQuery)) {
      return false
    }

    // Dietary check
    const listingTags = listing.dietary_tags || []
    for (const tag of selectedDietary.value) {
      if (!listingTags.includes(tag)) {
        return false
      }
    }

    // "Available now" check

    if (availableNow.value == true && new Date(listing.pickup_start) > now) {
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

    // "Available now" tag
    if (availableNow.value == true) {
      tags.push({ filter: 'availableNow', label: 'Available now' })
    }

    return tags
  })

  function removeTagFunction(tag) {
    // Turn off the one filter this tag stands for
    if (tag.filter == 'foodType') foodType.value = 'all'
    if (tag.filter == 'query') query.value = ''
    if (tag.filter == 'availableNow') availableNow.value = false
    if (tag.filter == 'selectedDietary')
      selectedDietary.value = selectedDietary.value.filter((t) => t !== tag.label)
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
