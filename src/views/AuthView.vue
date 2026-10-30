<script setup>
import { supabase } from '@/utils/supabase'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandLogo from '@/components/BrandLogo.vue'
import FoodVisual from '@/components/FoodVisual.vue'

const route = useRoute()
const router = useRouter()

// Send the user back to the page that bounced them to login, else to their role's home page.
// Only internal paths are accepted so ?redirect= can't point off-site.
function redirectAfterLogin(fallback) {
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    router.replace(redirect)
  } else {
    router.replace({ name: fallback })
  }
}

const showPassword = ref(false)
const mode = ref('login')
const role = ref('user')
const profileTable = computed(() => (role.value === 'user' ? 'normal_user' : 'establishment'))

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const businessType = ref('')

function resetForm() {
  showPassword.value = false
  name.value = ''
  email.value = ''
  password.value = ''
  confirmPassword.value = ''
  businessType.value = ''
}

function validateInput() {
  if (!email.value.trim()) return false
  if (!password.value.trim()) return false

  if (mode.value === 'register') {
    if (!name.value.trim()) return false
    if (password.value !== confirmPassword.value) return false
  }
  if (role.value === 'establishment' && mode.value === 'register') {
    if (!businessType.value) return false
  }

  return true
}

async function register() {
  if (!validateInput()) return
  const { data, error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
  })
  if (error) {
    alert(error.message)
    return
  }

  const profile = { id: data.user.id, name: name.value }
  if (role.value === 'establishment') profile.business_type = businessType.value
  const { error: profileError } = await supabase.from(profileTable.value).insert(profile)
  if (profileError) alert(profileError.message)
}

async function login() {
  if (!validateInput()) return
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  if (error) {
    alert(error.message)
    return
  }

  const { error: profileError } = await supabase
    .from(profileTable.value)
    .select('name')
    .eq('id', data.user.id)
    .single()
  if (profileError) {
    alert(profileError.message)
    return
  }
  redirectAfterLogin(role.value === 'user' ? 'home' : 'establishment-dashboard')
}
</script>

