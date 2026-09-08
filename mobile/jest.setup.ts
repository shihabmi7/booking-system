// React 19 refuses to apply a state update from outside act() unless the environment explicitly
// declares itself a test environment via this flag. jest-expo's preset doesn't set it, so without
// this every async setState in a component test logs "not configured to support act(...)" and the
// re-render never lands — which looks exactly like a component that doesn't update.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// AsyncStorage is a native module with no JS implementation under Jest. The package ships its own
// in-memory mock for exactly this; using it (rather than a hand-rolled jest.fn()) means the stored
// language really is written and read back, so persistence is genuinely exercised.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// A neutral default device locale for every suite. The tests that care about locale detection
// override this with their own jest.mock, which takes precedence over this one.
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en", languageTag: "en-US" }],
}));

// expo-secure-store is a native Keychain/Keystore wrapper with no JS implementation under Jest,
// and unlike AsyncStorage it ships no official mock — an in-memory Map is the simplest stand-in
// that still genuinely round-trips a stored value, same reasoning as the AsyncStorage mock above.
// `__clear` is not part of the real module — it exists purely so a test's beforeEach can reset
// the store between cases without reaching into module internals, the same role
// AsyncStorage's own mock serves with its built-in `.clear()`.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __clear: () => store.clear(),
  };
});
