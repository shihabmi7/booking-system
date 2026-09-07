import i18n, { initI18n } from "@/i18n";
import {
  buildLoginSchema,
  buildRegisterSchema,
  buildResetPasswordSchema,
  buildVerifyOtpSchema,
} from "@/auth/validation";

// Real i18next (not a stubbed `t`) for the same reason renderWithProviders uses it: a stub would
// let a typo'd or missing translation key pass here and only show up as raw English fallback on
// a device — see __tests__/utils/render.tsx.
beforeAll(() => initI18n());

describe("buildRegisterSchema", () => {
  const schema = () => buildRegisterSchema(i18n.t);
  const valid = { name: "Ada", email: "ada@example.com", phone: "", password: "password1", confirmPassword: "password1" };

  it("accepts a valid registration", () => {
    expect(schema().safeParse(valid).success).toBe(true);
  });

  it("rejects a password under 8 characters", () => {
    const result = schema().safeParse({ ...valid, password: "short1", confirmPassword: "short1" });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords, attributed to confirmPassword", () => {
    const result = schema().safeParse({ ...valid, confirmPassword: "different1" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["confirmPassword"]);
  });

  it("rejects an empty name", () => {
    expect(schema().safeParse({ ...valid, name: "  " }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(schema().safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("treats phone as optional", () => {
    const { phone: _phone, ...withoutPhone } = valid;
    expect(schema().safeParse(withoutPhone).success).toBe(true);
  });
});

describe("buildLoginSchema", () => {
  const schema = () => buildLoginSchema(i18n.t);

  it("accepts a valid login", () => {
    expect(schema().safeParse({ email: "ada@example.com", password: "anything" }).success).toBe(true);
  });

  it("rejects an empty password without imposing the 8-character rule", () => {
    // Login checks credentials exist, not password strength — an existing account may predate
    // an 8-character minimum, and login isn't the place to reject it retroactively.
    const short = schema().safeParse({ email: "ada@example.com", password: "a" });
    const empty = schema().safeParse({ email: "ada@example.com", password: "" });
    expect(short.success).toBe(true);
    expect(empty.success).toBe(false);
  });
});

describe("buildVerifyOtpSchema", () => {
  const schema = () => buildVerifyOtpSchema(i18n.t);

  it("requires exactly 6 characters for the code", () => {
    expect(schema().safeParse({ email: "ada@example.com", code: "123456" }).success).toBe(true);
    expect(schema().safeParse({ email: "ada@example.com", code: "12345" }).success).toBe(false);
    expect(schema().safeParse({ email: "ada@example.com", code: "1234567" }).success).toBe(false);
  });
});

describe("buildResetPasswordSchema", () => {
  const schema = () => buildResetPasswordSchema(i18n.t);
  const valid = { email: "ada@example.com", code: "123456", newPassword: "password1", confirmPassword: "password1" };

  it("accepts a valid reset", () => {
    expect(schema().safeParse(valid).success).toBe(true);
  });

  it("rejects mismatched new passwords", () => {
    expect(schema().safeParse({ ...valid, confirmPassword: "other1234" }).success).toBe(false);
  });
});
