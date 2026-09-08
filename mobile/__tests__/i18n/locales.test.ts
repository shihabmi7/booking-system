import bn from "@/i18n/locales/bn.json";
import en from "@/i18n/locales/en.json";
import ms from "@/i18n/locales/ms.json";

function flatKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flatKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

/**
 * The check that stops the locale files drifting apart.
 *
 * i18next silently falls back to English for a missing key, so a translation forgotten in bn.json
 * is invisible in code review and invisible at runtime to anyone testing in English — it surfaces
 * only as a stray English word inside a Bangla screen, on someone else's phone. Comparing key sets
 * catches it the moment the file is saved instead.
 */
describe("locale files", () => {
  const english = flatKeys(en).sort();

  it.each([
    ["bn", bn],
    ["ms", ms],
  ])("%s has exactly the same keys as en", (_name, locale) => {
    expect(flatKeys(locale).sort()).toEqual(english);
  });

  it.each([
    ["en", en],
    ["bn", bn],
    ["ms", ms],
  ])("%s has no empty strings left as placeholders", (_name, locale) => {
    expect(JSON.stringify(locale)).not.toMatch(/:\s*""/);
  });

  // The three language names are shown in the switcher in their own script, so they are the one
  // group of keys that must NOT be translated — a Bangla speaker looks for "বাংলা", not "Bangla".
  it("keeps language names identical across all three files", () => {
    expect(bn.language.bn).toBe(en.language.bn);
    expect(ms.language.ms).toBe(en.language.ms);
    expect(bn.language.en).toBe(en.language.en);
  });
});
