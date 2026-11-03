<script setup>
import { computed, ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { teamNotes } from '@/content/teamNotes'

const search = ref('')
const { runAction } = useActionFeedback()

function previewAction() {
  return runAction('Action animation preview…', () => Promise.resolve())
}
const visibleNotes = computed(() => {
  const query = search.value.trim().toLowerCase()
  return teamNotes.filter((note) => `${note.title} ${note.text}`.toLowerCase().includes(query))
})

const features = [
  {
    title: 'Accounts',
    status: 'Available',
    description: 'User and establishment registration, login and account controls.',
    to: '/auth',
    link: 'Open account screen',
  },
  {
    title: 'Food listings',
    status: 'Available',
    description:
      'Create, preview, edit, close and delete your listings. Includes photos and pickup details.',
    to: '/my-listings',
    link: 'Open My listings',
  },
  {
    title: 'Reservations & pickup',
    status: 'Ported',
    description:
      'Reserve discounted food, change portions, cancel, view history and confirm collection using the pickup number.',
    to: '/my-reservations',
    link: 'Open My reservations',
  },
  {
    title: 'Food discovery',
    status: 'Partial',
    description:
      'Food cards open listing details. Search, food-type filters and pickup sorting work together. OneMap supports pickup address selection; browse map pins are still pending.',
    to: '/#browse',
    link: 'Open Browse food',
  },
  {
    title: 'Community updates',
    status: 'To port',
    description:
      'Photo updates for free food and the 15-minute recent-update window are not implemented in this repo yet.',
  },
  {
    title: 'Establishment reviews',
    status: 'To port',
    description:
      'Reviews, ratings and provider replies are separate from the reservations port and are not included yet.',
  },
]
</script>

<template>
  <NavBar />
  <main class="container py-4 py-md-5 team-notes-page">
    <header class="mb-4">
      <span class="badge rounded-pill badge-sand mb-3">Temporary team page</span>
      <h1 class="page-title">Team notes</h1>
      <p class="text-secondary mb-0">
        A shared handover for the group: what is available, what still needs work and how we build
        Last Bite. Remove this page before the final submission.
      </p>
    </header>

    <section aria-labelledby="features-heading" class="mb-5">
      <h2 id="features-heading" class="h4 page-title mb-3">Feature handover</h2>
      <div class="row g-3">
        <div v-for="feature in features" :key="feature.title" class="col-md-6 col-lg-4">
          <article class="card h-100 notes-card">
            <div class="card-body d-flex flex-column align-items-start gap-3">
              <span
                class="badge rounded-pill"
                :class="
                  ['Available', 'Ported'].includes(feature.status) ? 'badge-green' : 'badge-sand'
                "
                >{{ feature.status }}</span
              >
              <h3 class="h5 mb-0">{{ feature.title }}</h3>
              <p class="small text-secondary mb-0">{{ feature.description }}</p>
              <router-link v-if="feature.to" :to="feature.to" class="small mt-auto">
                {{ feature.link }} <span aria-hidden="true">↗</span>
              </router-link>
            </div>
          </article>
        </div>
      </div>
      <p class="small text-secondary mt-3 mb-0">
        Database setup is required for live features. Run the listings migration, then
        <code>002_reservations.sql</code> and <code>004_pickup_codes.sql</code>. Reservation browser
        tests use mocked responses; live database permissions and stock changes still need checking.
      </p>
    </section>

    <details class="notes-section mb-5">
      <summary class="fw-semibold">Preview loading animation</summary>
      <div class="px-3 pb-3">
        <p class="text-secondary small mb-0">
          Ingredients land on a plate, steam rises and crumbs bounce. This appears for at least two
          seconds after posting, reserving or another important action. Pages show their content
          when it is ready. This preview does not save any data.
        </p>
        <button type="button" class="btn btn-outline-success my-3" @click="previewAction">
          Preview 2-second animation
        </button>
        <p class="text-secondary small mb-0">
          The artwork and CSS keyframes live in <code>src/components/FoodLoader.vue</code>.
          Reduced-motion preferences show a still illustration. The existing
          <code>useLandingMotion.js</code> handles the homepage logo’s scroll movement separately.
        </p>
      </div>
    </details>

    <section aria-labelledby="notes-heading">
      <h2 id="notes-heading" class="h4 page-title mb-3">Shared working notes</h2>
      <p class="text-secondary small">
        Read these before changing the app. They include target behaviour and assessment guidance;
        the feature cards above show the current implementation. Check supplied course materials and
        current instructor announcements for the official requirements.
      </p>
      <label for="notes-search" class="form-label small fw-semibold">Find a note</label>
      <input
        id="notes-search"
        v-model="search"
        type="search"
        class="form-control mb-3"
        placeholder="Search permissions, reservations, design…"
      />
      <p class="small text-secondary" role="status">
        {{ visibleNotes.length }} of {{ teamNotes.length }} sections
      </p>
      <div class="d-flex flex-column gap-3">
        <details v-for="note in visibleNotes" :key="note.title" class="notes-section">
          <summary class="fw-semibold">{{ note.title }}</summary>
          <div class="notes-text small">{{ note.text }}</div>
        </details>
      </div>
      <p v-if="!visibleNotes.length" class="text-secondary py-3">
        No matching notes. Try another word or clear the search.
      </p>
    </section>
  </main>
</template>

<style scoped>
.team-notes-page {
  overflow-wrap: anywhere;
}
.notes-card,
.notes-section {
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: var(--color-paper);
}
.notes-section summary {
  padding: 18px 20px;
  cursor: pointer;
}
.notes-section summary:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
  border-radius: 16px;
}
.notes-text {
  padding: 0 20px 20px;
  white-space: pre-wrap;
  line-height: 1.7;
}
</style>
