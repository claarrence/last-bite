<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import AddressPicker from '@/components/AddressPicker.vue'
import LocationMap from '@/components/LocationMap.vue'
import ListingCard from '@/components/listings/ListingCard.vue'
import WebcamCapture from '@/components/WebcamCapture.vue'
import { useToast } from '@/composables/useToast'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { getCurrentUser, getEstablishmentLocation, isEstablishment } from '@/utils/session'
import {
  createListing,
  getListing,
  photoUrl,
  removeListingPhoto,
  updateListing,
  uploadListingPhoto,
} from '@/utils/listings'
import { reverseGeocode } from '@/utils/onemap'
import { getBrowserPosition, isInSingapore } from '@/utils/map'
import { toDateTime, validateListing } from '@/utils/listingValidation'
import { toDateInput, toTimeInput } from '@/utils/format'
import { ALLERGENS, DIETARY_TAGS, QUANTITY_LEVELS, UNKNOWN_ALLERGEN } from '@/utils/listingOptions'

// Set when editing (/listings/:id/edit); empty when creating (/listing-form).
const props = defineProps({ id: { type: String, default: '' } })

const router = useRouter()
const { show: showToast } = useToast()
const { runAction } = useActionFeedback()

const isEdit = computed(() => !!props.id)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const submitted = ref(false)
const userId = ref(null)
const establishment = ref(false)

const form = reactive({
  listingType: 'free',
  title: '',
  description: '',
  photoFile: null,
  photoPreview: '',
  existingPhotoPath: '',
  price: '',
  quantityTotal: '',
  quantityLevel: '',
  address: '',
  lat: null,
  lng: null,
  collectionInstructions: '',
  date: '',
  start: '',
  end: '',
  dietaryTags: [],
  allergens: [],
})

const today = toDateInput(new Date())

