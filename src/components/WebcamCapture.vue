<script setup>
// Live webcam view for computers. "Use this photo" grabs the current frame as a JPEG File
// and emits it as 'capture'; 'close' asks the parent to hide this panel.
// The camera is switched off again whenever the panel closes.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits(['capture', 'close'])

const video = ref(null)
const ready = ref(false)
const error = ref('')
let stream = null

onMounted(async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = 'This browser cannot use a webcam. Choose a photo file instead.'
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    // `ready` is set by the video's loadeddata event, once a real frame is showing.
    video.value.srcObject = stream
  } catch (err) {
    // NotAllowedError: the user (or the browser settings) blocked the camera.
    error.value =
      err.name === 'NotAllowedError'
        ? 'Camera access is blocked. Allow it in the address bar, or choose a photo file instead.'
        : 'No webcam was found. Choose a photo file instead.'
  }
})

function stopCamera() {
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
}
onBeforeUnmount(stopCamera)

// Draws the current video frame onto a canvas and turns it into an image file.
function capture() {
  if (!video.value.videoWidth) return // no frame yet
  const canvas = document.createElement('canvas')
  canvas.width = video.value.videoWidth
  canvas.height = video.value.videoHeight
  canvas.getContext('2d').drawImage(video.value, 0, 0)
  canvas.toBlob(
    (blob) => {
      if (!blob) return
      emit('capture', new File([blob], 'webcam-photo.jpg', { type: 'image/jpeg' }))
      emit('close')
    },
    'image/jpeg',
    0.9,
  )
}
</script>

<template>
  <div class="webcam mt-2" data-testid="webcam">
    <p v-if="error" class="small text-danger mb-2" role="alert">{{ error }}</p>
    <!-- muted + playsinline: browsers only autoplay video that is silent and inline. -->
    <video
      v-if="!error"
      ref="video"
      class="webcam-video"
      autoplay
      muted
      playsinline
      aria-label="Webcam view"
      @loadeddata="ready = true"
    ></video>
    <div class="d-flex gap-2 mt-2">
      <button
        type="button"
        class="btn btn-success btn-sm"
        :disabled="!ready"
        data-testid="webcam-capture"
        @click="capture"
      >
        Use this photo
      </button>
      <button type="button" class="btn btn-outline-secondary btn-sm" @click="emit('close')">
        Cancel
      </button>
    </div>
  </div>
</template>

<style scoped>
.webcam {
  padding: 12px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--color-paper);
}
.webcam-video {
  display: block;
  width: 100%;
  max-height: 320px;
  border-radius: 8px;
  background: #000;
  object-fit: cover;
}
</style>
