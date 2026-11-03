<script setup>
import { onUnmounted, ref } from 'vue'
import { UPDATE_OPTIONS, optionFor, postListingUpdate, timeAgo, statusPhotoUrl } from '@/utils/statusUpdates'

const props = defineProps({
  listing: { type: Object, required: true },
  userId: { type: String, default: null },
  updates: { type: Array, default: () => [] },
  now: { type: Date, default: () => new Date() },
})
const emit = defineEmits(['posted'])

const status = ref('')
const photo = ref(null)
const preview = ref('')
const fileInput = ref(null)
const submitting = ref(false)
const formError = ref('')

function clearPreview() {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
}
onUnmounted(clearPreview)

function onPhotoChange(e) {
  formError.value = ''
  clearPreview()
  const file = e.target.files[0]
  if (!file) {
    photo.value = null
    return
  }
  if (!file.type.startsWith('image/')) {
    formError.value = 'Please choose an image file.'
    photo.value = null
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    formError.value = 'Photo must be under 5 MB.'
    photo.value = null
    return
  }
  photo.value = file
  preview.value = URL.createObjectURL(file)
}

async function submit() {
  formError.value = ''
  if (!status.value) return (formError.value = 'Choose a status.')
  if (!photo.value) return (formError.value = 'A photo is required.')

  submitting.value = true
  try {
    const created = await postListingUpdate({
      listingId: props.listing.id,
      userId: props.userId,
      status: status.value,
      photo: photo.value,
    })
    emit('posted', created)
    status.value = ''
    photo.value = null
    clearPreview()
    if (fileInput.value) fileInput.value.value = ''
  } catch (err) {
    formError.value = err.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="mt-4 border-top pt-3" data-testid="status-updates">
    <h2 class="h6 fw-semibold mb-3">Live updates</h2>

    <!-- Post form -->
    <div v-if="!userId" class="small text-secondary mb-3">Log in to post an update.</div>
    <form v-else class="card card-body mb-3" novalidate @submit.prevent="submit">
      <p class="small text-secondary mb-2">Been to the pickup spot? Let others know what's left.</p>

      <div class="btn-group flex-wrap mb-3" role="group" aria-label="Availability">
        <template v-for="opt in UPDATE_OPTIONS" :key="opt.value">
          <input
            :id="`status-${opt.value}`"
            v-model="status"
            type="radio"
            class="btn-check"
            name="update-status"
            :value="opt.value"
            :data-testid="`status-${opt.value}`"
          />
          <label class="btn" :class="opt.btn" :for="`status-${opt.value}`">{{ opt.label }}</label>
        </template>
      </div>

      <label for="update-photo" class="form-label small fw-semibold">
        Photo <span class="text-danger">*</span>
      </label>
      <input
        id="update-photo"
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        class="form-control mb-2"
        data-testid="update-photo"
        @change="onPhotoChange"
      />
      <img
        v-if="preview"
        :src="preview"
        alt="Preview of your photo"
        class="rounded mb-2"
        style="max-height: 140px; object-fit: cover"
      />

      <div v-if="formError" class="alert alert-danger py-2 small mb-2" role="alert">
        {{ formError }}
      </div>

      <button type="submit" class="btn btn-success" :disabled="submitting" data-testid="post-update">
        <span v-if="submitting" class="spinner-border spinner-border-sm me-1" aria-hidden="true" />
        {{ submitting ? 'Posting…' : 'Post update' }}
      </button>
    </form>

    <!-- Timeline -->
    <p v-if="!updates.length" class="small text-secondary mb-0">
      No updates yet. Nobody has confirmed this listing on site.
    </p>
    <ul v-else class="list-unstyled border-start ps-3 mb-0" data-testid="update-timeline">
      <li v-for="u in updates" :key="u.id" class="mb-3 d-flex gap-3 align-items-start">
        <img
          :src="statusPhotoUrl(u.photo_path)"
          alt="Photo posted with this update"
          class="rounded flex-shrink-0"
          style="width: 150px; height: 150px; object-fit: cover"
        />
        <div>
          <span class="badge rounded-pill" :class="optionFor(u.status)?.badge">
            {{ optionFor(u.status)?.label }}
          </span>
          <div class="small text-secondary mt-1" :title="new Date(u.created_at).toLocaleString()">
            {{ timeAgo(u.created_at, now) }}
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>