onMounted(async () => {
  try {
    const user = await getCurrentUser()
    userId.value = user?.id ?? null
    establishment.value = await isEstablishment()
    form.listingType = establishment.value ? 'discounted' : 'free'

    if (isEdit.value) {
      const listing = await getListing(props.id)
      if (!listing) throw new Error('This listing no longer exists.')
      if (listing.owner_id !== userId.value) throw new Error('You can only edit your own listings.')
      fillForm(listing)
    } else if (establishment.value) {
      await fillSavedLocation()
    }
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  revokePreview()
  geocodeController?.abort()
})

function fillForm(listing) {
  Object.assign(form, {
    listingType: listing.listing_type,
    title: listing.title,
    description: listing.description ?? '',
    existingPhotoPath: listing.photo_path,
    photoPreview: photoUrl(listing.photo_path),
    price: listing.price ?? '',
    quantityTotal: listing.quantity_total ?? '',
    quantityLevel: listing.quantity_level ?? '',
    address: listing.address,
    lat: listing.lat == null ? null : Number(listing.lat),
    lng: listing.lng == null ? null : Number(listing.lng),
    collectionInstructions: listing.collection_instructions ?? '',
    date: toDateInput(listing.pickup_start),
    start: toTimeInput(listing.pickup_start),
    end: toTimeInput(listing.pickup_end),
    dietaryTags: [...listing.dietary_tags],
    allergens: [...listing.allergens],
  })
}

// New establishment listings start at the location chosen at registration.
async function fillSavedLocation() {
  const saved = await getEstablishmentLocation(userId.value)
  if (!saved) return
  form.address = saved.address
  form.lat = saved.lat
  form.lng = saved.lng
}

function revokePreview() {
  if (form.photoPreview.startsWith('blob:')) URL.revokeObjectURL(form.photoPreview)
}

// Cancelling the file dialog gives no file; keep whatever photo is already attached.
function onPhoto(event) {
  const file = event.target.files?.[0]
  if (file) setPhoto(file)
  event.target.value = '' // so choosing the same file again still counts as a change
}

const photoInput = ref(null)
function choosePhoto() {
  photoInput.value.click()
}

function setPhoto(file) {
  revokePreview()
  form.photoFile = file
  form.photoPreview = file
    ? URL.createObjectURL(file)
    : form.existingPhotoPath
      ? photoUrl(form.existingPhotoPath)
      : ''
}

// "Take photo": phones and tablets open their camera through the file input's capture
// attribute; computers show the webcam panel instead.
const webcamOpen = ref(false)
const cameraInput = ref(null)
function takePhoto() {
  if (window.matchMedia('(pointer: coarse)').matches) cameraInput.value.click()
  else webcamOpen.value = true
}

const searchResults = ref([])
const geocoding = ref(false)
let geocodeController = null

function cancelGeocoding() {
  geocodeController?.abort()
  geocodeController = null
  geocoding.value = false
}

function onAddressSelect({ address, lat, lng }) {
  cancelGeocoding()
  form.address = address
  form.lat = lat
  form.lng = lng
  searchResults.value = []
}

// An edited address must not keep coordinates belonging to the previous address.
function onAddressClear() {
  cancelGeocoding()
  form.lat = null
  form.lng = null
}

async function onMapPick({ lat, lng, address }) {
  cancelGeocoding()
  form.address = address || ''
  form.lat = lat
  form.lng = lng
  if (address) return

  const request = new AbortController()
  geocodeController = request
  geocoding.value = true
  try {
    const found = await reverseGeocode(lat, lng, { signal: request.signal })
    if (request.signal.aborted || geocodeController !== request) return
    form.address = found
    if (!found) showToast('No address found at this pin. Search a nearby address.', 'danger')
  } catch (err) {
    if (!request.signal.aborted && geocodeController === request) showToast(err.message, 'danger')
  } finally {
    if (geocodeController === request) geocoding.value = false
  }
}

// "Use my location": the browser's position becomes the pickup pin, then onMapPick
// looks up its address with OneMap, exactly as if the user had clicked the map.
const locating = ref(false)
const locateError = ref('')

// The map stays hidden until "Pick on map" is pressed.
const showMap = ref(false)

async function useMyLocation() {
  locateError.value = ''
  if (!('geolocation' in navigator)) {
    locateError.value = 'Your browser cannot share its location. Search for the address instead.'
    return
  }
  // Browsers only share location on HTTPS or localhost.
  if (!window.isSecureContext) {
    locateError.value =
      'Location needs a secure (https://) connection. Search for the address instead.'
    return
  }
  locating.value = true
  try {
    const position = await getBrowserPosition({ enableHighAccuracy: true, timeout: 10000 })
    const lat = position.coords.latitude
    const lng = position.coords.longitude
    if (!isInSingapore(lat, lng)) {
      locateError.value =
        'Your location appears to be outside Singapore. Search for the pickup address instead.'
      return
    }
    await onMapPick({ lat, lng })
  } catch (err) {
    // err.code 1 means the user (or browser settings) blocked location access.
    if (err.code === 1) {
      locateError.value =
        'Location access is blocked. Allow location for this site in your browser, or search for the address.'
    } else {
      locateError.value = 'Could not find your location. Try again or search for the address.'
    }
  } finally {
    locating.value = false
  }
}

// "Unknown" means we can't vouch for any allergen, so it can't be combined with others.
function toggleAllergen(allergen, checked) {
  if (!checked) {
    form.allergens = form.allergens.filter((a) => a !== allergen)
  } else if (allergen === UNKNOWN_ALLERGEN) {
    form.allergens = [UNKNOWN_ALLERGEN]
  } else {
    form.allergens = [...form.allergens.filter((a) => a !== UNKNOWN_ALLERGEN), allergen]
  }
}

const errors = computed(() => validateListing(form, { isEstablishment: establishment.value }))

// Only show errors once the user has tried to submit, then keep them live.
function fieldError(field) {
  return submitted.value ? errors.value[field] : ''
}

// Required fields in the order they appear, for the ✓ marks and the "fill this next" pulse.
const requiredFields = computed(() => [
  'title',
  'photo',
  ...(form.listingType === 'discounted' ? ['price', 'quantityTotal'] : ['quantityLevel']),
  'address',
  'date',
  'start',
  'end',
])

function isDone(field) {
  return !errors.value[field]
}

// The first required field that is still empty or wrong, so it pulses from the moment the
// page opens. Nothing pulses once every required field is filled in.
const nextField = computed(() => requiredFields.value.find((field) => !isDone(field)) ?? null)

// While a required field is still missing, everything else fades so the next field stands out.
// Off after a failed submit, so every error message stays readable.
const guided = computed(() => !!nextField.value && !submitted.value)
function step(field) {
  return { 'form-step': true, 'is-current': nextField.value === field }
}

const previewListing = computed(() => ({
  listing_type: form.listingType,
  title: form.title.trim(),
  price: form.price,
  quantity_total: form.quantityTotal,
  quantity_level: form.quantityLevel,
  address: form.address.trim(),
  pickup_start: toDateTime(form.date, form.start),
  pickup_end: toDateTime(form.date, form.end),
  dietary_tags: form.dietaryTags,
  allergens: form.allergens,
}))

function buildPayload(photoPath) {
  const discounted = form.listingType === 'discounted'
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    photo_path: photoPath,
    price: discounted ? Number(form.price) : null,
    quantity_total: discounted ? Number(form.quantityTotal) : null,
    quantity_level: discounted ? null : form.quantityLevel,
    address: form.address.trim(),
    lat: form.lat,
    lng: form.lng,
    collection_instructions: form.collectionInstructions.trim() || null,
    pickup_start: toDateTime(form.date, form.start).toISOString(),
    pickup_end: toDateTime(form.date, form.end).toISOString(),
    dietary_tags: form.dietaryTags,
    allergens: form.allergens,
  }
}

