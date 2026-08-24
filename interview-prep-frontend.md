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

## Phase 4 — (not started yet)
