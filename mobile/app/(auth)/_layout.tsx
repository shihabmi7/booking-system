import { Redirect, Stack } from "expo-router";

import { useCustomerAuth } from "@/auth/CustomerAuthContext";

// Guards the whole (auth) group the other direction from app/index.tsx: someone already signed
// in has no reason to see Login/Register again (e.g. following a stale deep link), so they're
// bounced back to the signed-in home instead of being allowed to re-enter the auth stack.
export default function AuthLayout() {
  const { status } = useCustomerAuth();

  if (status === "signedIn") return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
