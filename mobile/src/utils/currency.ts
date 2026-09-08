// Raw `$${price}` string, deliberately not real currency formatting — matches the web app's own
// unresolved state here (ServicesPage, BookPage, BookingDetailsPage all do the same thing). The
// plan flags this needs a real decision (mobile-app-plan.md's Localization section) once the
// business's actual currency is known; this one function is the single place to fix it.
export function formatPrice(price: string): string {
  return `$${price}`;
}
