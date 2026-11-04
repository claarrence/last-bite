<script setup>
import { onMounted, ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { getCurrentUser } from '@/utils/session'
defineOptions({ name: 'EstablishmentDashboard' })

// Needed for the link to this establishment's public reviews page.
const userId = ref(null)
onMounted(async () => {
  userId.value = (await getCurrentUser())?.id ?? null
})
</script>

<template>
  <NavBar />
  <main class="container py-4">
    <div class="dashboard-intro mb-4">
      <h1 class="h2 page-title">Establishment dashboard</h1>
      <p class="text-secondary mb-3">Share surplus food and keep your listings up to date.</p>
      <router-link
        v-if="userId"
        :to="{ name: 'establishment', params: { id: userId } }"
        class="btn btn-outline-success"
        >Reviews of my food</router-link
      >
    </div>
  </main>
</template>
