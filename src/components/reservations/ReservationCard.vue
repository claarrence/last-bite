<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { photoUrl } from '@/utils/listings'
import { RESERVATION_BADGES, reservationTotal } from '@/utils/reservationRules'
import { formatPickupWindow, formatPrice } from '@/utils/format'

// One booking on the My Reservations page. Actions are passed in through a slot.
const props = defineProps({
  // Reservation row with its listing joined as `listing`.
  reservation: { type: Object, required: true },
  // 'reserved' | 'collected' | 'cancelled' | 'expired'
  status: { type: String, required: true },
})

const listing = computed(() => props.reservation.listing)
const badge = computed(() => RESERVATION_BADGES[props.status])
const priceText = computed(
  () =>
    `${props.reservation.quantity} × ${formatPrice(props.reservation.unit_price)} = ` +
    formatPrice(reservationTotal(props.reservation.quantity, props.reservation.unit_price)),
)
</script>

<template>
  <article class="card h-100 listing-card" data-testid="reservation-card">
    <div class="ratio ratio-4x3 bg-body-secondary rounded-top overflow-hidden">
      <img
        v-if="listing.photo_path"
        :src="photoUrl(listing.photo_path)"
        :alt="listing.title || 'Listing photo'"
        class="object-fit-cover w-100 h-100"
      />
      <div v-else class="d-flex align-items-center justify-content-center text-secondary small">
        No photo
      </div>
    </div>

    <div class="card-body d-flex flex-column gap-2">
      <div>
        <span class="badge rounded-pill" :class="badge.cls" data-testid="reservation-status">
          {{ badge.label }}
        </span>
      </div>

      <h3 class="h5 card-title mb-0 text-break">
        <RouterLink
          :to="{ name: 'listing-detail', params: { id: reservation.listing_id } }"
          class="stretched-link text-reset text-decoration-none"
          >{{ listing.title || 'Listing' }}</RouterLink
        >
      </h3>

      <p class="mb-0">
        <span class="fw-bold text-success" data-testid="reservation-price">{{ priceText }}</span>
        <span class="small text-secondary"> · pay at collection</span>
      </p>
      <p class="small mb-0">
        <span class="fw-semibold">Pickup:</span>
        {{ formatPickupWindow(listing.pickup_start, listing.pickup_end) }}
      </p>
      <p v-if="listing.address" class="small text-secondary mb-0 text-break">
        {{ listing.address }}
      </p>
      <p v-if="listing.collection_instructions" class="small mb-0 text-break">
        <span class="fw-semibold">How to collect:</span> {{ listing.collection_instructions }}
      </p>
      <!-- &nbsp; keeps the space: Vue removes line breaks between two tags. -->
      <p class="small mb-0">
        <span class="fw-semibold">Pickup number:</span>&nbsp;<span
          class="font-monospace fw-bold pickup-chip"
          data-testid="reservation-code"
          >{{ reservation.pickup_code }}</span
        >
      </p>
    </div>

    <div v-if="$slots.actions" class="card-footer bg-transparent position-relative z-1">
      <slot name="actions" />
    </div>
  </article>
</template>
