import { AuthTokenPayload } from "../services/auth";

// Augments Express's Request type so `req.user` is recognized by TypeScript everywhere,
// instead of every route handler needing its own cast like `(req as any).user`.
// requireAuth (src/middleware/auth.ts) is what actually sets this at runtime.
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export {};
