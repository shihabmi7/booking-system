import { changePassword, updateProfile, uploadProfilePicture } from "@/api/customerProfile";

describe("updateProfile", () => {
  it("PATCHes name and phone through the given authedFetch", async () => {
    const customer = { id: "1", name: "Ada" };
    const authedFetch = jest.fn().mockResolvedValue(customer);

    const result = await updateProfile(authedFetch, { name: "Ada", phone: "555-0100" });

    expect(result).toBe(customer);
    expect(authedFetch).toHaveBeenCalledWith(
      "/api/customer/me",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Ada", phone: "555-0100" }) }),
    );
  });
});

describe("uploadProfilePicture", () => {
  it("posts a FormData body with the picture field", async () => {
    const customer = { id: "1", profilePictureUrl: "/uploads/profile-pictures/x.png" };
    const authedFetch = jest.fn().mockResolvedValue(customer);

    const result = await uploadProfilePicture(authedFetch, {
      uri: "file:///tmp/photo.jpg",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
    });

    expect(result).toBe(customer);
    const [path, init] = authedFetch.mock.calls[0];
    expect(path).toBe("/api/customer/me/picture");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
  });
});

describe("changePassword", () => {
  it("posts current and new password through the given authedFetch", async () => {
    const authedFetch = jest.fn().mockResolvedValue({ message: "Password changed." });

    await expect(
      changePassword(authedFetch, { currentPassword: "old12345", newPassword: "new12345" }),
    ).resolves.toEqual({ message: "Password changed." });

    expect(authedFetch).toHaveBeenCalledWith(
      "/api/customer/change-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ currentPassword: "old12345", newPassword: "new12345" }),
      }),
    );
  });
});
