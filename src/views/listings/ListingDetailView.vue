<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import LocationMap from '@/components/LocationMap.vue'
import ReserveForm from '@/components/reservations/ReserveForm.vue'
import ProviderReservations from '@/components/reservations/ProviderReservations.vue'
import StatusUpdates from '@/components/status/StatusUpdates.vue'
import StarRating from '@/components/reviews/StarRating.vue'
import { useListingActions } from '@/composables/useListingActions'
import { getCurrentUser } from '@/utils/session'
import { displayStatus, getListing, photoUrl } from '@/utils/listings'
import { getActiveReservation, getReservedQuantities } from '@/utils/reservations'
import { remainingPortions } from '@/utils/reservationRules'
import { quantityLevelLabel, UNKNOWN_ALLERGEN } from '@/utils/listingOptions'
import { formatPickupWindow, formatPrice } from '@/utils/format'
import { pickupCountdown } from '@/utils/countdown'
import { listingCoords } from '@/utils/map'
import { getEstablishmentReviews } from '@/utils/reviews'
import { summarizeReviews } from '@/utils/reviewRules'
import { subscribeToListingUpdates, getListingUpdates, isVerifiedRecently } from '@/utils/statusUpdates'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const listing = ref(null)
const userId = ref(null)
const loading = ref(true)
const error = ref('')

const { busyId, pendingDelete, toggleStatus, requestDelete, cancelDelete, confirmDelete } =
  useListingActions({
    onUpdated: (updated) => {
      listing.value = updated
    },
    onDeleted: () => router.push({ name: 'my-listings' }),
  })

// Reservation details for discounted listings, loaded separately so a
// reservation problem does not hide the rest of the listing.
const reservedCount = ref(0)
const activeReservation = ref(null)
const reservationError = ref('')

async function loadReservedCount() {
  const totals = await getReservedQuantities([listing.value.id])
  reservedCount.value = totals[listing.value.id] || 0
}

async function loadReservationInfo() {
  reservationError.value = ''
  try {
    await loadReservedCount()
    if (userId.value && !isOwner.value) {
      activeReservation.value = await getActiveReservation(listing.value.id, userId.value)
    }
  } catch (err) {
    reservationError.value = `Could not load reservations: ${err.message}`
  }
}

// Provider rating summary, shown above the reviews link. Loaded separately and
// silently skipped on failure, since the link still leads to the full reviews.
const providerSummary = ref(null)

async function loadProviderSummary() {
  try {
    const reviews = await getEstablishmentReviews(listing.value.owner_id)
    providerSummary.value = summarizeReviews(reviews)
  } catch {
    providerSummary.value = null
  }
}

const updates = ref([])

async function loadUpdates() {
  try {
    updates.value = await getListingUpdates(listing.value.id)
  } catch {
    updates.value = []
  }
}

function addUpdate(update) {
  if (updates.value.some((u) => u.id === update.id)) return
  updates.value = [update, ...updates.value].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  )
}

let stopListening = null

