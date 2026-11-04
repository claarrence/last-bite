LAST BITE
=========

Last Bite connects people in Singapore with surplus food: free leftovers from
events and buffets, and discounted end-of-day food from outlets, so less of it
goes to waste.

Built with Vue 3 (Vite), Vue Router, Pinia, Bootstrap 5, Axios, Supabase and OneMap.


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

Address search is public so establishments can choose their pickup location
while registering, before they have a session; it also works without OneMap
credentials (OneMap returns results with a "token missing" warning). Dropping
a pin on the map (reverse geocoding) still needs a login and the credentials.
Redeploy the onemap function after pulling this change.

Establishments choose a pickup location when registering (AuthView.vue). It
is saved on their establishment row and pre-fills each new listing they post;
they can still change it per listing. Accounts created before this have no
saved location.

The /map page (NearbyMapView.vue, "View on map" on the homepage) shows open
listings as pins, nearest first once the browser shares a location (or sorted
by pickup deadline), with an optional distance limit. It applies the same
filters as the homepage (see SEARCH AND FILTERS). "Nearest to me" on the
homepage sorts the food grid by straight-line distance and shows it on each
card.


DATA STORE
----------
Supabase (PostgreSQL database + Supabase Auth). Accounts are stored in Supabase
Auth; profiles are stored in the normal_user and establishment tables.

Reservations setup (Supabase dashboard -> SQL Editor):
  1. Run supabase/migrations/001_listings.sql if listings are not set up yet.
  2. Run supabase/migrations/002_reservations.sql.
  3. Run supabase/migrations/004_pickup_codes.sql for six-digit pickup numbers.
  4. Run supabase/migrations/005_establishment_location.sql for the pickup
     location establishments choose at registration.
  5. Run supabase/migrations/003_reviews.sql for reviews and ratings (it only
     needs 002, so it can run before or after 004 and 005).
Existing pickup references remain valid after running 004.

RESERVATIONS
------------
Ported from claarrence/A-Plus-for-WAD2 (ece974e), retaining its reservation
rules, database functions, quantity stepper and pickup ticket.

Browse food -> open a discounted listing -> choose portions -> Reserve.
The returned booking shows its pickup number and agreed price; payment is at
collection. My reservations supports quantity changes, cancellation and Active,
Collected, Cancelled and Expired history tabs. Providers open their listing from
My listings and enter the customer's pickup number to confirm collection.
Free listings remain walk-in only.

Data flow: a Vue action calls src/utils/reservations.js -> Supabase RPC ->
PostgreSQL validates permissions, stock and pickup deadline -> the returned
reservation updates the interface. Database row locks prevent overselling, and
booking records keep their agreed unit price. Closing a listing preserves its
bookings; a listing with reservation records cannot be deleted.

The listing detail page and food grid make bookings reachable. The homepage
now has local search, type filters, pickup-deadline and distance sorting, and
a link to the food map.
No migrations are applied automatically by running the frontend.

REVIEWS AND RATINGS
-------------------
Ported from claarrence/A-Plus-for-WAD2.

After a provider marks a reservation Collected, its customer can review the
order. My Reservations shows a prompt and a "Write a review" link on each
collected order.

  - Review form (/reservations/:reservationId/review, ReviewFormView.vue):
    1-5 stars, optional quick tags (Fresh, As described, Generous portion,
    Easy to find), an optional comment (500 characters) and an optional
    photo. A rating is required. The same page edits or deletes the review.
  - StarRating.vue: the stars are radio buttons, so they work with mouse,
    touch and the keyboard (arrow keys).
  - Establishment page (/establishments/:id, EstablishmentView.vue): name and
    type, average rating, number of reviews and most common tags, with
    reviews sorted by most recent or highest rated. Authors edit or delete
    their own review here, and the provider can post or edit a public reply.
  - Links: the rating summary and "See this provider's reviews" on
    discounted listings, and "Reviews of my food" on the establishment
    dashboard.

Rules enforced in the database (003_reviews.sql):
  - Only the customer of a collected reservation can review it, and only
    once (reservation_id is unique). The review must match that
    reservation's listing and provider.
  - Authors can change only their rating, tags, comment and photo; providers
    can change only the reply (a trigger checks which columns changed). Only
    authors can delete.
  - Review photos go in a separate public bucket (review-photos); users
    upload only into their own folder.


TESTING
-------
Unit tests (Vitest):
  pnpm test:unit

End-to-end tests (Playwright):
  pnpm exec playwright install      (first time only, downloads browsers)
  pnpm test:e2e
The E2E tests mock Supabase responses, so no real accounts are created.
Search and filter tests (store logic, then Browse/map journeys in all three browsers):
  pnpm test:unit --run src/stores
  pnpm exec playwright test filters.spec.js
Reservation regression tests:
  pnpm test:unit --run
  pnpm exec playwright test reservations.spec.js --project=chromium
These browser tests cover frontend requests and interactions, not live database
permissions or concurrent stock changes. Verify those against a test Supabase
project after applying the migrations.

