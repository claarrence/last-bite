<script setup>
import { computed, onMounted, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { getListingReservations, markReservationCollected } from '@/utils/reservations'
import { RESERVATION_BADGES, reservationStatus, reservationTotal } from '@/utils/reservationRules'
import { formatPrice } from '@/utils/format'

// Listing owner's view: every reservation for this listing, and a form to
// confirm a collection with the customer's pickup number.
const props = defineProps({
  listingId: { type: String, required: true },
  pickupEnd: { type: String, required: true },
})

const { show: showToast } = useToast()
const { runAction } = useActionFeedback()

const reservations = ref([])
const loading = ref(true)
const loadError = ref('')
const pickupCode = ref('')
const collectError = ref('')
const busy = ref(false)

async function loadReservations() {
  loading.value = true
  loadError.value = ''
  try {
    reservations.value = await getListingReservations(props.listingId)
  } catch (err) {
    loadError.value = `Could not load reservations: ${err.message}`
  } finally {
    loading.value = false
  }
}
onMounted(loadReservations)

// { label, cls } for the status badge of one reservation.
function badgeFor(reservation) {
  return RESERVATION_BADGES[reservationStatus(reservation, props.pickupEnd)]
}

function totalFor(reservation) {
  return formatPrice(reservationTotal(reservation.quantity, reservation.unit_price))
}

// Portions booked but not yet handed over.
const awaitingPortions = computed(() => {
  let total = 0
  for (const r of reservations.value) {
    if (reservationStatus(r, props.pickupEnd) === 'reserved') total += r.quantity
  }
  return total
})

async function confirmCollection() {
  if (busy.value || !pickupCode.value) return
  busy.value = true
  collectError.value = ''
  try {
    const updated = await runAction('Confirming collection…', () =>
      markReservationCollected(props.listingId, pickupCode.value),
    )
    for (const reservation of reservations.value) {
      if (reservation.id === updated.id) reservation.status = updated.status
    }
    pickupCode.value = ''
    showToast(`${updated.pickup_code} marked as collected`)
  } catch (err) {
    // Keep the typed reference so a typo can be corrected.
    collectError.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section
    class="border-top pt-3 mt-3"
    aria-labelledby="provider-reservations-heading"
    data-testid="provider-reservations"
    :aria-busy="loading"
  >
    <h2 id="provider-reservations-heading" class="h6 fw-semibold">Reservations</h2>

    <div v-if="!loading && loadError" class="alert alert-danger" role="alert">
      {{ loadError }}
      <button type="button" class="btn btn-sm btn-outline-danger ms-2" @click="loadReservations">
        Try again
      </button>
    </div>

    <p v-else-if="!loading && !reservations.length" class="text-secondary small mb-0">
      No reservations yet.
    </p>

    <template v-else-if="!loading">
      <form class="mb-3" novalidate @submit.prevent="confirmCollection">
        <label for="pickup-code" class="form-label small fw-semibold"
          >Customer's pickup number</label
        >
        <div class="d-flex flex-wrap gap-2">
          <input
            id="pickup-code"
            v-model.trim="pickupCode"
            type="text"
            class="form-control w-auto"
            :class="{ 'is-invalid': collectError }"
            inputmode="numeric"
            placeholder="e.g. 482913"
            autocomplete="off"
            data-testid="pickup-code-input"
          />
          <button
            type="submit"
            class="btn btn-success"
            :disabled="busy || !pickupCode"
            data-testid="mark-collected-button"
          >
            <span
              v-if="busy"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            Mark collected
          </button>
        </div>
        <p v-if="collectError" class="text-danger small mt-2 mb-0" role="alert">
          {{ collectError }}
        </p>
      </form>

      <p class="small text-secondary mb-2">
        {{ awaitingPortions }} portion{{ awaitingPortions === 1 ? '' : 's' }} awaiting collection
      </p>
      <ul class="list-group">
        <li
          v-for="reservation in reservations"
          :key="reservation.id"
          class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2"
          data-testid="provider-reservation"
        >
          <span>
            <strong class="font-monospace">{{ reservation.pickup_code }}</strong>
            · {{ reservation.quantity }} portion{{ reservation.quantity === 1 ? '' : 's' }} ·
            {{ totalFor(reservation) }}
          </span>
          <span class="badge rounded-pill" :class="badgeFor(reservation).cls">{{
            badgeFor(reservation).label
          }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>
