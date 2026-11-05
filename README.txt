LAST BITE
=========
Connects people in Singapore with surplus food: free leftovers from events and
buffets, and discounted end-of-day food from outlets.

Live app: https://last-bite-gamma.vercel.app
Stack:    Vue 3 (Vite), Vue Router, Pinia, Bootstrap 5, Axios, Supabase, OneMap


DEMO ACCOUNTS
-------------
  User:           drbingo@gmail.com / drbingo
  Establishment:  business2@gmail.com / businessing


SETUP AND RUN
-------------
Requires Node.js 22.18+ (or 24.12+) and pnpm.
  pnpm install -> check .env (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY;
  .env.example lists every setting) -> pnpm dev -> open http://localhost:5173
Production build: pnpm build (output in dist/, entry dist/index.html)


EXTERNAL API: ONEMAP
--------------------
OneMap (Singapore Land Authority) provides address search, reverse geocoding
and map tiles. Axios requests (src/utils/onemap.js) go through a proxy so the
credentials never reach the browser:
  - Local:    vite.config.js serves /api/onemap; ONEMAP_EMAIL and
              ONEMAP_PASSWORD go in .env (no VITE_ prefix).
  - Deployed: Supabase Edge Function supabase/functions/onemap, with the same
              two values as function secrets.
Address search is public (establishments pick a location while registering)
and works without credentials. Dropping a map pin (reverse geocoding) needs a
login and the credentials.

Where it is used:
  - Registration (AuthView.vue): establishments save a pickup location, which
    pre-fills each new listing (editable per listing).
  - /map (NearbyMapView.vue): open listings as pins, nearest first once the
    browser shares a location (else by pickup deadline), optional distance
    limit, same filters as Home. "Nearest to me" on Home sorts cards by
    straight-line distance.


DATA STORE
----------
Supabase (PostgreSQL + Supabase Auth). Accounts live in Supabase Auth; profiles
in the normal_user and establishment tables.

Run in Supabase dashboard -> SQL Editor, in this order:
  001_listings -> 002_reservations -> 003_reviews -> 004_pickup_codes
  -> 005_establishment_location -> 006_customer_reservations
(files in supabase/migrations/; 003 only needs 002.)
  004: six-digit pickup numbers (old references stay valid)
  005: establishment pickup location
  006: blocks establishment accounts from booking or changing booked quantities


RESERVATIONS
------------
Customer:      Browse food -> discounted listing -> pick portions -> Reserve
               -> 6-digit pickup number -> show it at collection and pay
               My reservations -> change portions or cancel before pickup ends
               (tabs: Active / Collected / Cancelled / Expired)
Establishment: My reservations -> orders for all your food -> check pickup
               number -> Mark collected
Behind Reserve: src/utils/reservations.js -> Supabase checks account, stock and
               deadline (listing locked to prevent overbooking) -> booking saved

Rules: only customers reserve; free food is walk-in only; bookings keep their
original price and history; closing a listing keeps its bookings; listings
with bookings cannot be deleted.


REVIEWS AND RATINGS
-------------------
Provider marks Collected -> customer sees "Write a review" in My Reservations
-> review form -> shown on the provider's page.
  - Review form (/reservations/:reservationId/review, ReviewFormView.vue):
    required 1-5 stars (StarRating.vue radio buttons: mouse, touch, arrow
    keys), optional tags (Fresh, As described, Generous portion, Easy to find),
    comment (500 chars) and photo. Same page edits or deletes.
  - Provider page (/establishments/:id, EstablishmentView.vue): average
    rating, review count, top tags, reviews by newest or highest. Authors edit
    or delete; the provider posts or edits a public reply.
  - Linked from discounted listings and the establishment dashboard.
Database rules (003_reviews.sql): one review per collected reservation, by its
customer, matching its listing and provider; authors change only rating, tags,
comment and photo, providers only the reply (trigger-checked); only authors
delete; photos go in the public review-photos bucket, own folder only.


SEARCH AND FILTERS
------------------
Home (Browse food) and /map share one Pinia store, src/stores/filters.js, so
filters carry across pages:
  - Search (title, address, description), food type (All / Free buffet /
    Reservation food), dietary tags (Halal, Vegetarian, Vegan, No pork/no lard;
    a listing must match every ticked tag) and "Available now".
  - Active filters show as removable tags (FilterTag.vue) in FilterBar.vue.
  - Home sorts newest first or by pickup deadline; /map by nearest or pickup
    ending soon. Expired/closed listings are hidden; countdowns refresh every
    30 s.
Data flow: input -> filters store -> computed filtered/sorted list -> ListingCard
Store: state (query, foodType, selectedDietary, availableNow, sortBy), getter
(activeTagsComputed), actions (matchesFunction, removeTagFunction,
clearAllFunction), following the Week 11 Pinia slides.


