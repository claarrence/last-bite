<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import StarRating from '@/components/reviews/StarRating.vue'
import ReviewCard from '@/components/reviews/ReviewCard.vue'
import { useToast } from '@/composables/useToast'
import { getCurrentUser } from '@/utils/session'
import {
  deleteReview,
  getEstablishmentProfile,
  getEstablishmentReviews,
  replyToReview,
} from '@/utils/reviews'
import { REVIEW_SORTS, sortReviews, summarizeReviews } from '@/utils/reviewRules'
import { vReveal } from '@/utils/reveal'

// An establishment's public page: rating summary and all reviews.
const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const { show: showToast } = useToast()

const profile = ref(null)
const reviews = ref([])
const userId = ref(null)
const loading = ref(true)
const error = ref('')
const sortBy = ref('recent')
const busyId = ref(null)
const pendingDelete = ref(null)

async function loadPage() {
  loading.value = true
  error.value = ''
  try {
    userId.value = (await getCurrentUser())?.id ?? null
    profile.value = await getEstablishmentProfile(props.id)
    reviews.value = await getEstablishmentReviews(props.id)
  } catch (err) {
    error.value = `Could not load reviews: ${err.message}`
  } finally {
    loading.value = false
  }
}
onMounted(loadPage)

// Recalculated automatically whenever a review is added, edited or deleted.
const summary = computed(() => summarizeReviews(reviews.value))
const sortedReviews = computed(() => sortReviews(reviews.value, sortBy.value))
const isProvider = computed(() => userId.value === props.id)
const title = computed(() => profile.value?.name || 'Food provider')

function editReview(review) {
  router.push({ name: 'review-form', params: { reservationId: review.reservation_id } })
}

function requestDelete(review) {
  pendingDelete.value = review
}

function closeDeleteDialog() {
  if (!busyId.value) pendingDelete.value = null
}

async function confirmDelete() {
  if (!pendingDelete.value || busyId.value) return
  const review = pendingDelete.value
  busyId.value = review.id
  try {
    await deleteReview(review)
    reviews.value = reviews.value.filter((r) => r.id !== review.id)
    pendingDelete.value = null
    showToast('Review deleted')
  } catch (err) {
    showToast(`Could not delete review: ${err.message}`, 'danger')
  } finally {
    busyId.value = null
  }
}

async function saveReply(review, text) {
  if (busyId.value) return
  busyId.value = review.id
  try {
    const updated = await replyToReview(review.id, text)
    // Keep the joined listing title, which the update does not return.
    reviews.value = reviews.value.map((r) =>
      r.id === updated.id ? { ...updated, listing: r.listing } : r,
    )
    showToast(updated.reply ? 'Reply posted' : 'Reply removed')
  } catch (err) {
    showToast(`Could not save reply: ${err.message}`, 'danger')
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <NavBar />

  <main class="container py-4">
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
    </div>

    <div v-else-if="error" class="alert alert-danger" role="alert">
      {{ error }}
      <button type="button" class="btn btn-sm btn-outline-danger ms-2" @click="loadPage">
        Try again
      </button>
    </div>

    <template v-else>
      <section class="dashboard-intro mb-4" data-testid="review-summary">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <h1 class="h2 page-title mb-1" data-testid="establishment-name">{{ title }}</h1>
            <span v-if="profile?.business_type" class="badge rounded-pill text-bg-light border">{{
              profile.business_type
            }}</span>
          </div>
          <div v-if="summary.count" class="text-sm-end">
            <div class="d-flex align-items-center gap-2 justify-content-sm-end">
              <span class="fs-2 fw-bold" data-testid="average-rating">{{
                summary.average.toFixed(1)
              }}</span>
              <StarRating :rating="summary.average" readonly />
            </div>
            <p class="small text-secondary mb-0" data-testid="review-count">
              {{ summary.count }} review{{ summary.count === 1 ? '' : 's' }}
            </p>
          </div>
        </div>
        <div v-if="summary.topTags.length" class="d-flex flex-wrap gap-2 mt-3">
          <span class="small text-secondary">Customers often say:</span>
          <span
            v-for="item in summary.topTags"
            :key="item.tag"
            class="badge text-bg-light border"
            data-testid="top-tag"
            >{{ item.tag }} · {{ item.count }}</span
          >
        </div>
      </section>

      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 px-4 mb-3">
        <h2 class="display-5 page-title mb-0">Reviews</h2>
        <div v-if="reviews.length" class="d-flex align-items-center gap-2">
          <label for="review-sort" class="small text-secondary text-nowrap">Sort by</label>
          <select id="review-sort" v-model="sortBy" class="form-select w-auto pe-5">
            <option v-for="option in REVIEW_SORTS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <div
        v-if="!reviews.length"
        class="empty-listings text-center text-secondary"
        data-testid="no-reviews"
      >
        <p class="mb-0">No reviews yet. Customers can review after collecting an order.</p>
      </div>

      <template v-else>
        <div class="d-flex flex-column gap-3">
          <ReviewCard
            v-for="review in sortedReviews"
            v-reveal="'lift'"
            :key="review.id"
            :review="review"
            :is-author="review.author_id === userId"
            :is-provider="isProvider"
            :busy="busyId === review.id"
            @edit="editReview"
            @delete="requestDelete"
            @reply="saveReply(review, $event)"
          />
        </div>
      </template>
    </template>
  </main>

  <ConfirmDialog
    :open="!!pendingDelete"
    title="Delete your review?"
    confirm-label="Delete"
    :busy="!!busyId"
    @confirm="confirmDelete"
    @cancel="closeDeleteDialog"
  >
    <p class="mb-0">Your rating and comment will be removed from this page.</p>
  </ConfirmDialog>
</template>
