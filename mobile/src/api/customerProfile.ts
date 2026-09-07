import type { CustomerUser } from "./customerAuth";

type AuthedFetch = <T>(path: string, init?: RequestInit) => Promise<T>;

export type UpdateProfileInput = { name: string; phone: string | null };

// PATCH /api/customer/me — name and phone only; email isn't editable (see backend/src/routes/
// customer.ts's comment on why: it's the fixed identifier the account is looked up by
// everywhere).
export function updateProfile(authedFetch: AuthedFetch, input: UpdateProfileInput): Promise<CustomerUser> {
  return authedFetch<CustomerUser>("/api/customer/me", { method: "PATCH", body: JSON.stringify(input) });
}

// POST /api/customer/me/picture — multipart, field name "picture". `uri`/`fileName`/`mimeType`
// come straight from expo-image-picker's result; React Native's fetch/FormData understands a
// `{ uri, name, type }` object as a file part the same way a browser understands a File/Blob,
// which is why there's no separate "read the file into memory" step here.
export function uploadProfilePicture(
  authedFetch: AuthedFetch,
  image: { uri: string; fileName: string; mimeType: string },
): Promise<CustomerUser> {
  const formData = new FormData();
  // RN's FormData typing wants this shape even though DOM's FormData doesn't accept it directly.
  formData.append("picture", { uri: image.uri, name: image.fileName, type: image.mimeType } as unknown as Blob);
  return authedFetch<CustomerUser>("/api/customer/me/picture", { method: "POST", body: formData });
}

export type ChangePasswordInput = { currentPassword: string; newPassword: string };

// POST /api/customer/change-password — requires re-proving the current password, not just a
// valid token (see backend's comment on that route for why).
export function changePassword(authedFetch: AuthedFetch, input: ChangePasswordInput): Promise<{ message: string }> {
  return authedFetch<{ message: string }>("/api/customer/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
