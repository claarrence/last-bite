<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ListingCard from '@/components/listings/ListingCard.vue'
import PostFoodButton from '@/components/PostFoodButton.vue'
import { useListingActions } from '@/composables/useListingActions'
import { getCurrentUser } from '@/utils/session'
import { displayStatus, getMyListings, photoUrl } from '@/utils/listings'

const listings = ref([])
const loading = ref(true)
const error = ref('')
const activeTab = ref('open')

const tabs = [
  { key: 'open', label: 'Active' },
  { key: 'closed', label: 'Closed' },
  { key: 'expired', label: 'Expired' },
]

const { busyId, pendingDelete, toggleStatus, requestDelete, cancelDelete, confirmDelete } =
  useListingActions({
    onUpdated: (updated) => {
      listings.value = listings.value.map((l) => (l.id === updated.id ? updated : l))
    },
    onDeleted: (deleted) => {
      listings.value = listings.value.filter((l) => l.id !== deleted.id)
    },
  })

onMounted(async () => {
  try {
    const user = await getCurrentUser()
    listings.value = await getMyListings(user.id)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

const withStatus = computed(() =>
  listings.value.map((l) => ({ listing: l, status: displayStatus(l) })),
)
const counts = computed(() => {
  const totals = { open: 0, closed: 0, expired: 0 }
  for (const item of withStatus.value) totals[item.status]++
  return totals
})
const activeTabLabel = computed(() =>
  tabs.find((tab) => tab.key === activeTab.value).label.toLowerCase(),
)
const visible = computed(() => withStatus.value.filter((x) => x.status === activeTab.value))
</script>

<template>
  <NavBar />

  <div class="container py-4">
    <h1 class="h2 page-title mb-3">My Listings</h1>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
    </div>

    <div v-else-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

    <template v-else>
      <ul class="nav nav-pills mb-4 flex-nowrap overflow-auto" role="tablist">
        <li v-for="tab in tabs" :key="tab.key" class="nav-item" role="presentation">
          <button
            type="button"
            class="nav-link text-nowrap"
            :class="{ active: activeTab === tab.key }"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :data-testid="`tab-${tab.key}`"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <span class="badge rounded-pill text-bg-light ms-1">{{ counts[tab.key] }}</span>
          </button>
        </li>
      </ul>

      <div
        v-if="!visible.length"
        class="empty-listings text-center text-secondary py-5"
        data-testid="empty-state"
      >
        <p class="mb-2">No {{ activeTabLabel }} listings.</p>
        <RouterLink
          v-if="activeTab === 'open'"
          to="/listing-form"
          class="btn btn-outline-success btn-sm"
        >
          Post surplus food
        </RouterLink>
      </div>

      <div v-else class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
        <div v-for="{ listing, status } in visible" :key="listing.id" class="col">
          <ListingCard
            :listing="listing"
            :status="status"
            :photo-src="photoUrl(listing.photo_path)"
          >
            <template #actions>
              <div class="d-flex flex-wrap gap-2">
                <RouterLink
                  :to="{ name: 'listing-edit', params: { id: listing.id } }"
                  class="btn btn-sm btn-outline-success"
                  >Edit</RouterLink
                >
                <button
                  v-if="status !== 'expired'"
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  :disabled="busyId === listing.id"
                  @click="toggleStatus(listing)"
                >
                  {{ listing.status === 'open' ? 'Close' : 'Reopen' }}
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger ms-auto"
                  :disabled="busyId === listing.id"
                  @click="requestDelete(listing)"
                >
                  Delete
                </button>
              </div>
            </template>
          </ListingCard>
        </div>
      </div>
    </template>
  </div>

  <PostFoodButton />

  <ConfirmDialog
    :open="!!pendingDelete"
    title="Delete this listing?"
    confirm-label="Delete"
    :busy="!!busyId"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  >
    <p class="mb-0">
      "{{ pendingDelete?.title }}" will be removed permanently. If people may already be on their
      way, close it instead.
    </p>
  </ConfirmDialog>
</template>
