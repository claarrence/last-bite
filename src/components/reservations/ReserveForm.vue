<script setup>
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import QuantityStepper from '@/components/reservations/QuantityStepper.vue'
import { useToast } from '@/composables/useToast'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { createReservation } from '@/utils/reservations'
import { reservationTotal, validateQuantity } from '@/utils/reservationRules'
import { formatPrice } from '@/utils/format'

// Reservation panel shown to customers on a discounted listing's detail page.
const props = defineProps({
  listing: { type: Object, required: true },
  remaining: { type: Number, required: true },
  // 'open' | 'closed' | 'expired' (from displayStatus)
  status: { type: String, required: true },
  userId: { type: String, default: null },
  // The customer's existing active reservation for this listing, if any.
  activeReservation: { type: Object, default: null },
})
const emit = defineEmits(['reserved'])

const route = useRoute()
const { show: showToast } = useToast()
const { runAction } = useActionFeedback()

const quantity = ref(1)
const error = ref('')
const busy = ref(false)

const totalText = computed(() => {
  if (!Number.isInteger(quantity.value) || quantity.value < 1) return ''
  return formatPrice(reservationTotal(quantity.value, props.listing.price))
})

const activeTotal = computed(() =>
  props.activeReservation
    ? formatPrice(
        reservationTotal(props.activeReservation.quantity, props.activeReservation.unit_price),
      )
    : '',
)

async function submitReservation() {
  if (busy.value) return
  error.value = validateQuantity(quantity.value, props.remaining)
  if (error.value) return

  busy.value = true
  try {
    const reservation = await runAction('Reserving your portions…', () =>
      createReservation(props.listing.id, quantity.value),
    )
    showToast(`Reserved! Your pickup number is ${reservation.pickup_code}.`)
    emit('reserved', reservation)
  } catch (err) {
    // Keep the chosen quantity so the user can adjust it and try again.
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section
    class="border-top pt-3 mt-3"
    aria-labelledby="reserve-heading"
    data-testid="reserve-panel"
  >
    <h2 id="reserve-heading" class="h6 fw-semibold">
      {{ activeReservation ? 'Your booking' : 'Reserve portions' }}
    </h2>

    <!-- Ticket-style pass with the pickup number, shown after booking. -->
    <div v-if="activeReservation" class="pickup-ticket" data-testid="active-reservation">
      <p class="ticket-status"><span class="ticket-check" aria-hidden="true">✓</span> Reserved</p>
      <p class="ticket-label">Pickup number</p>
      <p class="ticket-number" data-testid="pickup-code">{{ activeReservation.pickup_code }}</p>
      <p class="ticket-details">
        {{ activeReservation.quantity }} portion{{ activeReservation.quantity === 1 ? '' : 's' }} ·
        {{ activeTotal }} · pay at collection
      </p>
      <p class="ticket-hint">Show this number at the counter.</p>
      <RouterLink to="/my-reservations" class="ticket-link"
        >Change or cancel in My Reservations →</RouterLink
      >
    </div>

    <p v-else-if="status === 'closed'" class="text-secondary mb-0">
      This listing is closed to new bookings.
    </p>
    <p v-else-if="status === 'expired'" class="text-secondary mb-0">The pickup window has ended.</p>
    <p v-else-if="remaining === 0" class="text-secondary mb-0" data-testid="sold-out">
      Fully reserved. Check back in case someone cancels.
    </p>

    <RouterLink
      v-else-if="!userId"
      :to="{ name: 'auth', query: { redirect: route.fullPath } }"
      class="btn btn-success"
      >Log in to reserve</RouterLink
    >

    <form v-else novalidate @submit.prevent="submitReservation">
      <label for="reserve-quantity" class="form-label small fw-semibold">Portions</label>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <QuantityStepper
          :quantity="quantity"
          :max="remaining"
          input-id="reserve-quantity"
          :invalid="!!error"
          testid="reserve-quantity"
          @change="quantity = $event"
        />
        <button type="submit" class="btn btn-success" :disabled="busy" data-testid="reserve-button">
          <span v-if="busy" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
          Reserve<template v-if="totalText"> · {{ totalText }}</template>
        </button>
      </div>
      <p v-if="error" class="text-danger small mt-2 mb-0" role="alert" data-testid="reserve-error">
        {{ error }}
      </p>
      <p class="small text-secondary mt-2 mb-0">
        {{ remaining }} left · Pay at collection. Show your pickup number to the provider.
      </p>
    </form>
  </section>
</template>

<style scoped>
.pickup-ticket {
  position: relative;
  padding: 22px 26px;
  border: 1px solid #ecc9b9;
  border-radius: 18px;
  background: #fbefe9;
  text-align: center;
  animation: ticket-pop 550ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
/* Two half-circle cut-outs on the sides make the card look like a ticket. */
.pickup-ticket::before,
.pickup-ticket::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 24px;
  height: 24px;
  margin-top: -12px;
  border: 1px solid #ecc9b9;
  border-radius: 50%;
  background: var(--color-bg);
}
.pickup-ticket::before {
  left: -13px;
}
.pickup-ticket::after {
  right: -13px;
}
.pickup-ticket p {
  margin: 0;
}
.ticket-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #2f6b3a;
  font-weight: 600;
}
.ticket-check {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #2f6b3a;
  color: #fff;
  font-size: 13px;
  animation: check-pop 400ms 300ms ease-out both;
}
.pickup-ticket .ticket-label {
  margin-top: 14px;
  color: var(--color-muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}
.ticket-number {
  font-family: ui-monospace, Consolas, monospace;
  font-size: clamp(30px, 8vw, 44px);
  font-weight: 700;
  letter-spacing: 6px;
  color: var(--color-ink);
}
.ticket-details {
  font-weight: 600;
}
.ticket-hint {
  color: var(--color-muted);
  font-size: 13px;
}
.ticket-link {
  display: inline-block;
  margin-top: 12px;
  font-size: 13px;
}
@keyframes ticket-pop {
  from {
    opacity: 0;
    transform: scale(0.85) translateY(12px);
  }
}
@keyframes check-pop {
  from {
    transform: scale(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pickup-ticket,
  .ticket-check {
    animation: none;
  }
}
</style>