async function submit() {
  if (saving.value || geocoding.value) return
  submitted.value = true
  if (Object.keys(errors.value).length) {
    await nextTick()
    document.querySelector('.is-invalid')?.focus()
    return
  }

  saving.value = true
  let uploadedPath = null
  try {
    await runAction(isEdit.value ? 'Saving your listing…' : 'Posting your food…', async () => {
      if (form.photoFile) uploadedPath = await uploadListingPhoto(form.photoFile, userId.value)
      const payload = buildPayload(uploadedPath ?? form.existingPhotoPath)

      if (isEdit.value) {
        await updateListing(props.id, payload)
        if (uploadedPath) await removeListingPhoto(form.existingPhotoPath)
      } else {
        await createListing({ ...payload, listing_type: form.listingType })
      }
    })

    showToast(isEdit.value ? 'Listing updated' : 'Listing posted')
    router.push({ name: 'home' })
  } catch (err) {
    // Don't leave an orphaned photo behind if the row couldn't be saved.
    if (uploadedPath) await removeListingPhoto(uploadedPath)
    showToast(`Could not save listing: ${err.message}`, 'danger')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <NavBar />

  <div class="container page-content py-4" :aria-busy="loading">
    <div v-if="!loading && loadError" class="alert alert-danger" role="alert">{{ loadError }}</div>

    <div v-else-if="!loading" class="row g-4">
      <div class="col-lg-7">
        <h1 class="h2 page-title mb-1">{{ isEdit ? 'Edit listing' : 'List your food' }}</h1>
        <p class="text-secondary">
          {{
            isEdit
              ? 'Update the details people see.'
              : 'Share surplus food before it goes to waste.'
          }}
        </p>

        <form
          novalidate
          :class="{ guided: guided }"
          data-testid="listing-form"
          @submit.prevent="submit"
        >
          <!-- Listing type -->
          <fieldset class="mb-4 form-step">
            <legend class="form-label fw-semibold fs-6">Listing type</legend>
            <div class="btn-group w-100" role="group" aria-label="Listing type">
              <input
                id="type-free"
                v-model="form.listingType"
                type="radio"
                name="listingType"
                class="btn-check"
                value="free"
                :disabled="isEdit"
                data-testid="type-free"
              />
              <label class="btn btn-outline-success flex-fill" for="type-free">
                <span class="d-block fw-semibold">Buffet / Event food</span>
                <small class="d-block">Free · Walk-in collection</small>
              </label>

              <template v-if="establishment">
                <input
                  id="type-discounted"
                  v-model="form.listingType"
                  type="radio"
                  name="listingType"
                  class="btn-check"
                  value="discounted"
                  :disabled="isEdit"
                  data-testid="type-discounted"
                />
                <label class="btn btn-outline-success flex-fill" for="type-discounted">
                  <span class="d-block fw-semibold">Reservation food</span>
                  <small class="d-block">Discounted · pay at pickup</small>
                </label>
              </template>
            </div>
            <div v-if="isEdit" class="form-text">
              The listing type can't be changed after posting.
            </div>
            <div v-if="fieldError('listingType')" class="text-danger small mt-1">
              {{ errors.listingType }}
            </div>
          </fieldset>

          <!-- Basics -->
          <div class="mb-3" :class="step('title')">
            <label for="title" class="form-label fw-semibold"
              >Food item
              <span v-if="isDone('title')" class="field-done"
                >✓<span class="visually-hidden"> filled in</span></span
              ></label
            >
            <input
              id="title"
              v-model="form.title"
              type="text"
              class="form-control"
              maxlength="80"
              :class="{
                'is-invalid': fieldError('title'),
                'needs-attention': nextField === 'title',
              }"
              placeholder="e.g. Nasi lemak sets, Buffet pastries"
              autocomplete="off"
              data-testid="title"
            />
            <div class="invalid-feedback">{{ fieldError('title') }}</div>
          </div>

          <div class="mb-3" :class="step('photo')">
            <label for="photo" class="form-label fw-semibold d-block"
              >Photograph
              <span v-if="isDone('photo')" class="field-done"
                >✓<span class="visually-hidden"> filled in</span></span
              ></label
            >
            <!-- The browser's own file box can't show a webcam photo, so it stays hidden and
                 these buttons and the "Photo added" card stand in for it. -->
            <input
              id="photo"
              ref="photoInput"
              type="file"
              accept="image/*"
              class="visually-hidden"
              tabindex="-1"
              data-testid="photo"
              @change="onPhoto"
            />
            <div
              v-if="form.photoPreview"
              class="photo-added d-flex align-items-center gap-3"
              data-testid="photo-added"
            >
              <img :src="form.photoPreview" alt="Your food photo" class="photo-thumb" />
              <div class="flex-grow-1 min-w-0">
                <div class="fw-semibold photo-added-title">✓ Photo added</div>
                <div class="small text-secondary text-truncate">
                  {{ form.photoFile ? form.photoFile.name : 'Current photo' }}
                </div>
              </div>
            </div>
            <div
              class="d-inline-flex flex-wrap gap-2 rounded-3"
              :class="{
                'mt-2': form.photoPreview,
                'needs-attention': nextField === 'photo',
              }"
            >
              <button
                type="button"
                class="btn btn-outline-success"
                :class="{ 'btn-sm': form.photoPreview }"
                data-testid="choose-photo"
                @click="choosePhoto"
              >
                {{ form.photoPreview ? 'Choose another' : 'Choose file' }}
              </button>
              <button
                type="button"
                class="btn btn-outline-success text-nowrap"
                :class="{ 'btn-sm': form.photoPreview }"
                data-testid="take-photo"
                @click="takePhoto"
              >
                <span aria-hidden="true">📷</span>
                {{ form.photoPreview ? 'Retake' : 'Take photo' }}
              </button>
              <!-- capture opens the camera straight away on phones and tablets. -->
              <input
                id="photo-camera"
                ref="cameraInput"
                type="file"
                accept="image/*"
                capture="environment"
                class="visually-hidden"
                tabindex="-1"
                aria-hidden="true"
                data-testid="photo-camera"
                @change="onPhoto"
              />
            </div>
            <WebcamCapture v-if="webcamOpen" @capture="setPhoto" @close="webcamOpen = false" />
            <!-- d-block: the input is wrapped, so Bootstrap can't show this automatically. -->
            <div v-if="fieldError('photo')" class="invalid-feedback d-block">
              {{ fieldError('photo') }}
            </div>
            <div class="form-text">
              Image file, up to 5 MB.
              <template v-if="isEdit">Leave it as is to keep the current photo.</template>
            </div>
          </div>

          <!-- Quantity & price -->
          <div
            v-if="form.listingType === 'discounted'"
            class="row g-3 mb-4"
            data-testid="discounted-fields"
          >
            <div class="col-sm-6" :class="step('price')">
              <label for="price" class="form-label fw-semibold"
                >Price per portion
                <span v-if="isDone('price')" class="field-done"
                  >✓<span class="visually-hidden"> filled in</span></span
                ></label
              >
              <div class="input-group has-validation">
                <span class="input-group-text">S$</span>
                <input
                  id="price"
                  v-model="form.price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputmode="decimal"
                  class="form-control"
                  :class="{
                    'is-invalid': fieldError('price'),
                    'needs-attention': nextField === 'price',
                  }"
                  data-testid="price"
                />
                <div class="invalid-feedback">{{ fieldError('price') }}</div>
              </div>
            </div>
            <div class="col-sm-6" :class="step('quantityTotal')">
              <label for="quantity" class="form-label fw-semibold"
                >Portions available
                <span v-if="isDone('quantityTotal')" class="field-done"
                  >✓<span class="visually-hidden"> filled in</span></span
                ></label
              >
              <input
                id="quantity"
                v-model="form.quantityTotal"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                class="form-control"
                :class="{
                  'is-invalid': fieldError('quantityTotal'),
                  'needs-attention': nextField === 'quantityTotal',
                }"
                data-testid="quantity"
              />
              <div class="invalid-feedback">{{ fieldError('quantityTotal') }}</div>
            </div>
          </div>

          <fieldset v-else class="mb-4" :class="step('quantityLevel')" data-testid="free-fields">
            <legend class="form-label fw-semibold fs-6">
              Roughly how much is left?
              <span v-if="isDone('quantityLevel')" class="field-done"
                >✓<span class="visually-hidden"> filled in</span></span
              >
            </legend>
            <div
              class="d-flex flex-wrap gap-2 rounded-3"
              :class="{ 'needs-attention': nextField === 'quantityLevel' }"
            >
              <template v-for="level in QUANTITY_LEVELS" :key="level.value">
                <input
                  :id="`qty-${level.value}`"
                  v-model="form.quantityLevel"
                  type="radio"
                  class="btn-check"
                  :value="level.value"
                  :data-testid="`qty-${level.value}`"
                />
                <label
                  class="btn btn-sm btn-outline-secondary rounded-pill px-3"
                  :for="`qty-${level.value}`"
                >
                  {{ level.label }}
                </label>
              </template>
            </div>
            <div v-if="fieldError('quantityLevel')" class="text-danger small mt-1">
              {{ errors.quantityLevel }}
            </div>
          </fieldset>

          <!-- Pickup -->
          <div class="mb-3" :class="step('address')">
            <label for="address" class="form-label fw-semibold"
              >Pickup location
              <span v-if="isDone('address')" class="field-done"
                >✓<span class="visually-hidden"> filled in</span></span
              ></label
            >
            <AddressPicker
              id="address"
              v-model="form.address"
              :class="{ 'needs-attention': nextField === 'address' }"
              :invalid="!!fieldError('address')"
              :pinned="form.lat != null && form.lng != null"
              placeholder="Enter an address or search OneMap"
              @select="onAddressSelect"
              @clear="onAddressClear"
              @results="searchResults = $event"
            >
              <!-- Added only when needed: WebKit does not re-lay-out a feedback element that
                   is revealed by the input's .is-invalid class, so Safari would keep it hidden. -->
              <template #feedback>
                <div v-if="fieldError('address')" class="invalid-feedback d-block">
                  {{ fieldError('address') }}
                </div>
              </template>
            </AddressPicker>
            <div class="form-text">
              <template v-if="geocoding">Looking up address…</template>
              <template v-else>Type an address, or use one of these:</template>
            </div>
            <div class="d-flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                class="btn btn-outline-success btn-sm"
                :disabled="locating || geocoding"
                data-testid="use-my-location"
                @click="useMyLocation"
              >
                <span
                  v-if="locating"
                  class="spinner-border spinner-border-sm"
                  aria-hidden="true"
                ></span>
                <span v-else aria-hidden="true">📍</span>
                {{ locating ? 'Finding your location…' : 'Use my location' }}
              </button>
              <button
                type="button"
                class="btn btn-outline-success btn-sm"
                :aria-expanded="showMap"
                data-testid="pick-on-map"
                @click="showMap = !showMap"
              >
                <span aria-hidden="true">🗺️</span> {{ showMap ? 'Hide map' : 'Pick on map' }}
              </button>
            </div>
            <div
              v-if="locateError"
              class="text-danger small mt-2"
              role="alert"
              data-testid="locate-error"
            >
              {{ locateError }}
            </div>
            <template v-if="showMap">
              <LocationMap
                class="mt-2"
                :results="searchResults"
                :lat="form.lat"
                :lng="form.lng"
                @pick="onMapPick"
              />
              <div class="form-text">Click the map to drop the pickup pin.</div>
            </template>
          </div>

          <div class="row g-2 mb-4">
            <div class="col-12" :class="step('date')">
              <label for="date" class="form-label fw-semibold"
                >Collection date
                <span v-if="isDone('date')" class="field-done"
                  >✓<span class="visually-hidden"> filled in</span></span
                ></label
              >
              <input
                id="date"
                v-model="form.date"
                type="date"
                :min="today"
                class="form-control"
                :class="{
                  'is-invalid': fieldError('date'),
                  'needs-attention': nextField === 'date',
                }"
                data-testid="date"
              />
              <div class="invalid-feedback">{{ fieldError('date') }}</div>
            </div>
            <div class="col-12 col-sm-6" :class="step('start')">
              <label for="start" class="form-label fw-semibold"
                >From
                <span v-if="isDone('start')" class="field-done"
                  >✓<span class="visually-hidden"> filled in</span></span
                ></label
              >
              <input
                id="start"
                v-model="form.start"
                type="time"
                step="60"
                class="form-control"
                :class="{
                  'is-invalid': fieldError('start'),
                  'needs-attention': nextField === 'start',
                }"
                data-testid="start"
                @click="$event.target.showPicker?.()"
              />
              <div class="invalid-feedback">{{ fieldError('start') }}</div>
            </div>
            <div class="col-12 col-sm-6" :class="step('end')">
              <label for="end" class="form-label fw-semibold"
                >Until
                <span v-if="isDone('end')" class="field-done"
                  >✓<span class="visually-hidden"> filled in</span></span
                ></label
              >
              <input
                id="end"
                v-model="form.end"
                type="time"
                step="60"
                class="form-control"
                :class="{ 'is-invalid': fieldError('end'), 'needs-attention': nextField === 'end' }"
                data-testid="end"
                @click="$event.target.showPicker?.()"
              />
              <div class="invalid-feedback">{{ fieldError('end') }}</div>
            </div>
          </div>

          <!-- Optional details: everything below can be left empty -->
          <section class="optional-details form-step" aria-labelledby="optional-details-heading">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
              <h2 id="optional-details-heading" class="h6 fw-semibold mb-0">More details</h2>
              <span class="optional-pill">Optional</span>
            </div>
            <p class="small text-secondary mb-3">
              You can post without these. Adding them helps people decide and find the food.
            </p>

            <div class="mb-3">
              <label for="description" class="form-label fw-semibold">Description</label>
              <textarea
                id="description"
                v-model="form.description"
                rows="3"
                maxlength="500"
                class="form-control"
                :class="{ 'is-invalid': fieldError('description') }"
                placeholder="What is it, how big is a portion, how was it prepared?"
                data-testid="description"
              ></textarea>
              <div class="form-text text-end">{{ form.description.length }}/500</div>
            </div>

            <div class="mb-3">
              <label for="instructions" class="form-label fw-semibold"
                >Collection instructions</label
              >
              <input
                id="instructions"
                v-model="form.collectionInstructions"
                type="text"
                class="form-control"
                placeholder="e.g. Back counter, ask for Mr Tan · Bring your own container"
                data-testid="instructions"
              />
            </div>

            <!-- Dietary & allergens -->
            <fieldset class="mb-3">
              <legend class="form-label fw-semibold fs-6">Dietary tags</legend>
              <div v-for="tag in DIETARY_TAGS" :key="tag" class="form-check form-check-inline">
                <input
                  :id="`diet-${tag}`"
                  v-model="form.dietaryTags"
                  type="checkbox"
                  :value="tag"
                  class="form-check-input"
                />
                <label class="form-check-label" :for="`diet-${tag}`">{{ tag }}</label>
              </div>
            </fieldset>

            <fieldset class="mb-4">
              <legend class="form-label fw-semibold fs-6">Contains</legend>
              <div
                v-for="allergen in ALLERGENS"
                :key="allergen"
                class="form-check form-check-inline"
              >
                <input
                  :id="`allergen-${allergen}`"
                  type="checkbox"
                  class="form-check-input"
                  :checked="form.allergens.includes(allergen)"
                  :data-testid="`allergen-${allergen}`"
                  @change="toggleAllergen(allergen, $event.target.checked)"
                />
                <label class="form-check-label" :for="`allergen-${allergen}`">{{ allergen }}</label>
              </div>
              <div class="form-text">Choose "Unknown" if you're not sure what's in it.</div>
              <div v-if="fieldError('allergens')" class="text-danger small mt-1">
                {{ errors.allergens }}
              </div>
            </fieldset>
          </section>

          <div
            v-if="submitted && Object.keys(errors).length"
            class="alert alert-danger py-2 small"
            role="alert"
            data-testid="form-errors"
          >
            Please fix the highlighted fields.
          </div>

          <div class="d-flex flex-column flex-sm-row gap-2 form-step">
            <button
              type="submit"
              class="btn btn-success flex-grow-1"
              :disabled="saving || geocoding"
              data-testid="submit"
            >
              <span
                v-if="saving"
                class="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              ></span>
              {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Post listing' }}
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              :disabled="saving"
              @click="router.back()"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <!-- Live preview: beside the form on desktop only. On phones and tablets it would
           sit below the whole form, out of sight while filling it in. -->
      <aside class="col-lg-5 d-none d-lg-block">
        <div class="preview">
          <h2 class="h6 text-uppercase text-secondary fw-semibold mb-2">Live preview</h2>
          <div data-testid="preview">
            <ListingCard :listing="previewListing" :photo-src="form.photoPreview" />
          </div>
          <p class="small text-secondary mt-2 mb-0">
            This is how your listing will appear to others.
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* Separates the optional fields from the required ones above. */
/* Shown once a photo is attached, so it's obvious the field is done. */
.photo-added {
  padding: 10px;
  border: 1px solid #b9dcc5;
  border-radius: 12px;
  background: #eef7f1;
}
.photo-thumb {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 8px;
  object-fit: cover;
}
.photo-added-title {
  color: #2f7d4f;
}
.min-w-0 {
  min-width: 0;
}
/* Green tick beside a required field's label once it's filled in. */
.field-done {
  margin-left: 4px;
  color: #2f7d4f;
  font-weight: 700;
}
/* The next required field to fill: a solid red outline with a glow that keeps
   spreading out from it, and a light red tint that comes and goes. */
.needs-attention {
  border-color: var(--color-accent);
  border-radius: var(--bs-border-radius);
  animation: attention-pulse 1.2s ease-out infinite;
}
@keyframes attention-pulse {
  0% {
    background-color: rgba(173, 69, 50, 0.12);
    box-shadow:
      0 0 0 2px var(--color-accent),
      0 0 0 2px rgba(173, 69, 50, 0.6);
  }
  70% {
    background-color: rgba(173, 69, 50, 0.03);
    box-shadow:
      0 0 0 2px var(--color-accent),
      0 0 0 12px rgba(173, 69, 50, 0);
  }
  100% {
    background-color: rgba(173, 69, 50, 0.12);
    box-shadow:
      0 0 0 2px var(--color-accent),
      0 0 0 12px rgba(173, 69, 50, 0);
  }
}
/* Without motion: a steady, thick outline instead of a pulse. */
@media (prefers-reduced-motion: reduce) {
  .needs-attention {
    animation: none;
    box-shadow:
      0 0 0 2px var(--color-accent),
      0 0 0 6px rgba(173, 69, 50, 0.25);
  }
}
/* Guided mode: every field except the next one to fill fades. Hovering over or
   clicking into a faded field brings it straight back, so the form can still be filled in
   any order. */
.form-step {
  transition: opacity 0.3s;
}
.guided .form-step:not(.is-current):not(:hover):not(:focus-within) {
  opacity: 0.6;
}
@media (prefers-reduced-motion: reduce) {
  .form-step {
    transition: none;
  }
}
/* Optional fields sit in their own tinted box, so it's clear they can be skipped. */
.optional-details {
  margin: 8px 0 24px;
  padding: 20px;
  border: 1px dashed var(--color-line);
  border-radius: 12px;
  background: var(--color-bg);
}
.optional-pill {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--color-line);
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 600;
}
@media (min-width: 992px) {
  .preview {
    position: sticky;
    top: 7rem;
    z-index: 1;
  }
}
</style>
