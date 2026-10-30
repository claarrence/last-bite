<script setup>
import { RouterView } from 'vue-router'
import BrandLogo from '@/components/BrandLogo.vue'
import AppToast from '@/components/AppToast.vue'
import { isSupabaseConfigured } from '@/utils/supabase'
</script>

<template>
  <main v-if="!isSupabaseConfigured" class="container py-5" data-testid="setup-notice">
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

  <template v-else>
    <RouterView />
    <AppToast />
    <footer class="container pt-4 d-flex flex-wrap justify-content-between gap-3 site-footer">
      <BrandLogo />
      <div class="d-flex gap-4">
        <router-link to="/#browse">Browse food</router-link>
        <router-link to="/listing-form">Post food</router-link>
      </div>
    </footer>
  </template>
</template>
