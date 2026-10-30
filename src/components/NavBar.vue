<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BrandLogo from '@/components/BrandLogo.vue'
import { supabase } from '@/utils/supabase'
import { getCurrentUser } from '@/utils/session'

defineProps({ brandOpacity: { type: Number, default: 1 } })
const brandElement = ref(null)
const menuOpen = ref(false)
defineExpose({ brandElement, menuOpen })

function closeMenu() {
  menuOpen.value = false
}

const user = ref(null)
const router = useRouter()
let subscription

// Profile avatar (top right) with the account links.
const accountOpen = ref(false)
const accountMenu = ref(null)
const initial = computed(() => (user.value ? user.value.email.charAt(0).toUpperCase() : ''))

function toggleAccount() {
  accountOpen.value = !accountOpen.value
}

function closeAccount() {
  accountOpen.value = false
}

// Clicking anywhere outside the avatar menu closes it.
function closeAccountOnOutsideClick(event) {
  if (accountMenu.value && !accountMenu.value.contains(event.target)) closeAccount()
}

// The navbar gains a soft shadow once the page scrolls beneath it.
const scrolled = ref(false)
function checkScroll() {
  scrolled.value = window.scrollY > 8
}

onMounted(async () => {
  window.addEventListener('resize', closeMenu)
  window.addEventListener('scroll', checkScroll, { passive: true })
  checkScroll()
  document.addEventListener('click', closeAccountOnOutsideClick)
  subscription = supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
  }).data.subscription
  user.value = await getCurrentUser()
})
onUnmounted(() => {
  subscription?.unsubscribe()
  window.removeEventListener('resize', closeMenu)
  window.removeEventListener('scroll', checkScroll)
  document.removeEventListener('click', closeAccountOnOutsideClick)
})

async function logout() {
  closeAccount()
  const { error } = await supabase.auth.signOut()
  if (error) return
  router.push('/')
}
</script>

<template>
  <nav
    class="navbar navbar-expand-sm app-navbar py-3"
    :class="{ 'navbar-scrolled': scrolled }"
    aria-label="Main navigation"
  >
    <div class="container">
      <router-link to="/" class="navbar-brand m-0" aria-label="Last Bite home"
        ><span ref="brandElement" class="nav-brand-target" :style="{ opacity: brandOpacity }"
          ><BrandLogo /></span
      ></router-link>

      <!-- Always visible; on wide screens it moves to the far right (order-sm-last). -->
      <div
        v-if="user"
        ref="accountMenu"
        class="account-menu order-sm-last ms-auto ms-sm-3"
        @keydown.esc="closeAccount"
      >
        <button
          type="button"
          class="avatar-button"
          aria-haspopup="true"
          :aria-expanded="accountOpen"
          :aria-label="`Account menu for ${user.email}`"
          data-testid="avatar-button"
          @click="toggleAccount"
        >
          {{ initial }}
        </button>
        <div v-if="accountOpen" class="account-dropdown" data-testid="account-dropdown">
          <p class="account-email">{{ user.email }}</p>
          <button type="button" class="account-link account-logout" @click="logout">Log out</button>
        </div>
      </div>
      <router-link
        v-else
        to="/auth"
        class="btn btn-sm btn-outline-success order-sm-last ms-auto ms-sm-3"
        >Log in</router-link
      >

      <button
        class="navbar-toggler ms-2"
        type="button"
        aria-controls="main-navigation"
        :aria-expanded="menuOpen"
        aria-label="Toggle navigation"
        @click="menuOpen = !menuOpen"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div id="main-navigation" class="collapse navbar-collapse" :class="{ show: menuOpen }">
        <div class="navbar-nav ms-auto align-items-sm-center gap-sm-3" @click="closeMenu">
          <router-link to="/#browse" class="nav-link">Browse food</router-link>
          <router-link to="/my-listings" class="nav-link">My listings</router-link>
          <router-link to="/my-reservations" class="nav-link">My reservations</router-link>
          <router-link to="/listing-form" class="nav-link">Post food</router-link>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.account-menu {
  position: relative;
}
.avatar-button {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  transition:
    background-color 200ms,
    box-shadow 200ms;
}
.avatar-button:hover,
.avatar-button[aria-expanded='true'] {
  background: #873325;
  box-shadow: 0 0 0 4px #ad453222;
}
.avatar-button:focus-visible {
  outline: 3px solid var(--color-ink);
  outline-offset: 2px;
}
.account-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 40;
  min-width: 220px;
  padding: 8px;
  background: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 14px;
  box-shadow: 0 16px 36px #332a201f;
  animation: menu-in 160ms ease-out;
}
.account-email {
  margin: 0 0 6px;
  padding: 8px 10px 10px;
  border-bottom: 1px solid var(--color-line);
  color: var(--color-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.account-link {
  display: block;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--color-ink);
  font-size: 14px;
  text-align: left;
  text-decoration: none;
}
.account-link:hover,
.account-link:focus-visible {
  background: var(--color-bg);
  color: var(--color-accent);
}
.account-logout {
  color: var(--color-accent);
}
@keyframes menu-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .account-dropdown {
    animation: none;
  }
}
</style>
