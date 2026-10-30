# AGENTS.md — LastBite

## Project and priorities

LastBite is an IS216 surplus-food application connecting people with free event leftovers and discounted outlet food in Singapore.

The progress pitch is complete. Improve the existing application towards the final submission.

Priorities:
1. Complete, reliable user journeys.
2. Attractive, responsive and intuitive frontend design.
3. Simple, correct code the team can explain.
4. Persistent data, meaningful API integration and appropriate permissions.
5. Repeatable testing and reliable deployment.

Inspect the current repository before editing. Preserve working features, teammates’ changes and established tools. Do not rebuild the application or perform unrelated refactoring.

## Course materials and requirements

Consult the relevant supplied Week 2–6 slides, latest LastBite proposal, instructor feedback and `Group Project Briefing G7 (1).pdf`. Use current instructor announcements for revised requirements.

Keep assessment requirements separate from project choices and optional enhancements. Do not invent requirements or claim to have read unavailable documents.

The final application requires:
- HTML, CSS and JavaScript with responsive design.
- Dynamic interaction with a backend data store.
- Meaningful use of an external public API through asynchronous HTTP requests.
- E2E testing for all core features.
- GitHub collaboration and remote deployment.
- Correct behaviour and layout in Google Chrome.

Within the final Presentation and Web Apps assessment:
- Problem solving and solution appropriateness: 20%.
- Working, correctly implemented and usable application: 27%.
- Styling and responsiveness: 18%.
- Testing: 10%.
- Presentation: 20%.
- Q&A: 5%.

Follow the brief’s submission, attribution and AI-use rules. Maintain the required `README.txt`, application files and presentation deliverables.

## Simple, explainable code

Prefer the existing Vue 3, Vite, JavaScript, Vue Router, Bootstrap and Axios approach. Preserve the actual backend and package manager.

Use syntax similar to the supplied slides:
- Vue Single-File Components with `<script setup>`.
- `ref`, `computed` and `onMounted` where appropriate.
- `v-model`, `v-if`, `v-for` with stable keys, and event bindings.
- `defineProps`, `defineEmits` and slots when useful.
- Named functions and `async/await` with `try/catch/finally`.

Use descriptive names, straightforward conditionals and readable array operations. Keep complex logic out of templates. Explain non-obvious decisions with brief comments.

Place route pages in `src/views` and reusable interface elements in `src/components`, following the existing structure. Separate backend requests from presentation when useful without adding unnecessary layers.

Do not introduce clever one-liners, excessive abstraction, unnecessary dependencies or a different language/framework.

The slides guide the approach; additional techniques are welcome when they solve a clear problem and the team can explain them.

## Frontend design and interactions

Design quality is a core deliverable. Create an impressive application through consistent typography, spacing, colours, food imagery, visual hierarchy and useful interactions.

Preserve the agreed direction:
- Food grid as the main landing content.
- Accessible Browse Food, Post Food and account navigation.
- Top-right profile avatar with account controls.
- Floating bottom-right posting `+` while browsing.
- No removed hero, pitch/prototype sections, demo banners or promotional slogans.
- Reset Demo only for isolated demo data.

Use Bootstrap, Flexbox, Grid and ordinary CSS purposefully. Avoid accumulating conflicting overrides.

Check mobile, tablet and desktop layouts, including approximately 375–1200px widths. Prevent overflow, clipped text and overlapping controls.

Every visible control must work. Provide clear validation, loading, empty, error and success states. Preserve input after failed saves and prevent duplicate submissions.

Use labelled inputs, accessible icon buttons, visible keyboard focus and keyboard/touch support.

## LastBite behaviour

1. Listings:
   Free buffet/event listings use walk-in collection and approximate or unspecified quantities.
   Discounted establishment listings require an exact positive integer quantity, positive SGD price and reservation; payment occurs at collection.
   Support photographs, pickup details, dietary/allergen information, conditional forms and live preview.
   Owners manage their listings. Closing preserves reservations; deletion requires no reservation records.

2. Discovery:
   Combine search, filters and sorting coherently.
   Keep map pins and food cards consistent.
   Use OneMap meaningfully for Singapore address search unless a replacement is agreed.
   Provide usable feedback and fallback when requests fail.

3. Reservations:
   Support booking, quantity changes, cancellation and provider-confirmed collection.
   Show quantity, price, deadline, instructions, pickup reference and status.
   Prevent overselling, duplicate adjustments and unauthorised actions.
   Preserve booking history and agreed prices.

4. Community updates:
   Apply to free listings.
   Support “Still available”, “Running low” and “All gone”, with required photographs and timestamps.
   Use the agreed 15-minute recent-update window.
   Reports must not delete another user’s listing. Flag unresolved automatic closure rules before implementing them.

5. Reviews:
   Allow one review per collected reservation from its customer.
   Support stars, tags, optional comments/photos, owner editing/deletion and provider replies.
   Keep establishment summaries accurate.

## Data, verification and completion

Use shared backend storage and durable photo storage. Enforce ownership, eligibility, validation and stock changes in the backend; hidden buttons are insufficient.

Keep privileged credentials out of frontend code and Git. Use localStorage only for appropriate preferences or isolated demos.

Display pickup times in Singapore time and prices in SGD. Handle expired windows and stale availability consistently.

Read `package.json`, the README and lockfile for actual setup, build and test commands. Do not invent commands.

Maintain repeatable E2E coverage for core journeys, permissions and meaningful failure cases. Use the existing framework; Playwright matches the slides.

For UI changes, inspect the affected screens in a browser on mobile and desktop. A successful build does not prove the interface works.

Before finishing:
- Run relevant available checks.
- Check affected journeys, routes, controls and responsive layouts.
- Update documentation when behaviour or setup changes.
- Report what changed, how it was verified and any remaining limitation.

Explain unfamiliar work through its data flow:
user action → Vue function → backend/request → result → updated interface.

Never claim something was tested, deployed or completed without evidence.