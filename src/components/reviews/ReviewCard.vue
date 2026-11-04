<script setup>
import { computed, ref } from 'vue'
import StarRating from '@/components/reviews/StarRating.vue'
import { reviewPhotoUrl } from '@/utils/reviews'
import { MAX_COMMENT_LENGTH } from '@/utils/reviewRules'

const props = defineProps({
  // Review row with the reviewed listing's title joined as `listing`.
  review: { type: Object, required: true },
  // The signed-in user wrote this review.
  isAuthor: { type: Boolean, default: false },
  // The signed-in user is the reviewed provider.
  isProvider: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['edit', 'delete', 'reply'])

const dateFormat = new Intl.DateTimeFormat('en-SG', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Singapore',
})
const postedOn = computed(() => dateFormat.format(new Date(props.review.created_at)))

const replying = ref(false)
const replyText = ref('')

function startReply() {
  replyText.value = props.review.reply ?? ''
  replying.value = true
}

function submitReply() {
  emit('reply', replyText.value)
  replying.value = false
}
</script>

<template>
  <article class="listing-info review-card" data-testid="review-card">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
      <div>
        <StarRating :rating="review.rating" readonly />
        <p class="small text-secondary mb-0 mt-1">
          {{ review.listing?.title || 'Food order' }} · {{ postedOn }}
        </p>
      </div>
      <span v-if="isAuthor" class="badge rounded-pill text-bg-light border">Your review</span>
    </div>

    <div v-if="review.tags.length" class="d-flex flex-wrap gap-1 mt-2">
      <span v-for="tag in review.tags" :key="tag" class="badge text-bg-light border">{{
        tag
      }}</span>
    </div>

    <p v-if="review.comment" class="mt-2 mb-0 text-break" data-testid="review-comment">
      {{ review.comment }}
    </p>

    <img
      v-if="review.photo_path"
      :src="reviewPhotoUrl(review.photo_path)"
      :alt="`Photo from a review of ${review.listing?.title || 'this food'}`"
      class="review-photo mt-2 rounded-3"
    />

    <div v-if="review.reply && !replying" class="provider-reply mt-3" data-testid="review-reply">
      <p class="small fw-semibold mb-1">Reply from the provider</p>
      <p class="small mb-0 text-break">{{ review.reply }}</p>
    </div>

    <form v-if="replying" class="mt-3" @submit.prevent="submitReply">
      <label :for="`reply-${review.id}`" class="form-label small fw-semibold">Your reply</label>
      <textarea
        :id="`reply-${review.id}`"
        v-model="replyText"
        class="form-control"
        rows="2"
        :maxlength="MAX_COMMENT_LENGTH"
        data-testid="reply-input"
      ></textarea>
      <div class="d-flex gap-2 mt-2">
        <button
          type="submit"
          class="btn btn-sm btn-success"
          :disabled="busy"
          data-testid="save-reply-button"
        >
          Post reply
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="replying = false">
          Cancel
        </button>
      </div>
    </form>

    <div v-if="(isAuthor || isProvider) && !replying" class="d-flex flex-wrap gap-2 mt-3">
      <template v-if="isAuthor">
        <button
          type="button"
          class="btn btn-sm btn-outline-success"
          :disabled="busy"
          data-testid="edit-review-button"
          @click="emit('edit', review)"
        >
          Edit
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-danger"
          :disabled="busy"
          data-testid="delete-review-button"
          @click="emit('delete', review)"
        >
          Delete
        </button>
      </template>
      <button
        v-if="isProvider"
        type="button"
        class="btn btn-sm btn-outline-success"
        :disabled="busy"
        data-testid="reply-button"
        @click="startReply"
      >
        {{ review.reply ? 'Edit reply' : 'Reply' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.review-card {
  padding: 22px;
}
.review-photo {
  max-width: 220px;
  max-height: 180px;
  object-fit: cover;
}
.provider-reply {
  padding: 12px 14px;
  border-left: 3px solid var(--color-accent);
  background: var(--color-bg);
  border-radius: 0 8px 8px 0;
}
</style>