Lint: pnpm lint


PROJECT STRUCTURE
-----------------
  src/views/        Route pages (HomeView, AuthView, establishment/Dashboard,
                    reviews/ReviewFormView, reviews/EstablishmentView)
                    listings/ListingDetailView, listings/NearbyMapView,
                    reservations/MyReservationsView
  src/components/   Reusable UI (NavBar, BrandLogo, FoodVisual, AddressPicker,
                    LocationMap, PostFoodButton, AppToast, FilterBar, FilterTag)
  src/stores/       Pinia stores (filters.js: search and filters shared by
                    the homepage and the map)
  src/composables/  Shared logic (landing logo animation, toast messages)
  src/utils/        Supabase client, session helpers, OneMap requests,
                    map helpers (map.js: pins, bounds, distances)
  supabase/         OneMap Edge Function and listing/reservation migrations
  e2e/              Playwright tests


THIRD-PARTY LIBRARIES
---------------------
Vue, Vue Router, Pinia (shared state), Bootstrap, Axios, Supabase JS, Leaflet
(maps) and Three.js (homepage rendering). All are free,
open-source libraries installed through pnpm (see package.json).


TEAM NOTES (TEMPORARY)
----------------------
Open /team-notes, or use the Team notes link in the footer, for the current
feature handover and shared project working notes. No login is needed.
Contributors and coding assistants should read src/content/teamNotes.js before
changing the app. These notes describe target behaviour as well as work still
to do; the feature cards distinguish what is currently available.

To remove this temporary page before submission: remove the /team-notes route,
the footer link, src/views/TeamNotesView.vue and src/content/teamNotes.js, and
update this section. Keep any project guidance the group still needs elsewhere.


ACTION ANIMATION
----------------
The plate/food SVG and CSS keyframes remain in src/components/FoodLoader.vue.
Pages show their content when ready, without loading messages or animations.
The page frame keeps its height while fetching, and errors remain visible.

After valid posting, reservation, quantity changes, cancellation, collection
confirmation, and listing close/reopen/delete, useActionFeedback.js starts the
real request immediately and displays ActionFeedback.vue for at least two
seconds. It stays visible for longer requests, prevents duplicate actions,
blocks background controls and restores focus afterwards. Validation errors
remain immediate; backend errors still preserve entered details.

The artwork respects reduced motion. No animation library is required.
Preview it with the two-second button on /team-notes. Simply opening the Post
food page does not trigger the animation; submitting its form does.

Course references also include the supplied Week 10 Testing (v1.1) and Week 11
Vue Part 4 (v1.1) decks; their summaries are on the Team notes page.

Page-load stability: route changes and browser history restore their scroll
position immediately. Smooth scrolling is used only for a Browse food link
within the same page (and respects reduced motion). The navbar reserves its
account-control space before the session loads. The homepage logo measures its
first pose after the router restores scrolling, so it starts in the right place.
Regression checks: pnpm exec playwright test loading-navigation.spec.js --project=chromium

POST FOOD FORM
--------------
The posting page uses the Bootstrap form and side-by-side live preview from
A-Plus-for-WAD2's tejaaas branch (ece974e). It keeps this repo's OneMap requests,
browser-location button, saved establishment pickup address and loading state.
The preview stacks below the form on phone and tablet, and sits beside it on
desktop. Posting type is shown at the top:
  - Buffet / event food: free, walk-in, approximate quantity.
  - Reservation food: discounted, exact portions and price, pay at pickup.
Normal users see buffet / event food only. Establishment accounts can choose
either type. An existing listing keeps its original type when edited, matching
the database rules.
Browser regression checks: pnpm exec playwright test posting.spec.js --project=chromium

The Last Bite logos in the header, homepage and footer link to the top of Home.
Clicking again on Home replays the upward entrance for the large logo and food
scene without re-fetching listings. useHomeNavigation.js handles the shared
click behaviour; src/assets/main.css contains the shared page entrance, while
HomeView.vue sets the food and button delays. Modified clicks still
open normal links in another tab, and reduced-motion preferences skip the effect.

My Listings uses the same 800ms upward entrance for its heading and results.
Results animate when data arrives, including empty/error states; reduced motion
skips the effect. No loading message or artificial request delay is added.


HOMEPAGE AND SHARED DESIGN
--------------------------
The logo uses one Georgia serif style in src/assets/main.css on all routes;
Home changes its size for the large version. Duplicate page font overrides
have been removed. The compact food illustration, shared badge colours and
Bootstrap controls keep the browse grid prominent. Footer links reserve room
for the floating posting button.

Search, food type, dietary tags and "Available now" combine (see SEARCH AND
FILTERS); results can keep the backend's newest-first order or sort by pickup
deadline. Expired/closed listings are excluded, and countdowns refresh every
30 seconds (the interval is removed on leaving Home). Empty results offer a
clear action, without example data.