<template>
  <main class="auth-page">
    <div class="container">
      <header class="auth-header">
        <router-link to="/" class="text-decoration-none" aria-label="Last Bite home"
          ><BrandLogo
        /></router-link>
        <router-link to="/" class="back-link"
          >Browse food <span aria-hidden="true">↗</span></router-link
        >
      </header>

      <div class="auth-layout">
        <div class="auth-art"><FoodVisual interactive /></div>

        <section class="auth-form-panel" aria-labelledby="auth-heading">
          <div class="auth-mode" role="group" aria-label="Account access">
            <input
              id="mode-login"
              v-model="mode"
              class="btn-check"
              type="radio"
              name="mode"
              value="login"
              @change="resetForm"
            />
            <label for="mode-login">Log in</label>
            <input
              id="mode-register"
              v-model="mode"
              class="btn-check"
              type="radio"
              name="mode"
              value="register"
              @change="resetForm"
            />
            <label for="mode-register">Register</label>
          </div>

          <h1 id="auth-heading" class="auth-title">
            {{ mode === 'login' ? 'Log in' : 'Create account' }}
          </h1>

          <fieldset class="role-fieldset">
            <legend>Account type</legend>
            <div class="role-options">
              <input
                id="role-user"
                v-model="role"
                class="btn-check"
                type="radio"
                name="role"
                value="user"
                @change="resetForm"
              />
              <label for="role-user" class="role-option">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="3" />
                  <path d="M5 21v-3a7 7 0 0 1 14 0v3" />
                </svg>
                <span><strong>User</strong></span>
                <span class="role-indicator" aria-hidden="true"></span>
              </label>
              <input
                id="role-establishment"
                v-model="role"
                class="btn-check"
                type="radio"
                name="role"
                value="establishment"
                @change="resetForm"
              />
              <label for="role-establishment" class="role-option">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M3 10h18l-2-6H5l-2 6ZM5 10v10h14V10M9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"
                  />
                </svg>
                <span><strong>Establishment</strong></span>
                <span class="role-indicator" aria-hidden="true"></span>
              </label>
            </div>
          </fieldset>

          <!-- One form serves both modes; the existing login/register functions handle submission. -->
          <form class="auth-form" @submit.prevent="mode === 'login' ? login() : register()">
            <div v-if="mode === 'register'" class="auth-field">
              <label for="auth-name" class="form-label">{{
                role === 'user' ? 'Full name' : 'Establishment name'
              }}</label>
              <input
                id="auth-name"
                v-model="name"
                class="form-control"
                type="text"
                :autocomplete="role === 'user' ? 'name' : 'organization'"
                required
              />
            </div>
            <div class="auth-field">
              <label for="auth-email" class="form-label">{{
                role === 'user' ? 'Email address' : 'Business email'
              }}</label>
              <input
                id="auth-email"
                v-model="email"
                class="form-control"
                type="email"
                autocomplete="username"
                required
              />
            </div>
            <div v-if="mode === 'register' && role === 'establishment'" class="auth-field">
              <label for="auth-business" class="form-label">Establishment type</label>
              <select id="auth-business" v-model="businessType" class="form-select" required>
                <option disabled value="">Choose one</option>
                <option>Hawker Stall</option>
                <option>Hotel</option>
                <option>Restaurant</option>
                <option>Event Organiser</option>
              </select>
            </div>
            <div class="auth-field">
              <label for="auth-password" class="form-label">Password</label>
              <div class="password-field">
                <input
                  id="auth-password"
                  v-model="password"
                  class="form-control"
                  :type="showPassword ? 'text' : 'password'"
                  :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                  required
                />
                <button
                  type="button"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  :aria-pressed="showPassword"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? 'Hide' : 'Show' }}
                </button>
              </div>
            </div>
            <div v-if="mode === 'register'" class="auth-field">
              <label for="auth-confirm" class="form-label">Confirm password</label>
              <input
                id="auth-confirm"
                v-model="confirmPassword"
                class="form-control"
                type="password"
                autocomplete="new-password"
                required
              />
              <p
                v-if="confirmPassword && password !== confirmPassword"
                class="text-danger small mt-2 mb-0"
                role="status"
              >
                Passwords don’t match.
              </p>
            </div>
            <button type="submit" class="btn btn-success auth-submit">
              {{ mode === 'login' ? 'Log in' : 'Create account' }} <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.auth-page {
  padding-bottom: 56px;
}
.auth-page .container {
  max-width: 1060px;
}
.auth-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 28px 0;
}
.back-link {
  color: var(--color-muted);
  font-size: 13px;
  text-decoration: none;
}
.back-link span {
  margin-left: 6px;
}
.back-link:hover {
  color: var(--color-accent);
}
.auth-layout {
  display: grid;
  grid-template-columns: 1fr 1.05fr;
  border: 1px solid var(--color-line);
  border-radius: 26px;
  overflow: hidden;
  background: var(--color-paper);
  box-shadow: 0 18px 60px #332a2008;
  animation: auth-arrive 700ms ease both;
}
.auth-art {
  display: flex;
  align-items: center;
  padding: 40px;
  background: #efe1d4;
  overflow: hidden;
}
.auth-form-panel {
  padding: 40px 44px 44px;
}
.auth-mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  border: 1px solid var(--color-line);
  border-radius: 11px;
  margin-bottom: 36px;
  background: var(--color-bg);
}
.auth-mode label {
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  color: var(--color-muted);
  cursor: pointer;
  transition:
    background 220ms,
    color 220ms,
    box-shadow 220ms;
}
.auth-mode .btn-check:checked + label {
  background: var(--color-ink);
  color: var(--color-paper);
  box-shadow: 0 3px 8px #28252018;
}
.btn-check:focus-visible + label {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}
.auth-title {
  font-family: Georgia, serif;
  font-size: 44px;
  font-weight: 400;
  letter-spacing: -1.6px;
  margin: 0 0 30px;
}
.role-fieldset {
  margin: 0 0 24px;
}
.role-fieldset legend {
  float: none;
  width: auto;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 10px;
}
.role-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.role-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 12px;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  cursor: pointer;
  transition:
    background 220ms,
    border-color 220ms,
    transform 220ms;
}
.role-option svg {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  stroke: var(--color-muted);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.role-option strong {
  display: block;
  font-size: 12px;
  font-weight: 600;
}
.role-indicator {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
.role-options .btn-check:checked + label {
  border-color: var(--color-accent);
  background: #f9ece5;
}
.role-options .btn-check:checked + label svg {
  stroke: var(--color-accent);
}
.role-options .btn-check:checked + label .role-indicator {
  background: var(--color-accent);
}
.auth-field {
  margin-bottom: 18px;
  animation: field-arrive 250ms ease both;
}
.auth-form .form-label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}
.auth-form .form-control,
.auth-form .form-select {
  min-height: 46px;
  background-color: #fdfbf7;
  font-size: 14px;
}
.auth-form .form-control:focus {
  background-color: var(--color-paper);
}
.password-field {
  position: relative;
}
.password-field input {
  padding-right: 65px;
}
.password-field button {
  position: absolute;
  right: 8px;
  top: 7px;
  padding: 7px 9px;
  color: var(--color-muted);
  font-size: 11px;
  border: 0;
  border-radius: 5px;
  background: transparent;
}
.password-field button:hover {
  background: #f9ece5;
  color: var(--color-accent);
}
.auth-submit {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 14px 18px;
  font-size: 13px;
  font-weight: 600;
  margin-top: 28px;
}
.auth-submit span {
  font-size: 18px;
  transition: transform 250ms;
}
.auth-submit:hover span {
  transform: translateX(5px);
}
@keyframes auth-arrive {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes field-arrive {
  from {
    opacity: 0;
    translate: 0 5px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
@media (max-width: 991px) {
  .auth-form-panel {
    padding: 32px 26px;
  }
  .auth-art {
    padding: 28px;
  }
  .role-option {
    gap: 7px;
    padding: 16px 9px;
  }
  .role-option strong {
    font-size: 11px;
  }
}
@media (max-width: 767px) {
  .auth-page {
    padding-bottom: 28px;
  }
  .auth-header {
    padding: 20px 0;
  }
  .auth-layout {
    grid-template-columns: 1fr;
    border-radius: 20px;
  }
  .auth-art {
    height: 220px;
    justify-content: center;
    padding: 14px;
  }
  .auth-art :deep(.food-scene) {
    width: 190px;
    flex-shrink: 0;
  }
  .auth-form-panel {
    padding: 28px 24px 32px;
  }
  .auth-mode {
    margin-bottom: 28px;
  }
  .auth-title {
    font-size: 36px;
    margin-bottom: 24px;
  }
}
@media (max-width: 359px) {
  .auth-form-panel {
    padding: 24px 18px;
  }
  .role-option svg {
    width: 17px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .auth-layout,
  .auth-field {
    animation: none;
  }
  .auth-mode label,
  .role-option,
  .auth-submit span {
    transition: none;
  }
  .auth-submit:hover span {
    transform: none;
  }
}
</style>
