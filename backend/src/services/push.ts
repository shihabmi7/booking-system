import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";

// The push transport layer — the ONLY file in the codebase that knows Firebase exists.
// Everything else (services/notifications.ts, the reminder cron, the routes) talks to
// sendPush() and gets back a plain per-token result array.
//
// Why one provider for both platforms: Firebase Cloud Messaging relays to Apple's APNs
// server-side, using the .p8 auth key uploaded in the Firebase console (Project Settings →
// Cloud Messaging → APNs Authentication Key). So the iOS app registers with Firebase's
// getToken() exactly like Android does, and the backend has a single token type, a single
// SDK, and a single credential to rotate. Going direct to APNs with node-apn would mean
// maintaining two senders and two token formats for no gain at this scale.

export type PushPayload = {
  title: string;
  body: string;
  // Forwarded as FCM's `data` block. FCM requires every value to be a string — anything
  // structured has to be JSON.stringify'd by the caller (see services/notifications.ts).
  data?: Record<string, string>;
};

// One result per token, in the same order as the tokens passed in.
export type PushResult =
  | { ok: true; token: string; messageId: string }
  | { ok: false; token: string; error: string; tokenInvalid: boolean };

let initialized = false;
let firebaseReady = false;

// Lazy init rather than at import time, so the app still boots (and every non-push route
// still works) when Firebase env vars are missing — which is the normal state on a fresh
// clone or in CI. Without credentials this module degrades to the console driver below.
function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Stored in .env as a single line with literal "\n" sequences, because a real newline
  // can't live in a dotenv value. Converting them back is the classic gotcha here — without
  // this replace, the SDK throws an opaque "Invalid PEM formatted message".
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "[push] Firebase credentials not set — running in console mode. " +
        "Notifications will still be stored and returned by the API, but no push is sent.",
    );
    return;
  }

  try {
    // Guard against double-init: ts-node-dev restarts re-run this module in the same
    // process often enough that getApps().length is worth checking.
    if (getApps().length === 0) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }
    firebaseReady = true;
    console.log(`[push] Firebase Admin initialized for project ${projectId}`);
  } catch (err) {
    console.error("[push] Failed to initialize Firebase Admin — falling back to console mode:", err);
  }
}

// FCM error codes meaning "this token is dead, stop using it" — as opposed to a transient
// failure (quota, network, FCM outage) where the token is still good and a retry may work.
// Only the first set should disable a DeviceToken row; see services/notifications.ts.
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export function isPushConfigured(): boolean {
  ensureInitialized();
  return firebaseReady;
}

// Sends one payload to many device tokens. Never throws — a push failure must not roll back
// or 500 the business action that triggered it (a check-in still succeeded even if the phone
// never buzzed), so every error is captured into a per-token result instead.
export async function sendPush(tokens: string[], payload: PushPayload): Promise<PushResult[]> {
  ensureInitialized();
  if (tokens.length === 0) return [];

  if (!firebaseReady) {
    // Console driver — the dev/local path. Mirrors services/otp.ts's console.log approach so
    // the whole flow is testable end to end without a Firebase project.
    console.log(`[push:console] → ${tokens.length} device(s): ${payload.title} — ${payload.body}`, payload.data ?? {});
    return tokens.map((token) => ({ ok: true as const, token, messageId: `console-${Date.now()}` }));
  }

  const message: MulticastMessage = {
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
    android: {
      // "high" wakes the device immediately; the default ("normal") lets Android batch the
      // delivery, which is wrong for a "your appointment is in 1 hour" reminder.
      priority: "high",
      notification: { sound: "default", channelId: "booking-updates" },
    },
    apns: {
      // Apple's equivalent of high priority. `sound` is also what makes iOS show a banner
      // rather than delivering silently.
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default", badge: 1 } },
    },
  };

  try {
    // sendEachForMulticast resolves per-token instead of failing the whole batch on one bad
    // token — that per-token detail is exactly what lets us disable dead tokens below.
    const response = await getMessaging().sendEachForMulticast(message);
    return response.responses.map((r, i) => {
      const token = tokens[i];
      if (r.success) return { ok: true as const, token, messageId: r.messageId ?? "" };
      const code = r.error?.code ?? "unknown";
      return {
        ok: false as const,
        token,
        error: `${code}: ${r.error?.message ?? "unknown error"}`,
        tokenInvalid: DEAD_TOKEN_CODES.has(code),
      };
    });
  } catch (err) {
    // A whole-batch failure (credentials revoked, FCM unreachable). Not the tokens' fault, so
    // tokenInvalid is false everywhere — nothing gets disabled over an outage.
    const error = err instanceof Error ? err.message : String(err);
    console.error("[push] Multicast send failed:", error);
    return tokens.map((token) => ({ ok: false as const, token, error, tokenInvalid: false }));
  }
}
