<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import AddressPicker from '@/components/AddressPicker.vue'
import LocationMap from '@/components/LocationMap.vue'
import ListingCard from '@/components/listings/ListingCard.vue'
import { useToast } from '@/composables/useToast'
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
import { isInSingapore } from '@/utils/map'
import { toDateTime, validateListing } from '@/utils/listingValidation'
import { toDateInput, toTimeInput } from '@/utils/format'
import { ALLERGENS, DIETARY_TAGS, QUANTITY_LEVELS, UNKNOWN_ALLERGEN } from '@/utils/listingOptions'

// Set when editing (/listings/:id/edit); empty when creating (/listing-form).
const props = defineProps({ id: { type: String, default: '' } })

const router = useRouter()
const { show: showToast } = useToast()

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

function onPhoto(event) {
  const file = event.target.files?.[0] ?? null
  revokePreview()
  form.photoFile = file
  form.photoPreview = file
    ? URL.createObjectURL(file)
    : form.existingPhotoPath
      ? photoUrl(form.existingPhotoPath)
      : ''
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

function getBrowserPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    })
  })
}

async function useMyLocation() {
  locateError.value = ''
  if (!('geolocation' in navigator)) {
    locateError.value = 'Your browser cannot share its location. Search for the address instead.'
    return
  }
  // Browsers only share location on HTTPS or localhost.
  if (!window.isSecureContext) {
    locateError.value = 'Location needs a secure (https://) connection. Search for the address instead.'
    return
  }
  locating.value = true
  try {
    const position = await getBrowserPosition()
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
    if (form.photoFile) uploadedPath = await uploadListingPhoto(form.photoFile, userId.value)
    const payload = buildPayload(uploadedPath ?? form.existingPhotoPath)

    if (isEdit.value) {
      await updateListing(props.id, payload)
      if (uploadedPath) await removeListingPhoto(form.existingPhotoPath)
    } else {
      await createListing({ ...payload, listing_type: form.listingType })
    }

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

  <div class="container listing-page py-4">
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
    </div>

    <div v-else-if="loadError" class="alert alert-danger" role="alert">{{ loadError }}</div>

    <div v-else class="studio-layout listing-studio">
      <section class="studio-panel">
        <h1 class="studio-title">{{ isEdit ? 'Edit listing' : 'List your food' }}</h1>
        <p class="text-secondary mb-4">
          {{
            isEdit
              ? 'Update the details people see.'
              : 'Share surplus food before it goes to waste.'
          }}
        </p>

        <form class="studio-form" novalidate data-testid="listing-form" @submit.prevent="submit">
          <!-- Step 1: the food -->
          <section class="form-step" aria-labelledby="step-food">
            <header class="step-header">
              <span class="step-number" aria-hidden="true">1</span>
              <div>
                <h2 id="step-food" class="step-title">The food</h2>
                <p class="step-hint">What are you sharing, and how do people get it?</p>
              </div>
            </header>

            <fieldset class="mb-3">
              <legend class="form-label">Listing type</legend>
              <div class="type-options">
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
                <label class="choice-option" for="type-free">
                  <strong>Free</strong>
                  <small>Walk in, no booking</small>
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
                  <label class="choice-option" for="type-discounted">
                    <strong>Discounted</strong>
                    <small>Reserve, pay at pickup</small>
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

            <div class="row g-3">
              <div class="col-xl-7">
                <label for="title" class="form-label">Food item</label>
                <input
                  id="title"
                  v-model="form.title"
                  type="text"
                  class="form-control"
                  maxlength="80"
                  :class="{ 'is-invalid': fieldError('title') }"
                  placeholder="e.g. Nasi lemak sets, Buffet pastries"
                  autocomplete="off"
                  data-testid="title"
                />
                <div class="invalid-feedback">{{ fieldError('title') }}</div>
              </div>
              <div class="col-xl-5">
                <label for="photo" class="form-label"
                  >Photograph <span class="optional">optional</span></label
                >
                <input
                  id="photo"
                  type="file"
                  accept="image/*"
                  class="form-control"
                  :class="{ 'is-invalid': fieldError('photo') }"
                  data-testid="photo"
                  @change="onPhoto"
                />
                <div class="invalid-feedback">{{ fieldError('photo') }}</div>
                <div class="form-text">
                  Up to 5 MB.
                  <template v-if="isEdit">Leave empty to keep the current photo.</template>
                </div>
              </div>
              <div class="col-12">
                <label for="description" class="form-label"
                  >Description <span class="optional">optional</span></label
                >
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
            </div>
          </section>

          <!-- Step 2: quantity and price -->
          <section class="form-step" aria-labelledby="step-amount">
            <header class="step-header">
              <span class="step-number" aria-hidden="true">2</span>
              <div>
                <h2 id="step-amount" class="step-title">How much</h2>
                <p class="step-hint">
                  {{
                    form.listingType === 'discounted'
                      ? 'Exact portions and price, so people can reserve.'
                      : 'A rough amount is fine for walk-in food.'
                  }}
                </p>
              </div>
            </header>

            <div
              v-if="form.listingType === 'discounted'"
              class="row g-3"
              data-testid="discounted-fields"
            >
              <div class="col-sm-6">
                <label for="price" class="form-label">Price per portion</label>
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
                    :class="{ 'is-invalid': fieldError('price') }"
                    data-testid="price"
                  />
                  <div class="invalid-feedback">{{ fieldError('price') }}</div>
                </div>
              </div>
              <div class="col-sm-6">
                <label for="quantity" class="form-label">Portions available</label>
                <input
                  id="quantity"
                  v-model="form.quantityTotal"
                  type="number"
                  min="1"
                  step="1"
                  inputmode="numeric"
                  class="form-control"
                  :class="{ 'is-invalid': fieldError('quantityTotal') }"
                  data-testid="quantity"
                />
                <div class="invalid-feedback">{{ fieldError('quantityTotal') }}</div>
              </div>
            </div>

            <fieldset v-else data-testid="free-fields">
              <legend class="form-label">Roughly how much is left?</legend>
              <div class="d-flex flex-wrap gap-2">
                <template v-for="level in QUANTITY_LEVELS" :key="level.value">
                  <input
                    :id="`qty-${level.value}`"
                    v-model="form.quantityLevel"
                    type="radio"
                    name="quantityLevel"
                    class="btn-check"
                    :value="level.value"
                    :data-testid="`qty-${level.value}`"
                  />
                  <label
                    class="btn btn-sm btn-outline-success rounded-pill px-3"
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
          </section>

          <!-- Step 3: where and when -->
          <section class="form-step" aria-labelledby="step-pickup">
            <header class="step-header">
              <span class="step-number" aria-hidden="true">3</span>
              <div>
                <h2 id="step-pickup" class="step-title">Pickup</h2>
                <p class="step-hint">Where to collect it and during which hours.</p>
              </div>
            </header>

            <div class="mb-3">
              <button
                type="button"
                class="locate-button"
                :disabled="locating || geocoding"
                data-testid="use-my-location"
                @click="useMyLocation"
              >
                <span
                  v-if="locating"
                  class="spinner-border spinner-border-sm"
                  aria-hidden="true"
                ></span>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  <circle cx="12" cy="12" r="8" />
                </svg>
                {{ locating ? 'Finding your location…' : 'Use my location' }}
              </button>
              <div
                v-if="locateError"
                class="text-danger small mt-2"
                role="alert"
                data-testid="locate-error"
              >
                {{ locateError }}
              </div>
              <div class="or-divider" aria-hidden="true"><span>or search an address</span></div>

              <label for="address" class="form-label">Pickup location</label>
              <AddressPicker
                id="address"
                v-model="form.address"
                :invalid="!!fieldError('address')"
                :pinned="form.lat != null && form.lng != null"
                placeholder="Enter an address or search OneMap"
                @select="onAddressSelect"
                @clear="onAddressClear"
                @results="searchResults = $event"
              >
                <template #feedback>
                  <div class="invalid-feedback">{{ fieldError('address') }}</div>
                </template>
              </AddressPicker>
              <div class="form-text">
                <template v-if="geocoding">Looking up address…</template>
                <template v-else>Type an address. Map selection is optional.</template>
              </div>
              <LocationMap
                class="mt-2"
                :results="searchResults"
                :lat="form.lat"
                :lng="form.lng"
                @pick="onMapPick"
              />
            </div>

            <div class="mb-3">
              <label for="instructions" class="form-label"
                >Collection instructions <span class="optional">optional</span></label
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

            <div class="row g-3">
              <div class="col-12 col-xl-6">
                <label for="date" class="form-label">Collection date</label>
                <input
                  id="date"
                  v-model="form.date"
                  type="date"
                  :min="today"
                  class="form-control"
                  :class="{ 'is-invalid': fieldError('date') }"
                  data-testid="date"
                />
                <div class="invalid-feedback">{{ fieldError('date') }}</div>
              </div>
              <div class="col-6 col-xl-3">
                <label for="start" class="form-label">From</label>
                <input
                  id="start"
                  v-model="form.start"
                  type="time"
                  step="60"
                  class="form-control"
                  :class="{ 'is-invalid': fieldError('start') }"
                  data-testid="start"
                  @click="$event.target.showPicker?.()"
                />
                <div class="invalid-feedback">{{ fieldError('start') }}</div>
              </div>
              <div class="col-6 col-xl-3">
                <label for="end" class="form-label">Until</label>
                <input
                  id="end"
                  v-model="form.end"
                  type="time"
                  step="60"
                  class="form-control"
                  :class="{ 'is-invalid': fieldError('end') }"
                  data-testid="end"
                  @click="$event.target.showPicker?.()"
                />
                <div class="invalid-feedback">{{ fieldError('end') }}</div>
              </div>
            </div>
          </section>

          <!-- Step 4: dietary information -->
          <section class="form-step" aria-labelledby="step-dietary">
            <header class="step-header">
              <span class="step-number" aria-hidden="true">4</span>
              <div>
                <h2 id="step-dietary" class="step-title">Dietary info</h2>
                <p class="step-hint">Tap everything that applies.</p>
              </div>
            </header>

            <fieldset class="mb-3">
              <legend class="form-label">
                Dietary tags <span class="optional">optional</span>
              </legend>
              <div class="chip-list">
                <!-- Real checkboxes laid over each chip, so clicks, keyboard and screen readers all work. -->
                <label v-for="tag in DIETARY_TAGS" :key="tag" class="chip-check">
                  <input
                    :id="`diet-${tag}`"
                    v-model="form.dietaryTags"
                    type="checkbox"
                    :value="tag"
                  />
                  <span>{{ tag }}</span>
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend class="form-label">Contains <span class="optional">optional</span></legend>
              <div class="chip-list">
                <label v-for="allergen in ALLERGENS" :key="allergen" class="chip-check">
                  <input
                    :id="`allergen-${allergen}`"
                    type="checkbox"
                    :checked="form.allergens.includes(allergen)"
                    :data-testid="`allergen-${allergen}`"
                    @change="toggleAllergen(allergen, $event.target.checked)"
                  />
                  <span>{{ allergen }}</span>
                </label>
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

          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-success submit-arrow flex-grow-1"
              :disabled="saving || geocoding"
              data-testid="submit"
            >
              <span>
                <span
                  v-if="saving"
                  class="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"
                ></span>
                {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Post listing' }}
              </span>
              <span class="arrow" aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary px-4"
              :disabled="saving"
              @click="router.back()"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>

      <!-- Live preview -->
      <aside class="studio-panel studio-tint">
        <div class="preview">
          <h2 class="preview-label">Live preview</h2>
          <div data-testid="preview">
            <ListingCard :listing="previewListing" :photo-src="form.photoPreview" />
          </div>
          <p class="small text-secondary mt-3 mb-0">
            This is how your listing will appear to others.
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.listing-studio {
  grid-template-columns: 1fr;
}
.type-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
/* Numbered steps break the long form into four short chunks. */
.form-step {
  padding: 28px 0;
  border-top: 1px solid var(--color-line);
}
.form-step:first-child {
  padding-top: 0;
  border-top: 0;
}
.step-header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 20px;
}
.step-number {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #f9ece5;
  color: var(--color-accent);
  font-size: 13px;
  font-weight: 700;
}
.step-title {
  font-family: Georgia, serif;
  font-size: 22px;
  font-weight: 400;
  margin: 2px 0 2px;
}
.step-hint {
  color: var(--color-muted);
  font-size: 13px;
  margin: 0;
}
.optional {
  margin-left: 4px;
  color: var(--color-muted);
  font-weight: 400;
}
/* Friendlier file picker button. */
.studio-form input[type='file']::file-selector-button {
  margin-right: 12px;
  border: 0;
  border-right: 1px solid var(--color-line);
  background: #f9ece5;
  color: var(--color-accent);
  font-weight: 600;
}
/* Large, obvious "Use my location" action above the address search. */
.locate-button {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 12px 18px;
  border: 1.5px solid var(--color-accent);
  border-radius: 12px;
  background: #f9ece5;
  color: var(--color-accent);
  font-size: 16px;
  font-weight: 600;
  transition: background 200ms, color 200ms;
}
.locate-button svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}
.locate-button:hover:not(:disabled) {
  background: var(--color-accent);
  color: #fff;
}
.locate-button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}
.locate-button:disabled {
  opacity: 0.7;
}
.or-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 14px;
  color: var(--color-muted);
  font-size: 12px;
}
.or-divider::before,
.or-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--color-line);
}
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip-check {
  position: relative;
}
/* The checkbox covers the whole chip but is invisible; the span below draws the chip. */
.chip-check input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.chip-check span {
  display: inline-block;
  padding: 7px 14px;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-paper);
  font-size: 14px;
  transition:
    background 200ms,
    border-color 200ms,
    color 200ms;
}
.chip-check:hover span {
  border-color: var(--color-peach);
}
.chip-check input:checked + span {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: #fff;
}
.chip-check input:focus-visible + span {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.form-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
}
.preview-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: 14px;
}
@media (min-width: 576px) {
  .form-actions {
    flex-direction: row;
  }
}
@media (min-width: 768px) {
  .listing-studio {
    grid-template-columns: 1.5fr 1fr;
  }
  .preview {
    position: sticky;
    top: 7rem;
    z-index: 1;
  }
}
@media (min-width: 1200px) {
  .listing-studio {
    grid-template-columns: 1.8fr 1fr;
  }
  .listing-studio .studio-panel:first-child {
    padding: 48px 56px;
  }
}
/* Wider page on large screens so the form has room to breathe. */
@media (min-width: 1400px) {
  .listing-page {
    max-width: 1320px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .chip-check span,
  .locate-button {
    transition: none;
  }
}
</style>