POST FOOD FORM
--------------
"Use my location" and saved pickup address.
Preview sits beside the form on desktop, below it on phone/tablet.
  - Buffet / event food: free, walk-in, approximate quantity (all users).
  - Reservation food: discounted, exact portions and price, pay at pickup
    (establishments only).
An edited listing keeps its original type, matching the database rules.


DESIGN AND ANIMATION
--------------------
  - Action feedback: posting, reserving, quantity changes, cancelling,
    collecting and close/reopen/delete -> useActionFeedback.js sends the
    request at once -> ActionFeedback.vue (FoodLoader.vue artwork) shows for at
    least 2 s, blocks duplicate actions, restores focus. Validation errors
    show immediately; backend errors keep entered details.
  - Pages show content when ready, with no loading messages; the frame keeps
    its height while fetching.
  - Logos in the header, Home and footer link to the top of Home; clicking
    Home again replays the entrance without re-fetching (useHomeNavigation.js,
    src/assets/main.css). My Listings uses the same 800 ms entrance.
  - Scroll position is restored on route changes; smooth scrolling only for
    same-page Browse food links.
  - Home 3D scene (src/components/HomeFoodScene.vue, Three.js, loaded on Home
    only): onMounted -> load Three.js and photos -> shared geometry/materials
    -> animation loop -> canvas. Porcelain plates (LatheGeometry) hold the
    real dish photos as textured domes, with instanced 3D ingredients piled on
    top; two small dishes orbit every 22 s and the mouse tilts the group.
    Pauses offscreen and in hidden tabs; releases GPU resources on leaving
    Home; falls back to a static illustration without WebGL.
    Docs: https://threejs.org/docs/
  - FoodVisual.vue is the account-page illustration.
  - All animation respects reduced motion. Logo font: Georgia; body: Inter.


TESTING
-------
  pnpm test:unit                       Unit tests (Vitest)
  pnpm exec playwright install         First time only, downloads browsers
  pnpm test:e2e                        All E2E tests (Playwright)
  pnpm lint                            Lint
Single suites: pnpm exec playwright test <file> --project=chromium, e.g. filters,
reservations, posting, loading-navigation, home-animation (.spec.js).


PROJECT STRUCTURE
-----------------
  src/views/        Route pages (Home, Auth, establishment dashboard, listings,
                    reservations, reviews)
  src/components/   Reusable UI (NavBar, AddressPicker, LocationMap,
                    FilterBar, FilterTag, HomeFoodScene, FoodVisual, AppToast)
  src/stores/       Pinia store (filters.js)
  src/composables/  Shared logic (action feedback, home navigation, toasts)
  src/utils/        Supabase client, session, OneMap, map helpers
  supabase/         OneMap Edge Function and SQL migrations
  e2e/              Playwright tests


THIRD-PARTY LIBRARIES
---------------------
Vue, Vue Router, Pinia, Bootstrap, Axios, Supabase JS, Leaflet (maps) and
Three.js (Home 3D scene): free, open-source, installed with pnpm (see
package.json). Inter font from Google Fonts (SIL Open Font License).


USE OF AI / LLM
---------------
Search and filters (Ryan Lee): Claude (Anthropic's AI assistant, used through
Claude Code) explained the Vue and Pinia concepts, reviewed code and wrote
parts of this feature.
  Written by Ryan, with AI explanations and hints:
    - The filters store (src/stores/filters.js): its state, matchesFunction,
      activeTagsComputed, removeTagFunction and clearAllFunction.
    - FilterTag.vue's label prop and remove event; FilterBar.vue's checkbox
      bindings and chips row.
    - Connecting the homepage (HomeView.vue) to the store and adding FilterBar.
    - Installing Pinia and registering it in main.js.
    - The HTML, Bootstrap classes and CSS of FilterBar.vue and FilterTag.vue.
    - Connecting the map page (NearbyMapView.vue) to the store and adding
      FilterBar, repeating the homepage wiring Ryan wrote, and the map list's
      "Pickup ending soon" sort (Ryan added its menu and mapSort ref).
    - The map's control row layout fixes (CSS: distance menu width, wrapping
      on phones).
    - src/stores/__tests__/filters.spec.js and e2e/filters.spec.js.
    - Food photos in the map list and pin popups, and the popup styling.

Post food form and site font:
  - Inter font for body text (index.html, main.css).
  - ListingFormView.vue: optional fields grouped in a "More details" box;
    the photo made required (listingValidation.js and its tests); Choose
    file / Take photo buttons with a "Photo added" thumbnail; the webcam
    panel (WebcamCapture.vue, using the browser's getUserMedia camera API);
    ticks on filled required fields, a pulse on the next one and fading of
    the rest; "Use my location" / "Pick on map" with the map hidden until
    asked; the live preview shown on desktop only.
  - The matching updates to e2e/posting.spec.js and
    e2e/establishment-location.spec.js.
