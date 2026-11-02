import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AuthView from '@/views/AuthView.vue'
import Dashboard from '@/views/establishment/Dashboard.vue'
import ListingFormView from '@/views/listings/ListingFormView.vue'
import MyListingsView from '@/views/listings/MyListingsView.vue'
import { getCurrentUser } from '@/utils/session'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to) {
    return to.hash ? { el: to.hash, top: 100, behavior: 'smooth' } : { top: 0 }
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
      path: '/listings/:id/edit',
      name: 'listing-edit',
      component: ListingFormView,
      props: true,
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
