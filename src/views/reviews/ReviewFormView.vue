<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import StarRating from '@/components/reviews/StarRating.vue'
import { useToast } from '@/composables/useToast'
import { getCurrentUser } from '@/utils/session'
import { getReservation } from '@/utils/reservations'
import {
  createReview,
  deleteReview,
  getReviewForReservation,
  removeReviewPhoto,
  reviewPhotoUrl,
  updateReview,
  uploadReviewPhoto,
} from '@/utils/reviews'
import { MAX_COMMENT_LENGTH, REVIEW_TAGS, validateReview } from '@/utils/reviewRules'

// Write a review for a collected reservation, or edit/delete the existing one.
const props = defineProps({ reservationId: { type: String, required: true } })
const router = useRouter()
const { show: showToast } = useToast()

const reservation = ref(null)
const existingReview = ref(null)
const userId = ref(null)
const loading = ref(true)
const loadError = ref('')

// Form fields
const rating = ref(0)
const tags = ref([])
const comment = ref('')
const photoFile = ref(null)
const photoPreview = ref('')
const removeExistingPhoto = ref(false)

const submitted = ref(false)
const saving = ref(false)
const saveError = ref('')
const confirmingDelete = ref(false)

onMounted(async () => {
  try {
    userId.value = (await getCurrentUser())?.id ?? null
    reservation.value = await getReservation(props.reservationId)
    if (!reservation.value || reservation.value.customer_id !== userId.value) {
      throw new Error('Reservation not found.')
    }
    if (reservation.value.status !== 'collected') {
      throw new Error('You can review an order after the provider marks it collected.')
    }
    existingReview.value = await getReviewForReservation(props.reservationId)
    if (existingReview.value) {
      rating.value = existingReview.value.rating
      tags.value = [...existingReview.value.tags]
      comment.value = existingReview.value.comment ?? ''
      photoPreview.value = reviewPhotoUrl(existingReview.value.photo_path)
    }
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
})

const isEdit = computed(() => !!existingReview.value)
const establishmentId = computed(() => reservation.value?.listing?.owner_id)

const errors = computed(() =>
  validateReview({
    rating: rating.value,
    tags: tags.value,
    comment: comment.value,
    photoFile: photoFile.value,
  }),
)
// Messages appear after the first submit attempt, not while the user is still filling in.
function fieldError(field) {
  return submitted.value ? errors.value[field] : ''
}

function revokePreview() {
  if (photoPreview.value.startsWith('blob:')) URL.revokeObjectURL(photoPreview.value)
}
onBeforeUnmount(revokePreview)

function onPhotoChange(event) {
  revokePreview()
  const file = event.target.files[0] ?? null
  photoFile.value = file
  photoPreview.value = file ? URL.createObjectURL(file) : ''
  removeExistingPhoto.value = false
}

function removePhoto() {
  revokePreview()
  photoFile.value = null
  photoPreview.value = ''
  removeExistingPhoto.value = true
}

async function submitReview() {
  if (saving.value) return
  submitted.value = true
  saveError.value = ''
  if (Object.keys(errors.value).length) return

  saving.value = true
  let uploadedPath = ''
  try {
    if (photoFile.value) uploadedPath = await uploadReviewPhoto(photoFile.value, userId.value)

    const oldPhoto = existingReview.value?.photo_path ?? ''
    let photoPath = oldPhoto
    if (uploadedPath) photoPath = uploadedPath
    else if (removeExistingPhoto.value) photoPath = ''

    const fields = {
      rating: rating.value,
      tags: tags.value,
      comment: comment.value.trim() || null,
      photo_path: photoPath,
    }

    if (isEdit.value) {
      await updateReview(existingReview.value.id, fields)
    } else {
      await createReview({
        ...fields,
        reservation_id: reservation.value.id,
        listing_id: reservation.value.listing_id,
        establishment_id: establishmentId.value,
      })
    }

    // The old photo is no longer used once the review points at the new one.
    if (oldPhoto && oldPhoto !== photoPath) await removeReviewPhoto(oldPhoto)

    showToast(isEdit.value ? 'Review updated' : 'Thanks for your review!')
    router.push({ name: 'establishment', params: { id: establishmentId.value } })
  } catch (err) {
    // Don't leave an unused photo behind; keep the form so nothing has to be retyped.
    if (uploadedPath) await removeReviewPhoto(uploadedPath)
    saveError.value = `Could not save your review: ${err.message}`
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (saving.value) return
  saving.value = true
  try {
    await deleteReview(existingReview.value)
    showToast('Review deleted')
    router.push({ name: 'my-reservations' })
  } catch (err) {
    confirmingDelete.value = false
    saveError.value = `Could not delete your review: ${err.message}`
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <NavBar />

  <main class="container py-4 review-page">
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
    </div>

    <div v-else-if="loadError" class="alert alert-danger" role="alert">
      {{ loadError }}
      <RouterLink to="/my-reservations" class="alert-link">Back to My Reservations</RouterLink>
    </div>

    <form
      v-else
      class="dashboard-intro"
      novalidate
      data-testid="review-form"
      @submit.prevent="submitReview"
    >
      <h1 class="h2 page-title mb-1">{{ isEdit ? 'Edit your review' : 'Review your order' }}</h1>
      <p class="text-secondary mb-4">
        {{ reservation.listing?.title }} · {{ reservation.quantity }} portion{{
          reservation.quantity === 1 ? '' : 's'
        }}
      </p>

      <fieldset class="mb-4">
        <legend class="form-label fw-semibold fs-6">Your rating</legend>
        <div class="d-flex align-items-center gap-3">
          <StarRating name="review-rating" :rating="rating" @select="rating = $event" />
          <span v-if="rating" class="text-secondary small" data-testid="rating-text"
            >{{ rating }} out of 5</span
          >
        </div>
        <p v-if="fieldError('rating')" class="text-danger small mt-1 mb-0" role="alert">
          {{ fieldError('rating') }}
        </p>
      </fieldset>

      <fieldset class="mb-4">
        <legend class="form-label fw-semibold fs-6">
          Quick feedback <span class="text-secondary fw-normal small">(optional)</span>
        </legend>
        <div class="d-flex flex-wrap gap-2">
          <template v-for="tag in REVIEW_TAGS" :key="tag">
            <input
              :id="`tag-${tag}`"
              v-model="tags"
              class="btn-check"
              type="checkbox"
              :value="tag"
              :data-testid="`tag-${tag}`"
            />
            <label :for="`tag-${tag}`" class="btn btn-sm btn-outline-success rounded-pill">{{
              tag
            }}</label>
          </template>
        </div>
      </fieldset>

      <div class="mb-4">
        <label for="review-comment" class="form-label fw-semibold">
          Comment <span class="text-secondary fw-normal small">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          v-model="comment"
          class="form-control"
          :class="{ 'is-invalid': fieldError('comment') }"
          rows="4"
          :maxlength="MAX_COMMENT_LENGTH"
          placeholder="How was the food and the pickup?"
          data-testid="review-comment-input"
        ></textarea>
        <div class="form-text">{{ comment.length }} / {{ MAX_COMMENT_LENGTH }}</div>
        <div class="invalid-feedback">{{ fieldError('comment') }}</div>
      </div>

      <div class="mb-4">
        <label for="review-photo" class="form-label fw-semibold">
          Photo <span class="text-secondary fw-normal small">(optional)</span>
        </label>
        <input
          id="review-photo"
          type="file"
          accept="image/*"
          class="form-control"
          :class="{ 'is-invalid': fieldError('photo') }"
          data-testid="review-photo"
          @change="onPhotoChange"
        />
        <div class="invalid-feedback">{{ fieldError('photo') }}</div>
        <div v-if="photoPreview" class="d-flex align-items-end gap-3 mt-2">
          <img :src="photoPreview" alt="Selected review photo" class="photo-preview rounded-3" />
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="removePhoto">
            Remove photo
          </button>
        </div>
      </div>

      <div v-if="saveError" class="alert alert-danger" role="alert" data-testid="review-error">
        {{ saveError }}
      </div>

      <div class="d-flex flex-wrap gap-2">
        <button
          type="submit"
          class="btn btn-success"
          :disabled="saving"
          data-testid="submit-review"
        >
          <span
            v-if="saving"
            class="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          ></span>
          {{ isEdit ? 'Save changes' : 'Post review' }}
        </button>
        <RouterLink to="/my-reservations" class="btn btn-outline-secondary">Cancel</RouterLink>
        <button
          v-if="isEdit"
          type="button"
          class="btn btn-outline-danger ms-sm-auto"
          :disabled="saving"
          data-testid="delete-review-button"
          @click="confirmingDelete = true"
        >
          Delete review
        </button>
      </div>
    </form>
  </main>

  <ConfirmDialog
    :open="confirmingDelete"
    title="Delete your review?"
    confirm-label="Delete"
    :busy="saving"
    @confirm="confirmDelete"
    @cancel="confirmingDelete = false"
  >
    <p class="mb-0">Your rating and comment will be removed from the provider's page.</p>
  </ConfirmDialog>
</template>

<style scoped>
.review-page {
  max-width: 720px;
}
.photo-preview {
  max-width: 160px;
  max-height: 120px;
  object-fit: cover;
}
</style>
