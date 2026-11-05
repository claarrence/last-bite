// Third-party libraries beyond the course material:
// Supabase JS (database, auth, storage), Leaflet (maps), Three.js (homepage 3D scene).
// README.txt lists all the app's libraries; package.json also has the dev tools.
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import 'bootstrap/dist/css/bootstrap.min.css'
import './assets/main.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