onMounted(async () => {
  try {
    userId.value = (await getCurrentUser())?.id ?? null
    listing.value = await getListing(props.id)
    if (!listing.value) error.value = 'This listing no longer exists.'
    else {
      const jobs = [loadUpdates()]
      if (listing.value.listing_type === 'discounted') {
        jobs.push(loadReservationInfo(), loadProviderSummary())
      }
      await Promise.all(jobs)
      stopListening = subscribeToListingUpdates(listing.value.id, addUpdate)
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

// The new reservation comes back from the database, so only the count needs refreshing.
async function onReserved(reservation) {
  activeReservation.value = reservation
  try {
    await loadReservedCount()
  } catch {
    // The booking succeeded; an outdated "portions left" is fixed on the next visit.
  }
}

const isOwner = computed(() => listing.value && listing.value.owner_id === userId.value)
const remaining = computed(() =>
  listing.value ? remainingPortions(listing.value.quantity_total, reservedCount.value) : 0,
)
// Only listings whose address was picked on the map have coordinates.
const coords = computed(() => listingCoords(listing.value))
const directionsUrl = computed(() =>
  coords.value
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords.value.lat},${coords.value.lng}`
    : '',
)

const isDiscounted = computed(() => listing.value?.listing_type === 'discounted')
const status = computed(() => (listing.value ? displayStatus(listing.value) : ''))

const statusInfo = computed(
  () =>
    ({
      open: { label: 'Available', cls: 'badge-green' },
      closed: { label: 'Closed', cls: 'badge-grey' },
      expired: { label: 'Pickup ended', cls: 'badge-ink' },
    })[status.value],
)

// Live "Ends in 2h 15m" chip: the time is refreshed every 30 seconds.
const now = ref(new Date())
let timer = null
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 30 * 1000)
})
onUnmounted(() => {
  clearInterval(timer)
  stopListening?.()
})

const countdown = computed(() => {
  if (!listing.value || status.value !== 'open') return null
  return pickupCountdown(listing.value.pickup_start, listing.value.pickup_end, now.value)
})

const verified = computed(() => isVerifiedRecently(updates.value, now.value))
const reportedGone = computed(() => updates.value[0]?.status === 'all_gone')
</script>

<template>
  <NavBar />

  <div class="container page-content py-4" :aria-busy="loading">
    <div v-if="!loading && error" class="alert alert-danger" role="alert">
      {{ error }} <RouterLink to="/my-listings" class="alert-link">Back to My Listings</RouterLink>
    </div>

    <article v-else-if="!loading" class="row g-4" data-testid="listing-detail">
      <div class="col-md-5">
        <div class="ratio ratio-4x3 rounded-3 overflow-hidden bg-body-secondary shadow-sm">
          <img
            v-if="listing.photo_path"
            :src="photoUrl(listing.photo_path)"
            :alt="listing.title"
            class="object-fit-cover w-100 h-100"
          />
          <div v-else class="d-flex align-items-center justify-content-center bg-warning-subtle">
            <span role="img" aria-label="Food" style="font-size: 4rem">🍱</span>
          </div>
        </div>

        <section v-if="coords" class="mt-4" data-testid="detail-map">
          <div class="d-flex justify-content-between align-items-baseline mb-2">
            <h2 class="h6 fw-semibold mb-0">Pickup location</h2>
            <a :href="directionsUrl" target="_blank" rel="noopener noreferrer" class="small"
              >Get directions ↗</a
            >
          </div>
          <LocationMap :lat="coords.lat" :lng="coords.lng" readonly />
        </section>
      </div>

      <div class="col-md-7">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span class="badge rounded-pill" :class="isDiscounted ? 'badge-peach' : 'badge-sand'">
            {{ isDiscounted ? 'Discounted · Reservation required' : 'Free · Walk-in collection' }}
          </span>
          <span class="badge rounded-pill" :class="statusInfo.cls" data-testid="detail-status">
            {{ statusInfo.label }}
          </span>
          <span
            v-if="countdown"
            class="countdown-chip"
            :class="{ 'is-urgent': countdown.urgent }"
            data-testid="detail-countdown"
            >{{ countdown.label }}</span>
          <span v-if="verified" class="badge rounded-pill badge-green" data-testid="verified-badge">
            ✓ Verified recently
          </span>
        </div>

        <div v-if="reportedGone" class="alert alert-secondary py-2 small" role="status">
          Someone at the pickup spot reported this is all gone.
          <template v-if="isOwner">You can delete this listing.</template>
        </div>

        <h1 class="display-6 page-title text-break" data-testid="detail-title">
          {{ listing.title }}
        </h1>

        <p class="fs-4 fw-bold text-success mb-1">
          {{ isDiscounted ? `${formatPrice(listing.price)} each` : 'Free' }}
        </p>
        <p class="text-secondary" data-testid="detail-quantity">
          {{
            isDiscounted
              ? `${remaining} of ${listing.quantity_total} portions left`
              : `Quantity: ${quantityLevelLabel(listing.quantity_level)}`
          }}
        </p>

        <p v-if="listing.description" class="text-break mb-4" style="white-space: pre-line">
          {{ listing.description }}
        </p>

        <div
          v-if="isDiscounted && providerSummary"
          class="d-flex align-items-center gap-2 small mb-1"
          data-testid="provider-rating"
        >
          <template v-if="providerSummary.count">
            <span class="fw-bold">{{ providerSummary.average.toFixed(1) }}</span>
            <StarRating :rating="providerSummary.average" readonly />
            <span class="text-secondary">
              ({{ providerSummary.count }} review{{ providerSummary.count === 1 ? '' : 's' }})
            </span>
          </template>
          <span v-else class="text-secondary">No reviews yet</span>
        </div>
        <p v-if="isDiscounted" class="small mb-4">
          <RouterLink
            :to="{ name: 'establishment', params: { id: listing.owner_id } }"
            data-testid="provider-reviews-link"
            >Provider reviews</RouterLink
          >
        </p>

        <dl class="row small gy-2 mb-4">
          <dt class="col-sm-4">Pickup time</dt>
          <dd class="col-sm-8">
            {{ formatPickupWindow(listing.pickup_start, listing.pickup_end) }}
          </dd>
          <dt class="col-sm-4">Pickup address</dt>
          <dd class="col-sm-8 text-break">{{ listing.address }}</dd>
          <template v-if="listing.collection_instructions">
            <dt class="col-sm-4">Collection instructions</dt>
            <dd class="col-sm-8 text-break">{{ listing.collection_instructions }}</dd>
          </template>
          <dt class="col-sm-4">Dietary info</dt>
          <dd class="col-sm-8">
            <span v-if="!listing.dietary_tags.length" class="text-secondary">None specified</span>
            <span
              v-for="tag in listing.dietary_tags"
              :key="tag"
              class="badge text-bg-light border me-1"
              >{{ tag }}</span
            >
          </dd>
          <dt class="col-sm-4">Allergens</dt>
          <dd class="col-sm-8">
            <span v-if="!listing.allergens.length" class="text-secondary">None listed</span>
            <span
              v-for="a in listing.allergens"
              :key="a"
              class="badge border me-1"
              :class="
                a === UNKNOWN_ALLERGEN
                  ? 'text-bg-light text-secondary'
                  : 'bg-danger-subtle text-danger-emphasis'
              "
            >
              {{ a === UNKNOWN_ALLERGEN ? 'Unknown — ask the provider' : a }}
            </span>
          </dd>
        </dl>

        <div
          v-if="isOwner"
          class="d-flex flex-wrap gap-2 border-top pt-3"
          data-testid="owner-actions"
        >
          <RouterLink
            :to="{ name: 'listing-edit', params: { id: listing.id } }"
            class="btn btn-success"
            data-testid="edit-button"
            >Edit</RouterLink
          >
          <button
            type="button"
            class="btn btn-outline-secondary"
            :disabled="busyId === listing.id"
            data-testid="toggle-status-button"
            @click="toggleStatus(listing)"
          >
            {{ listing.status === 'open' ? 'Close to new bookings' : 'Reopen' }}
          </button>
          <button
            type="button"
            class="btn btn-outline-danger ms-sm-auto"
            :disabled="busyId === listing.id"
            data-testid="delete-button"
            @click="requestDelete(listing)"
          >
            Delete
          </button>
        </div>

        <template v-if="isDiscounted">
          <div v-if="reservationError" class="alert alert-warning mt-3 mb-0" role="alert">
            {{ reservationError }}
          </div>
          <ProviderReservations
            v-else-if="isOwner"
            :listing-id="listing.id"
            :pickup-end="listing.pickup_end"
          />
          <ReserveForm
            v-else
            :listing="listing"
            :remaining="remaining"
            :status="status"
            :user-id="userId"
            :active-reservation="activeReservation"
            @reserved="onReserved"
          />
        </template>
        <StatusUpdates :listing="listing" :user-id="userId" :updates="updates" :now="now" @posted="addUpdate" />
      </div>
    </article>
  </div>

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
