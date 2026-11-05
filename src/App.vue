<script setup>
import { RouterView } from 'vue-router'
import BrandLogo from '@/components/BrandLogo.vue'
import AppToast from '@/components/AppToast.vue'
import ActionFeedback from '@/components/ActionFeedback.vue'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { useHomeNavigation } from '@/composables/useHomeNavigation'
import { isSupabaseConfigured } from '@/utils/supabase'

const { feedback } = useActionFeedback()
const { homeHref, goHome } = useHomeNavigation()
</script>

<template>
  <main
    v-if="!isSupabaseConfigured"
    class="container py-5"
    data-testid="setup-notice"
  >
    <BrandLogo />
    <div class="alert alert-warning mt-4" role="alert">
      <h1 class="h5">Supabase is not configured</h1>
      <p>
        Copy <code>.env.example</code> to <code>.env</code> in the project root and fill in
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>. Both are in
        the Supabase dashboard under Project Settings → API.
      </p>
      <p class="mb-0">Save the file, then stop and restart <code>pnpm dev</code>.</p>
    </div>
  </main>

  <div v-else class="d-flex flex-column min-vh-100" :inert="feedback.active" :aria-busy="feedback.active">
    <RouterView />
    <AppToast />
    <footer class="container mt-auto pt-4 d-flex flex-wrap justify-content-between gap-3 site-footer">
      <a :href="homeHref" class="text-decoration-none" aria-label="Last Bite home" @click="goHome">
        <BrandLogo />
      </a>
      <div class="d-flex flex-wrap gap-4">
        <router-link to="/#browse">Browse food</router-link>
        <router-link to="/listing-form">Post food</router-link>
      </div>
    </footer>
  </div>
  <ActionFeedback />
</template>
