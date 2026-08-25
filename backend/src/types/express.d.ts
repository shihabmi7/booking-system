import { AuthTokenPayload } from "../services/auth";
import { CustomerTokenPayload } from "../services/customerAuth";

// Augments Express's Request type so `req.user`/`req.customer` are recognized by TypeScript
// everywhere, instead of every route handler needing its own cast. Two separate optional
// fields, not one shared field — requireAuth (staff) sets req.user, requireCustomerAuth sets
// req.customer, and a route only has one or the other set depending on which middleware ran.
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      customer?: CustomerTokenPayload;
    }
  }
}

export {};
