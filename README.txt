LAST BITE
=========

Last Bite connects people in Singapore with surplus food: free leftovers from
events and buffets, and discounted end-of-day food from outlets, so less of it
goes to waste.

Built with Vue 3 (Vite), Vue Router, Bootstrap 5, Axios, Supabase and OneMap.


LIVE APPLICATION
----------------
Landing page URL: TODO (add the deployed URL)


DEMO ACCOUNTS
-------------
TODO (add a user and an establishment login for the graders)
  User:           email / password
  Establishment:  email / password


SETUP AND RUN
-------------
Requirements: Node.js 22.18+ (or 24.12+) and pnpm.

  1. pnpm install
  2. Check the .env file in the project root. It holds the browser-safe
     Supabase settings:
       VITE_SUPABASE_URL
       VITE_SUPABASE_PUBLISHABLE_KEY
     .env.example lists every supported setting.
  3. pnpm dev
  4. Open the URL printed in the terminal (usually http://localhost:5173).

Production build: pnpm build  (output in dist/, index.html is the entry page)


EXTERNAL API: ONEMAP
--------------------
OneMap (Singapore Land Authority) provides address search, reverse geocoding
and map tiles. Requests are sent asynchronously with Axios
(src/utils/onemap.js) through a small proxy so the OneMap credentials never
reach the browser:

  - Local development: vite.config.js serves /api/onemap.
    Add ONEMAP_EMAIL and ONEMAP_PASSWORD to .env (no VITE_ prefix).
  - Deployed: the Supabase Edge Function in supabase/functions/onemap,
    with the same two values set as function secrets.


DATA STORE
----------
Supabase (PostgreSQL database + Supabase Auth). Accounts are stored in Supabase
Auth; profiles are stored in the normal_user and establishment tables.


TESTING
-------
Unit tests (Vitest):
  pnpm test:unit

End-to-end tests (Playwright):
  pnpm exec playwright install      (first time only, downloads browsers)
  pnpm test:e2e
The E2E tests mock Supabase responses, so no real accounts are created.

Lint: pnpm lint


PROJECT STRUCTURE
-----------------
  src/views/        Route pages (HomeView, AuthView, establishment/Dashboard)
  src/components/   Reusable UI (NavBar, BrandLogo, FoodVisual, AddressPicker,
                    LocationMap, PostFoodButton, AppToast)
  src/composables/  Shared logic (landing logo animation, toast messages)
  src/utils/        Supabase client, session helpers, OneMap requests
  supabase/         OneMap Edge Function
  e2e/              Playwright tests


THIRD-PARTY LIBRARIES
---------------------
Vue, Vue Router, Bootstrap, Axios, Supabase JS, Leaflet (maps). All are free,
open-source libraries installed through pnpm (see package.json).


AI / LLM USE
------------
TODO: each member to list the parts they relied on AI/LLM for.
  - Project starter setup (copying the initial pages into this repository) and
    the CSS animations (navbar underline/shadow, hero entrance, placeholder
    shimmer) were produced with AI assistance (Claude).
