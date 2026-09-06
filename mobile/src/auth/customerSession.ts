import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import type { CustomerUser } from "@/api/customerAuth";

// The JWT goes in SecureStore (Keychain on iOS, Keystore-backed EncryptedSharedPreferences on
// Android) per the mobile plan — it's a bearer credential, the mobile equivalent of the
// localStorage tradeoff already accepted on web, except mobile has a secure-by-default option.
// The customer profile is not a credential, so it goes in plain AsyncStorage, same as the web
// app keeps both in the same (unencrypted) localStorage — no need to pay SecureStore's ~2KB
// per-value limit for a profile that includes a profilePictureUrl.
const TOKEN_KEY = "bookingSystem.customerToken";
const CUSTOMER_KEY = "bookingSystem.customer";

export async function loadStoredSession(): Promise<{ token: string | null; customer: CustomerUser | null }> {
  const [token, rawCustomer] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    AsyncStorage.getItem(CUSTOMER_KEY),
  ]);
  if (!token || !rawCustomer) return { token: null, customer: null };
  try {
    return { token, customer: JSON.parse(rawCustomer) as CustomerUser };
  } catch {
    return { token: null, customer: null };
  }
}

export async function saveSession(token: string, customer: CustomerUser): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, token),
    AsyncStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer)),
  ]);
}

export async function saveCustomer(customer: CustomerUser): Promise<void> {
  await AsyncStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
}

export async function clearSession(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), AsyncStorage.removeItem(CUSTOMER_KEY)]);
}
