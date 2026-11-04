<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { quantityLevelLabel, UNKNOWN_ALLERGEN } from '@/utils/listingOptions'
import { formatPickupWindow, formatPrice } from '@/utils/format'
import { pickupCountdown } from '@/utils/countdown'

const props = defineProps({
  // Row shaped like the listings table (the live preview passes the same shape).
  listing: { type: Object, required: true },
  photoSrc: { type: String, default: '' },
  // 'open' | 'closed' | 'expired'; omit to hide the status badge.
  status: { type: String, default: '' },
  // Route to open when the title is clicked; omit for a non-clickable card.
  to: { type: [String, Object], default: null },
  // Current time from the page, so every card's countdown updates together.
  now: { type: Date, default: null },
  // Distance from the user in km, shown when sorting by nearest; omit to hide it.
  distanceKm: { type: Number, default: null },
})

const isDiscounted = computed(() => props.listing.listing_type === 'discounted')

const quantityText = computed(() => {
  if (isDiscounted.value) {
    const qty = Number(props.listing.quantity_total)
    // Browse cards also receive quantity_remaining (portions not yet reserved).
    const remaining = props.listing.quantity_remaining
    if (remaining !== undefined && qty >= 1) {
      return remaining > 0 ? `${remaining} of ${qty} left` : 'Fully reserved'
    }
    return qty >= 1 ? `${qty} portion${qty === 1 ? '' : 's'}` : ''
  }
  const label = quantityLevelLabel(props.listing.quantity_level)
  return label ? `Quantity: ${label}` : ''
})

const priceText = computed(() =>
  isDiscounted.value ? formatPrice(props.listing.price) || 'S$—' : 'Free',
)

const pickupText = computed(() =>
  formatPickupWindow(props.listing.pickup_start, props.listing.pickup_end),
)

const statusBadge = computed(
  () =>
    ({
      open: { label: 'Open', cls: 'badge-green' },
      closed: { label: 'Closed', cls: 'badge-grey' },
      expired: { label: 'Expired', cls: 'badge-ink' },
    })[props.status],
)

// "Ends in 2h 15m"; not shown for closed listings.
const countdown = computed(() => {
  if (props.listing.status === 'closed') return null
  const now = props.now || new Date()
  return pickupCountdown(props.listing.pickup_start, props.listing.pickup_end, now)
})

const distanceText = computed(() => {
  if (props.distanceKm === null) return ''
  if (props.distanceKm < 1) return `${Math.round(props.distanceKm * 1000)} m away`
  return `${props.distanceKm.toFixed(1)} km away`
})

const allergens = computed(() => props.listing.allergens ?? [])
</script>

<template>
  <article class="card h-100 listing-card" data-testid="listing-card">
    <div class="ratio ratio-4x3 bg-body-secondary rounded-top overflow-hidden">
      <img
        v-if="photoSrc"
        :src="photoSrc"
        :alt="listing.title || 'Listing photo'"
        class="object-fit-cover"
      />
      <div v-else class="d-flex align-items-center justify-content-center bg-warning-subtle">
        <span role="img" aria-label="Food" style="font-size: 4rem">🍱</span>
      </div>
    </div>

    <div class="card-body d-flex flex-column gap-2">
      <div class="d-flex flex-wrap align-items-center gap-1">
        <span
          class="badge rounded-pill"
          :class="isDiscounted ? 'badge-peach' : 'badge-sand'"
          data-testid="card-type"
        >
          {{ isDiscounted ? 'Discounted · Reserve' : 'Free · Walk in' }}
        </span>
        <span
          v-if="statusBadge"
          class="badge rounded-pill"
          :class="statusBadge.cls"
          data-testid="card-status"
        >
          {{ statusBadge.label }}
        </span>
        <span
          v-if="countdown"
          class="countdown-chip ms-auto"
          :class="{ 'is-urgent': countdown.urgent }"
          data-testid="countdown"
          >{{ countdown.label }}</span
        >
      </div>

      <h3 class="h5 card-title mb-0 text-break">
        <RouterLink v-if="to" :to="to" class="stretched-link text-reset text-decoration-none">
          {{ listing.title || 'Your food item' }}
        </RouterLink>
        <span v-else data-testid="card-title">{{ listing.title || 'Your food item' }}</span>
      </h3>

      <div class="d-flex justify-content-between align-items-baseline gap-2">
        <span class="fs-5 fw-bold text-success" data-testid="card-price">{{ priceText }}</span>
        <span v-if="quantityText" class="small text-secondary" data-testid="card-quantity">{{
          quantityText
        }}</span>
      </div>

      <p v-if="pickupText" class="small mb-0">
        <span class="fw-semibold">Pickup:</span> {{ pickupText }}
      </p>
      <p v-if="listing.address" class="small text-secondary mb-0 text-break">
        {{ listing.address }}
      </p>
      <p
        v-if="distanceText"
        class="small fw-semibold text-success mb-0"
        data-testid="card-distance"
      >
        {{ distanceText }}
      </p>

      <div
        v-if="listing.dietary_tags?.length || allergens.length"
        class="d-flex flex-wrap gap-1 mt-auto pt-1"
      >
        <span v-for="tag in listing.dietary_tags" :key="tag" class="badge text-bg-light border">{{
          tag
        }}</span>
        <span
          v-for="a in allergens"
          :key="a"
          class="badge border"
          :class="
            a === UNKNOWN_ALLERGEN
              ? 'text-bg-light text-secondary'
              : 'bg-danger-subtle text-danger-emphasis'
          "
        >
          {{ a === UNKNOWN_ALLERGEN ? 'Allergens unknown' : `Contains ${a.toLowerCase()}` }}
        </span>
      </div>
    </div>

    <div v-if="$slots.actions" class="card-footer bg-transparent position-relative z-1">
      <slot name="actions" />
    </div>
  </article>
</template>

<style scoped>
.listing-card img {
  width: 100%;
  height: 100%;
}
</style>
