<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ReservationCard from '@/components/reservations/ReservationCard.vue'
import QuantityStepper from '@/components/reservations/QuantityStepper.vue'
import { useToast } from '@/composables/useToast'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { getCurrentUser } from '@/utils/session'
import {
  cancelReservation,
  getMyReservations,
  updateReservationQuantity,
} from '@/utils/reservations'
import { RESERVATION_TABS, reservationStatus } from '@/utils/reservationRules'
import { getMyReviews } from '@/utils/reviews'
import { vReveal } from '@/utils/reveal'

const { show: showToast } = useToast()
const { runAction } = useActionFeedback()

// Ids of reservations the user has already reviewed (one review per collected order).
const reviewedIds = ref([])

const reservations = ref([])
const loading = ref(true)
const error = ref('')
const activeTab = ref('reserved')

// Per-reservation quantity inputs and error messages, keyed by reservation id.
const quantityDrafts = ref({})
const rowErrors = ref({})
const busyId = ref(null)
const pendingCancel = ref(null)

onMounted(async () => {
  let user = null
  try {
    user = await getCurrentUser()
    reservations.value = await getMyReservations(user.id)
    for (const r of reservations.value) quantityDrafts.value[r.id] = r.quantity
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
  // Loaded after the bookings are shown, so a slow reviews request cannot hold up the page.
  if (user) await loadReviewedIds(user.id)
})

// If reviews cannot load, the bookings still work; review links just say "Write".
async function loadReviewedIds(userId) {
  try {
    const reviews = await getMyReviews(userId)
    reviewedIds.value = reviews.map((review) => review.reservation_id)
  } catch {
    reviewedIds.value = []
  }
}

// Collected orders still waiting for a review, used for the prompt.
const toReviewCount = computed(() => {
  let count = 0
  for (const r of reservations.value) {
    if (r.status === 'collected' && !reviewedIds.value.includes(r.id)) count++
  }
  return count
})

// 'reserved' | 'collected' | 'cancelled' | 'expired' (expired is worked out from the pickup time)
function statusOf(reservation) {
  return reservationStatus(reservation, reservation.listing.pickup_end)
}

const counts = computed(() => {
  const totals = { reserved: 0, collected: 0, cancelled: 0, expired: 0 }
  for (const reservation of reservations.value) {
    totals[statusOf(reservation)]++
  }
  return totals
})
const visible = computed(() =>
  reservations.value.filter((reservation) => statusOf(reservation) === activeTab.value),
)
const activeTabLabel = computed(() =>
  RESERVATION_TABS.find((tab) => tab.key === activeTab.value).label.toLowerCase(),
)

// Copy the database's answer onto the booking already on screen.
// (The database returns the reservation without its listing details.)
function replaceReservation(updated) {
  for (const reservation of reservations.value) {
    if (reservation.id === updated.id) {
      reservation.quantity = updated.quantity
      reservation.status = updated.status
    }
  }
  quantityDrafts.value[updated.id] = updated.quantity
}

async function saveQuantity(reservation) {
  if (busyId.value) return
  const quantity = quantityDrafts.value[reservation.id]
  if (!Number.isInteger(quantity) || quantity < 1) {
    rowErrors.value[reservation.id] = 'Enter a whole number of portions (at least 1).'
    return
  }
  busyId.value = reservation.id
  rowErrors.value[reservation.id] = ''
  try {
    // The database checks that enough portions are still available.
    const updated = await runAction('Updating your reservation…', () =>
      updateReservationQuantity(reservation.id, quantity),
    )
    replaceReservation(updated)
    showToast(
      `Reservation updated to ${updated.quantity} portion${updated.quantity === 1 ? '' : 's'}`,
    )
  } catch (err) {
    rowErrors.value[reservation.id] = err.message
  } finally {
    busyId.value = null
  }
}

function requestCancel(reservation) {
  pendingCancel.value = reservation
}

function closeCancelDialog() {
  if (!busyId.value) pendingCancel.value = null
}

async function confirmCancel() {
  if (!pendingCancel.value || busyId.value) return
  const reservation = pendingCancel.value
  busyId.value = reservation.id
  try {
    const updated = await runAction('Cancelling your reservation…', () =>
      cancelReservation(reservation.id),
    )
    replaceReservation(updated)
    pendingCancel.value = null
    showToast('Reservation cancelled')
  } catch (err) {
    showToast(err.message, 'danger')
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <NavBar />

  <div class="container page-content py-4" :aria-busy="loading">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h1 class="h2 page-title mb-0">My Reservations</h1>
      <RouterLink to="/#browse" class="btn btn-success">Browse food</RouterLink>
    </div>

    <div v-if="!loading && error" class="alert alert-danger" role="alert">{{ error }}</div>

    <template v-else-if="!loading">
      <div
        v-if="toReviewCount"
        class="alert alert-success d-flex flex-wrap align-items-center gap-2"
        role="status"
        data-testid="review-prompt"
      >
        <span>
          You have {{ toReviewCount }} collected order{{ toReviewCount === 1 ? '' : 's' }} to
          review. How was the food?
        </span>
        <button
          v-if="activeTab !== 'collected'"
          type="button"
          class="btn btn-sm btn-success ms-sm-auto"
          @click="activeTab = 'collected'"
        >
          Show collected orders
        </button>
      </div>

      <ul class="nav nav-pills mb-4 flex-nowrap overflow-auto" role="tablist">
        <li v-for="tab in RESERVATION_TABS" :key="tab.key" class="nav-item" role="presentation">
          <button
            type="button"
            class="nav-link text-nowrap"
            :class="{ active: activeTab === tab.key }"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :data-testid="`reservation-tab-${tab.key}`"
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
        data-testid="reservations-empty"
      >
        <p class="mb-2">No {{ activeTabLabel }} reservations.</p>
        <RouterLink
          v-if="activeTab === 'reserved'"
          to="/#browse"
          class="btn btn-outline-success btn-sm"
        >
          Find discounted food
        </RouterLink>
      </div>

      <div v-else class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
        <div v-for="reservation in visible" v-reveal="'lift'" :key="reservation.id" class="col">
          <ReservationCard :reservation="reservation" :status="activeTab">
            <template v-if="activeTab === 'reserved'" v-slot:actions>
              <form
                class="d-flex flex-wrap align-items-center gap-2"
                novalidate
                @submit.prevent="saveQuantity(reservation)"
              >
                <label :for="`qty-${reservation.id}`" class="small text-secondary">Portions</label>
                <QuantityStepper
                  :quantity="quantityDrafts[reservation.id]"
                  :input-id="`qty-${reservation.id}`"
                  :invalid="!!rowErrors[reservation.id]"
                  testid="reservation-quantity"
                  @change="quantityDrafts[reservation.id] = $event"
                />
                <button
                  type="submit"
                  class="btn btn-sm btn-outline-success"
                  :disabled="
                    busyId === reservation.id ||
                    quantityDrafts[reservation.id] === reservation.quantity
                  "
                  data-testid="save-quantity-button"
                >
                  Save
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger ms-auto"
                  :disabled="busyId === reservation.id"
                  data-testid="cancel-reservation-button"
                  @click="requestCancel(reservation)"
                >
                  Cancel booking
                </button>
              </form>
              <p v-if="rowErrors[reservation.id]" class="text-danger small mt-2 mb-0" role="alert">
                {{ rowErrors[reservation.id] }}
              </p>
            </template>
            <template v-else-if="activeTab === 'collected'" v-slot:actions>
              <RouterLink
                :to="{ name: 'review-form', params: { reservationId: reservation.id } }"
                class="btn btn-sm btn-outline-success"
                data-testid="review-link"
              >
                {{ reviewedIds.includes(reservation.id) ? 'Edit your review' : 'Write a review' }}
              </RouterLink>
            </template>
          </ReservationCard>
        </div>
      </div>
    </template>
  </div>

  <ConfirmDialog
    :open="!!pendingCancel"
    title="Cancel this reservation?"
    confirm-label="Cancel booking"
    :busy="!!busyId"
    @confirm="confirmCancel"
    @cancel="closeCancelDialog"
  >
    <p v-if="pendingCancel" class="mb-0">
      Your {{ pendingCancel.quantity }} portion{{ pendingCancel.quantity === 1 ? '' : 's' }} of "{{
        pendingCancel.listing.title
      }}" will be released for others. The booking stays in your history.
    </p>
  </ConfirmDialog>
</template>
