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

## Phase 3 — (not started yet)
