import "@testing-library/jest-dom/vitest";

// Fixes every test's Date/Intl formatting to UTC, so assertions on rendered times (e.g.
// RescheduleDialog's slot chips) don't depend on which timezone happens to run the suite —
// without this, the same test passes on a dev machine and fails in CI (or vice versa) purely
// because they're in different zones. Has to be set here, in a setupFile, rather than in a
// beforeEach in an individual test — Node reads TZ once per Intl/Date call, but setting it
// after other setup code has already touched the Intl/Date machinery can be inconsistently
// honored, so earliest-possible (before any test file's own imports run) is the safe spot.
process.env.TZ = "UTC";

// Node 24+ ships an experimental native `localStorage` global (see package.json's test
// scripts — NODE_OPTIONS=--no-experimental-webstorage disables it at the process level). This
// is just a second line of defense: if that flag is ever dropped from a script, fail loudly
// here instead of every test's `localStorage.clear()` throwing a confusing "reading 'clear'
// of undefined" deep inside jsdom setup.
if (typeof localStorage === "undefined" || typeof localStorage.clear !== "function") {
  throw new Error(
    "localStorage isn't available in this test environment. Run tests with " +
      "NODE_OPTIONS=--no-experimental-webstorage (see package.json's test script) — Node's " +
      "own experimental Web Storage global otherwise shadows jsdom's implementation."
  );
}
