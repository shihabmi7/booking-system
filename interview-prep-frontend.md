# Frontend / React / TypeScript — Interview Prep Notes

Running log of Q&A this project has actually touched, updated as we complete each phase.
Each answer ties back to real code in `frontend/`, not abstract theory.

---

## Phase 1 — Project setup

**Q: Why can't you just use a regular variable instead of `useState`?**
A: A regular variable's changes don't trigger a re-render — React has no way of knowing the value changed,
so the UI would never update. `const [health, setHealth] = useState(null)` gives you a value (`health`) that
persists across renders, plus a setter (`setHealth`) that both updates the value and tells React to
re-render the component with the new value.

**Q: What's the difference between `useEffect(fn)`, `useEffect(fn, [])`, and `useEffect(fn, [dep])`?**
A: `useEffect(fn)` with no dependency array runs after every single render. `useEffect(fn, [])` with an
empty array runs once, after the first render only — this project uses that form to fetch `/api/health`
exactly once when the page loads. `useEffect(fn, [dep])` runs after the first render and then again any
time `dep` changes between renders.

**Q: Why does my `useEffect` run twice in development?**
A: React's `<StrictMode>` (wrapping `<App />` in `main.tsx`) intentionally double-invokes some functions,
including effects, in development only — it's a deliberate check to help surface bugs in code that isn't
idempotent (e.g. an effect that isn't safe to run twice). It does not happen in production builds, so it's
safe to ignore as long as your effect doesn't have unintended side effects from running twice.

**Q: How would you handle a frontend and backend running on different ports locally?**
A: Two common options: configure CORS on the backend to explicitly allow the frontend's origin, or proxy
requests through the frontend's dev server so the browser only ever talks to one origin. This project uses
the second approach — Vite's `server.proxy` config forwards any `/api/*` request from `localhost:5173` to
`localhost:4000` behind the scenes, so `App.tsx` can call `fetch("/api/health")` as a plain relative path.

**Q: What's TypeScript's role in a Vite/React project if it doesn't emit the JS?**
A: TypeScript only type-checks — it never compiles the code here. That's what `"noEmit": true` in
`frontend/tsconfig.json` means. Vite (via esbuild/Rollup) does the actual compiling and bundling, and it's
much faster at stripping types than `tsc` is at full compilation. Running `tsc` separately (or your editor's
TS server) is what catches type errors; Vite just needs valid JS/JSX underneath.

**Q: How do you conditionally render elements in JSX?**
A: Common pattern is `&&` short-circuiting: `{error && <p>...</p>}` renders the `<p>` only if `error` is
truthy, and renders nothing (JSX ignores `false`/`null`/`undefined`) otherwise. `App.tsx` uses three of
these side by side — one for the error state, one for the loading state, one for the loaded state — as a
lightweight alternative to an if/else chain or a ternary.

---

## Phase 2 — Routing & real data

**Q: What does `BrowserRouter` actually do, and why does it wrap the whole app in `main.tsx`?**
A: `BrowserRouter` uses the browser's History API to keep the URL in sync with what's rendered, without
a full page reload on navigation. It has to wrap the entire app (in `main.tsx`, around `<App />`) because
every component that uses routing features — `<Routes>`, `<Route>`, `<NavLink>`, or hooks like `useNavigate`
— needs to read from that router context, and context only flows downward to descendants.

**Q: What's the difference between `<Route>` and `<NavLink>`?**
A: `<Route path="/services" element={<ServicesPage />} />` defines *what renders* when the URL matches
that path — it's configuration, not something the user sees. `<NavLink to="/services">Services</NavLink>`
is an actual clickable link the user sees and clicks to navigate there. `NavLink` specifically (vs plain
`Link`) also knows whether its own path is currently active, which this project uses to bold the current
page in the nav bar.

**Q: Why split `App.tsx` into a layout shell plus separate page components instead of one large file?**
A: Each page (`HomePage`, `ServicesPage`) only needs to know about its own data and rendering — `App.tsx`
only needs to know about navigation and which page goes with which URL. Keeping them separate means
adding a new screen later (booking, check-in) is "add a file in `src/pages/` + one line in `App.tsx`"
instead of growing one already-large file further.

**Q: The `/api/services` response includes a `price` field that's actually a string, not a number — why?**
A: Prisma's `Decimal` type (`price Decimal @db.Decimal(10, 2)` in the schema) is used for money specifically
because floating-point numbers can't represent decimal fractions like `19.99` exactly, which causes rounding
errors in financial calculations. `Decimal` avoids that on the database and Prisma side, but JSON has no
native decimal type — so it serializes as a string over the wire, and the frontend's `Service` type reflects
that (`price: string`) rather than lying about it being a `number`.

**Q: What happens if you call `.map()` on `services` before checking it's not `null`?**
A: TypeScript would flag it as an error at compile time — `services` is typed `Service[] | null`, and
`null` has no `.map()` method. This project's `ServicesPage` guards with `{services && services.length > 0 && (...)}`
before rendering the table, which both satisfies TypeScript's null check and avoids a runtime crash on
the initial render when the fetch hasn't resolved yet.

---

## Phase 3 — Booking flow

**Q: `BookPage` has two `useEffect` calls — one with `[]` and one with `[selectedServiceId, date]`.
Why not combine them into one?**
A: They run for different reasons and at different times. The `[]` effect loads the service list
exactly once, when the page first mounts — there's nothing to depend on. The
`[selectedServiceId, date]` effect needs to re-run every time the user changes either the service
or the date, because the slots it fetches depend on both. Combining them would mean re-fetching
the entire service list every time the user just changes the date, which is wasteful and wrong.

**Q: Why does changing the selected service also clear `selectedSlot`, even though the user didn't touch the slot picker?**
A: A previously selected slot belongs to the *previous* service/date combination — its `startTime`
was only valid because of the fetch that returned it. If the service changes and the app kept the
old `selectedSlot` around, the booking form could submit a startTime that doesn't correspond to
any real availability for the newly selected service. Clearing it forces the user to pick a slot
that's actually valid for their current selection.

**Q: The booking form handles a `409` response specially instead of just treating it like any other error. Why?**
A: A `409` here means something *specific and recoverable*: someone else booked that slot in the
gap between this page loading it and the user submitting. The right response isn't just showing an
error message — it's clearing the stale `selectedSlot` and re-fetching the slot list so the taken
slot disappears and the user can immediately pick another one. A generic error handler would leave
the user stuck retrying a slot that will never succeed.

**Q: What does `useParams` do, and why does `BookingDetailsPage` need it?**
A: `useParams()` reads the dynamic segments of the current URL as defined by the route — for
`<Route path="/bookings/:bookingRef" element={<BookingDetailsPage />} />`, visiting
`/bookings/abc-123` makes `useParams()` return `{ bookingRef: "abc-123" }`. The component uses that
value to know which booking to fetch, without the parent needing to pass it as a prop — the URL
itself is the source of that data.

**Q: Why do both `BookPage` (after a successful submit) and `FindBookingPage` (after a manual
search) send the user to the same `/bookings/:bookingRef` route instead of each having its own
confirmation screen?**
A: There's no meaningful difference between "a booking that was just created" and "a booking someone
looked up" once you have the reference — the details to show are identical. Reusing one route
avoids maintaining two near-duplicate confirmation UIs, and it's the same URL shape a QR code
(Phase 4) will encode and link straight into.

---

## Post-Phase 3 addition — Holidays & working hours

**Q: `BookPage` had `setSlots` called directly inside the fetch `.then()`, but now there's a
`refreshSlots` helper function instead. Why extract it?**
A: The same fetch-and-set logic needed to run from two different places: the `useEffect` that
watches service/date changes, and the 409-handler in `handleSubmit` that needs to refresh slots
after a booking conflict. Without extracting it, both places would duplicate the same
`fetch` + `URLSearchParams` + `.then()` chain, and a future change (like adding an extra query
param) would have to be made twice and could easily drift out of sync.

**Q: Why does the "no open slots" message only show when there's no closure `note`?**
A: They're two different situations that need two different messages. If `note` is set, the
backend has already explained *why* there's nothing available (a holiday or weekly closure) — showing
a generic "no open slots" underneath it would be redundant and slightly conflicting. The condition
`!closureNote && slots.length === 0` specifically means "the day is open, but every slot happens to
already be booked," which is worth saying differently than "the business is closed today."

---

## Phase 4 — QR check-in

**Q: The QR code is just rendered as `<img src={booking.qrCode} />`. What makes that work when `qrCode` is a string, not a file path?**
A: `qrCode` is a data URL — a string that starts with `data:image/png;base64,` followed by the
image's raw bytes encoded as base64 text. The `src` attribute of an `<img>` doesn't require an
actual file or network request; a data URL is a complete, self-contained representation of the
image that the browser decodes and renders directly. This is why the backend can generate it
fresh on every request with no file storage involved — the whole image lives in the JSON response.

**Q: `QueuePage` calls `refreshQueue()` after every check-in/no-show/complete action instead of updating the local state directly (e.g. finding the booking in the array and changing its status). Why the extra round trip?**
A: Updating local state directly would require duplicating the server's logic on the client —
what `isLate` becomes, what the new `status` is, whether the action even succeeded. Re-fetching
the whole queue guarantees the UI reflects exactly what the server has, including the `isLate`
calculation the server owns. It's a few hundred extra milliseconds for a staff-facing internal
tool, which is a reasonable trade for not having two sources of truth that can drift apart.

**Q: Why does `CheckInPage` treat a 404 (unknown booking reference) and a 409 (invalid state, e.g. already checked in) the same way in its error handling?**
A: From the staff user's point of view, both are just "this didn't work, here's why" — the UI
doesn't need to branch its behavior differently for the two cases, since it's not attempting any
different recovery action for either (unlike `BookPage`'s 409 handling, which specifically
refreshes the slot list). Reading the `error` message from the response body and displaying it
directly is enough here; over-engineering distinct handling for every status code only pays off
when the UI actually does something different in response.

---

## Phase 5 — Auth & roles

**Q: Why use React context (`AuthContext`) for the logged-in user instead of just keeping `token`/`user` as state in `App.tsx` and passing them down as props?**
A: Auth is needed in components at very different depths of the tree — the nav bar (top-level,
to show login/logout), `RequireAuth` (wraps individual routes), and `QueuePage`/`CheckInPage`
(deep inside a specific page) all need the current token. Passing it as props would mean every
intermediate component (`App` → `Routes` → the page) has to accept and forward `token`/`user`
even if it never uses them itself — "prop drilling." Context lets any descendant call `useAuth()`
directly and read the current value, regardless of how deep it is, without every layer in between
needing to know auth exists.

**Q: `AuthContext` reads from `localStorage` inside `useState(loadStoredAuth)` instead of an empty
initial value plus a `useEffect`. Why?**
A: `useState(loadStoredAuth)` — passing a function instead of a value — makes React call it exactly
once, synchronously, on the component's first render, and use the result as the initial state.
Doing it as a `useEffect` instead would mean the component first renders with `token: null` (looking
logged-out for a frame), then the effect runs and sets the real state, causing a visible flash —
briefly showing "Staff Login" in the nav bar before flipping to the logged-in view even though the
user was already logged in. Reading `localStorage` synchronously during the initial state
computation avoids that flash entirely.

**Q: What does `RequireAuth` actually protect — is `/api/queue` still safe if someone bypasses it?**
A: `RequireAuth` only protects the *frontend experience* — it stops the browser from rendering
`QueuePage` and firing its fetch calls if there's no token, giving a clean redirect instead of a
page full of failed-request errors. It provides zero real security by itself: someone could still
call `curl http://localhost:4000/api/queue` directly with no token at all, bypassing the React app
entirely. The actual security is `requireAuth`/`requireRole` on the *backend* routes (see the
backend interview-prep notes) — those reject the request regardless of what UI (if any) made it.
This is a common interview point: client-side route guards are a UX nicety, never a substitute for
server-side authorization.

**Q: Why does `RequireAuth` pass `state={{ from: location.pathname }}` to `<Navigate>` instead of just always redirecting to `/queue` after login?**
A: Without it, a user who bookmarked `/checkin` directly, got redirected to `/login`, and logged in
would land on `/queue` instead of the page they actually wanted — a small but annoying UX gap.
`useLocation()` reads the current path before redirecting, and `<Navigate state={...}>` carries it
along as router state (not a URL query param, so it's invisible and doesn't get bookmarked/shared).
`LoginPage` then reads `location.state?.from` after a successful login and navigates there instead
of a hardcoded default.

**Q: `CheckInPage` and `QueuePage` each check for a `401` response and call `logout()` manually. Why isn't that handled in one shared place, like a fetch wrapper?**
A: It could be — a shared `authFetch()` helper that automatically attaches the header and handles
401s is a reasonable refactor once more than two pages need it, and is exactly the kind of thing
worth mentioning as a "next improvement" in an interview. It wasn't done yet here mainly to keep
each page's data flow explicit and easy to trace while still learning the pattern; the duplication
between two pages is small enough to tolerate for now, but would become a real maintenance problem
if a third or fourth staff-facing page needed the same logic.

**Q: The token is sent as `Authorization: Bearer <token>` on each request instead of, say, a custom header or a query param. Why that specific format?**
A: `Authorization: Bearer <token>` is the standard convention for token-based auth (defined in
RFC 6750) — the backend's `requireAuth` middleware expects exactly this format
(`req.headers.authorization?.split(" ")`). Using a query param instead would leak the token into
server logs, browser history, and the `Referer` header of any outgoing links from that page —
tokens should never appear in a URL. A custom header would work technically, but `Authorization:
Bearer` is what every HTTP client, proxy, and API testing tool (including this project's Postman
collection) already expects by convention, so there's no reason to invent a nonstandard one.

---

## Post-Phase 5 addition — Admin settings UI

**Q: `CheckInPage` and `QueuePage` were flagged in the Phase 5 notes as "worth refactoring once a third page needs the same fetch logic." Why wait instead of extracting `useAuthFetch` immediately?**
A: This is the "rule of three" — two instances of near-identical code are often just coincidence
or too early to know the right shape of the abstraction; a third instance is what confirms it's
actually a pattern worth naming. Extracting `useAuthFetch` after only one page existed would have
been guessing at an interface with no second data point to validate it against. Once the admin
pages needed the exact same "attach token, log out on 401" logic for a third and fourth time, the
duplication was clearly a pattern, and the hook's shape (a single wrapped `fetch` function) fell
out naturally from what all four call sites actually needed.

**Q: Why does `RequireAuth`'s new `role` prop redirect to `/login` in one case but render an inline message in the other, instead of handling "not allowed" the same way every time?**
A: They're different problems for the user to fix. No `user` at all means "you're not
authenticated" — redirecting to `/login` is directly actionable, logging in solves it. A `user`
that exists but has the wrong role (a STAFF account hitting `/admin`) means "you're authenticated,
but this account specifically isn't allowed here" — sending that user to `/login` would be
actively misleading, since logging in again with the same account changes nothing. This mirrors
the backend's own 401-vs-403 distinction (`requireAuth` vs `requireRole`) — the frontend
shouldn't collapse two different failure modes into one generic "access denied" if it already
knows which one actually happened.

**Q: `ServicesAdminPage` calls the public `GET /api/services` (which returns every business's services) and filters client-side to the admin's own resources. Isn't that a security hole?**
A: No, because filtering here is a display decision, not an authorization boundary. The actual
security is enforced entirely server-side: `POST/PATCH/DELETE /api/services` each independently
check that the target resource's `businessId` matches `req.user.businessId` and return
403/404 otherwise — that check happens regardless of what the frontend does or doesn't show.
If the client-side filter had a bug and displayed another business's service in the admin's
table, clicking "Edit" and saving would still get rejected by the backend. This is a useful
distinction to name explicitly: never rely on the frontend hiding something as the actual
security measure — hide it for a clean UI, but the API must reject it independently.

**Q: `AdminLayout` uses nested routes (`<Route path="/admin" element={<AdminLayout/>}><Route path="services" .../></Route>`) with an `<Outlet/>`, instead of three separate top-level routes that each render their own copy of the tab navigation. Why?**
A: The tab nav (Services/Holidays/Hours) is shared UI that shouldn't be duplicated three times
or re-fetched/re-mounted on every tab switch. `<Outlet/>` is React Router's placeholder for
"render whichever child route matched" inside a parent route's own element — `AdminLayout`
renders the nav once, and only the `<Outlet/>` content swaps out as the user clicks between
tabs, the same relationship `App.tsx` itself has with all of its top-level pages. It also means
the `RequireAuth role="ADMIN"` check only needs to wrap the parent route once, instead of being
repeated on `/admin/services`, `/admin/holidays`, and `/admin/hours` separately.

---

## Post-Phase 5 addition — Resource creation

**Q: `ResourcesAdminPage` only collects a `name` in its form, even though the backend's `POST /api/resources` also accepts `workingHoursStart`/`workingHoursEnd`/`closedWeekdays`. Why not expose all of it in one form?**
A: Because the Hours tab already owns editing that data for an existing resource, and a brand
new resource with no bookings yet doesn't need custom hours on day one — the schema's defaults
(9:00-17:00, no closed days) are a reasonable starting point for any resource. Asking for name
only keeps the "create" step to the one piece of information that's actually required and has
no sensible default, then routing the rest through an existing, already-tested screen (Hours)
instead of duplicating that form's fields and validation a second time.

---

## Post-Phase 5 addition — Frontend redesign (Material Design)

**Q: What does `theme.ts` + `<ThemeProvider>` actually buy you over just writing better inline `style={}` objects on each page?**
A: A single source of truth. Before this change, the primary color, spacing, and corner
radius were duplicated as literal values (`#ccc`, `0.4rem`, `1px solid`) across ten separate
files — changing the brand color meant a find-and-replace across the whole codebase, and
nothing guaranteed two pages used the exact same shade of gray. `createTheme()` defines the
palette, typography, and shape once; every MUI component (`Button`, `Card`, `Chip`, ...)
reads from that theme automatically via `<ThemeProvider>`'s React context, so changing
`theme.palette.primary.main` in one place changes every button, link, and highlighted tab in
the app at once. This is the general "design tokens" idea — colors and spacing as named,
centralized values instead of scattered magic numbers — MUI just gives you the plumbing for it.

**Q: How does the nav bar know when to switch from inline buttons to a hamburger menu, and why 900px specifically?**
A: `useMediaQuery(theme.breakpoints.down("md"))` — MUI's default breakpoints are
`xs=0, sm=600, md=900, lg=1200, xl=1536`, and `.down("md")` means "viewport width is below
900px." `useMediaQuery` is a React hook wrapping the browser's `window.matchMedia` API — it
returns a boolean and re-renders the component whenever that boolean's value changes (e.g. the
window gets resized across the breakpoint), which is what makes the switch live instead of only
correct on page load. 900px specifically is just MUI's own default `md` breakpoint, chosen
because it's roughly where a typical tablet-portrait/small-laptop width sits — past that point,
six nav links plus a login button reliably stop fitting on one line.

**Q: `TableContainer` is used for every list in this app (services, queue, admin tables) instead of building a separate mobile card layout. Is a horizontally-scrolling table actually "responsive"?**
A: Yes — responsive doesn't mean "reflows into a completely different layout at every
breakpoint," it means "usable at every viewport width." A `TableContainer` on a table wider
than the screen adds a horizontal scrollbar automatically instead of letting columns overflow
the page or squeeze text into unreadable wrapping. A bespoke "cards on mobile, table on
desktop" version would look nicer but doubles the markup and the logic for every list page in
the app; for a handful of columns (time, customer, service, status, actions), horizontal
scroll is a reasonable, much cheaper tradeoff — worth naming explicitly as a deliberate choice
rather than an oversight if asked in an interview.

**Q: `BookingDetailsPage` and `QueuePage` both map a booking's `status` string to a `Chip` color via a `Record<string, ChipProps["color"]>` lookup object. Why not just a `switch` statement or inline ternary chain in each component?**
A: A lookup object is data, not control flow — `STATUS_COLOR[booking.status]` is one
expression, versus a `switch` with five `case`s and `return`s repeated in every component that
needs it. It also makes the mapping itself inspectable and testable independent of any
component (you can log or unit-test `STATUS_COLOR` directly), and adding a new status later
is a one-line addition to the object instead of finding every `switch` statement in the
codebase that handles booking status and updating each one. The tradeoff is it's only better
when the mapping is genuinely static/data-like — if the color depended on more than just the
status string (e.g. also on `isLate`), a lookup object would need to become nested or you'd
fall back to a function, which is exactly what a `switch` is better suited for.

---

## Post-Phase 5 addition — Business dashboard

**Q: Why does the health-check status card move off the public `/` page instead of just staying there alongside the new "Book" / "Find booking" buttons?**
A: Audience mismatch. `/` is the first thing a customer sees — "is the API up" and "is the
database connected" are operational details meaningful to whoever runs the business, not
information a customer booking an appointment needs or would understand. Keeping it on the
public page also means anyone (not just staff) could see internal system status, which is a
minor but real information leak. Moving it under `/dashboard` (auth required) puts diagnostic-
style information behind the same audience boundary the rest of the app already draws between
customer-facing and staff-facing pages — this project doesn't currently have a dedicated
"system status" page at all, since that health data effectively became just one more thing a
logged-in dashboard could show if it mattered enough to bring back.

**Q: `DashboardPage` fetches `/api/dashboard/summary` again every time `date` changes, via a `useEffect` with `[date]` as its dependency array — same pattern as `QueuePage`'s resource/date effect. Why not fetch once and filter the results client-side when the date changes?**
A: The data itself is different per date, not just a different view of the same data — a
different `date` means an entirely different set of bookings, revenue totals, and "next up"
list from the backend, not a subset of something already in memory. Fetching once and filtering
would require pulling *all* bookings ever made for the business up front (unbounded, and
growing forever), just to slice out one day's worth client-side. Re-fetching per date keeps the
request small and the server doing the aggregation it's already positioned to do efficiently
against the database — the same reasoning `BookPage`'s slot-refetching-per-date already
established back in Phase 3.

**Q: The `KpiCard` component takes `color` as a raw hex string prop instead of a theme palette key like `"primary"` or `"success"`. Doesn't that break the "one theme, one source of truth" principle from the MUI redesign?**
A: It's a deliberate, narrow exception, not an oversight. The four KPI cards are color-coded
by *meaning that's specific to this one dashboard* (booked=teal, checked-in=amber,
completed=green, no-shows=red) rather than by MUI's generic severity levels (`primary`,
`success`, `error`, ...) — reusing `theme.palette.success.main` for "completed" happens to
line up, but `theme.palette.warning.main` for "checked-in" or a distinct teal for "booked"
don't correspond to any existing semantic palette role. Hardcoding hex values here is the same
tradeoff as `STATUS_COLOR` mapping status strings to `ChipProps["color"]` elsewhere — the
difference is that mapping reuses MUI's built-in severity colors (because booking status
already matches that vocabulary: success/warning/error), while these four values don't, so
inventing new palette roles just for one page's icon backgrounds wasn't worth doing over four
local constants.

---

## Phase 6 — (not started yet)