Data flow: input/button -> filters store -> computed filtered/sorted list ->
existing ListingCard components. Supabase remains the source of listings and
reservation stock. Browser checks use mocked data; they do not add real food or
reservations.

The homepage's 3D food scene is isolated in src/components/HomeFoodScene.vue.
Three.js loads on Home only, then WebGL renders glossy porcelain plates
holding the real dish photos, plus floating tofu cubes, tomatoes and lettuce
leaves. Each plate's food is a shallow dome textured with the food cropped
from public/images. On a canvas the photo is sharpened (unsharp mask) so it
stays crisp, and its edge is darkened so it sits inside the plate. A blurred
grey copy of the photo is its displacement map, so the surface is lumpy
rather than flat. 3D tofu, tomatoes, lettuce, quail eggs, edamame, corn,
cucumber, red cabbage, spring onion, chickpeas and sweet potato are piled on
top so each dish pops out of its plate; the tofu, cucumber and leaf textures
are cut from the same photos. A RoomEnvironment
gives soft reflections and a directional light casts soft shadows onto an
invisible floor. The two small dishes keep the 22-second orbit around the large one; mouse movement tilts the group.

Data flow: onMounted -> load Three.js and the photos -> create shared
geometry/materials -> animation loop -> canvas. Ingredients use instancing
so repeated pieces share a draw call. The plate shape comes from
rotating a short cross-section (LatheGeometry); tofu uses RoundedBoxGeometry.
One set of geometry/materials is reused where possible. No model files,
post-processing stack or extra state library are needed.

Reduced motion draws a still view. Rendering pauses offscreen and in hidden
tabs; observers, listeners, materials and GPU resources are released
when leaving Home. A static three-plate illustration stays visible while the
renderer loads, if WebGL is unavailable, or if the graphics context is lost.
Stars and dots complete the faint brown dotted backdrop. Mouse position controls horizontal yaw, vertical tilt and slight
parallax; leaving the artwork returns it to centre. No loading message or
animation controls are added. FoodVisual.vue still supplies the account-page illustration; FoodLoader.vue handles action feedback.

The Vue lifecycle, refs and async/await follow the slides. Three.js rendering
is an additional project design choice, with one new dependency. Its separate
chunk loads after Home mounts. Official API: https://threejs.org/docs/
Browser checks: pnpm exec playwright test home-animation.spec.js --project=chromium


SEARCH AND FILTERS
------------------
Owner: Ryan Lee.

The homepage (Browse food) and the /map page share one Pinia store,
src/stores/filters.js, so a filter chosen on one page still applies on the other:
  - Search (title, pickup address, description), food type (All / Free buffet /
    Reservation food), dietary tags (Halal, Vegetarian, Vegan, No pork/no lard)
    and "Available now" (pickup window has already started).
  - A listing must have every ticked dietary tag, so Halal + Vegetarian shows
    only food that is both.
  - Each active filter appears as a removable tag (FilterTag.vue); "Clear all"
    resets them. FilterBar.vue holds the checkboxes and tags on both pages.
  - Filters are saved in localStorage (key lastbite-filters) and survive a page
    refresh. The sort order is not saved, so "Nearest to me" never asks for the
    user's location as soon as the page opens.
  - The map list has its own sort: nearest first, or pickup ending soon.

Store: state (query, foodType, selectedDietary, availableNow, sortBy), a getter
(activeTagsComputed) and actions (matchesFunction, removeTagFunction,
clearAllFunction), following the Week 11 Pinia slides.


CODE WALKTHROUGH
----------------
Use the Week 2–6 CSS, Bootstrap and Vue examples, plus Week 10 testing and
Week 11 composables, as references. Pages keep their own ref/reactive state;
computed values drive filtering, validation and previews. Components receive
props and emit events. Named functions use async/await with try/catch/finally.

A save flows from a button -> Vue function -> src/utils request -> Supabase
validation -> returned result -> updated state and interface. Shared stateful
behaviour stays in src/composables; reusable interface pieces stay in components.
Map bounds and listing coordinates share src/utils/map.js. Home and My Listings
share the page-enter CSS animation. Unused map factories, reservation lookup,
loader variants and duplicate CSS have been removed. No packages or database
rules were changed by this cleanup.


USE OF AI / LLM
---------------
Search and filters (Ryan Lee): Claude (Anthropic's AI assistant, used through
Claude Code) explained the Vue and Pinia concepts, reviewed code and wrote
parts of this feature.
  Written by Ryan, with AI explanations and hints:
    - The filters store's state (query, foodType, selectedDietary,
      availableNow, sortBy).
    - The food-type check in matchesFunction, clearAllFunction, and the
      food-type, search and dietary tags in activeTagsComputed.
    - The "Available now" checkbox binding.
  Written by AI (setup, markup, styling and tests, which the course allows):
    - Installing Pinia and registering it in main.js.
    - The HTML, Bootstrap classes and CSS of FilterBar.vue and FilterTag.vue.
    - The map's distance menu width fix (CSS).
    - src/stores/__tests__/filters.spec.js and e2e/filters.spec.js.
