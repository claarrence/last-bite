import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AuthView from '@/views/AuthView.vue'
import Dashboard from '@/views/establishment/Dashboard.vue'
import ListingFormView from '@/views/listings/ListingFormView.vue'
import MyListingsView from '@/views/listings/MyListingsView.vue'
import ListingDetailView from '@/views/listings/ListingDetailView.vue'
import NearbyMapView from '@/views/listings/NearbyMapView.vue'
import MyReservationsView from '@/views/reservations/MyReservationsView.vue'
import { getCurrentUser } from '@/utils/session'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    // Refresh/back navigation settles immediately. Only an in-page Browse click scrolls smoothly.
    if (savedPosition) return { ...savedPosition, behavior: 'instant' }
    if (to.hash) {
      const samePage = to.path === from.path && from.matched.length > 0
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      return {
        el: to.hash,
        top: 100,
        behavior: samePage && !reducedMotion ? 'smooth' : 'instant',
      }
    }
    return { top: 0, behavior: 'instant' }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/auth',
      name: 'auth',
      component: AuthView,
    },
    {
      path: '/team-notes',
      name: 'team-notes',
      component: () => import('@/views/TeamNotesView.vue'),
    },
    {
      path: '/establishment-dashboard',
      name: 'establishment-dashboard',
      component: Dashboard,
      meta: { requiresAuth: true },
    },
    {
      path: '/listing-form',
      name: 'listing-form',
      component: ListingFormView,
      meta: { requiresAuth: true },
    },
    {
      path: '/map',
      name: 'listings-map',
      component: NearbyMapView,
    },
    {
      path: '/listings/:id',
      name: 'listing-detail',
      component: ListingDetailView,
      props: true,
    },
    {
      path: '/listings/:id/edit',
      name: 'listing-edit',
      component: ListingFormView,
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/my-reservations',
      name: 'my-reservations',
      component: MyReservationsView,
      meta: { requiresAuth: true },
    },
    {
      path: '/my-listings',
      name: 'my-listings',
      component: MyListingsView,
      meta: { requiresAuth: true },
    },
  ],
})

// Protected pages require a signed-in user; database policies enforce ownership.
router.beforeEach(async (to) => {
  if (to.meta.requiresAuth && !(await getCurrentUser())) {
    return { name: 'auth', query: { redirect: to.fullPath } }
  }
})

export default router
