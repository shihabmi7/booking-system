import QRCode from "qrcode";

// Encodes the raw bookingRef (not a full URL) into a QR code, returned as a base64 PNG
// data URL — drops straight into an <img src=...> on the frontend with no file storage
// needed. Generated on demand from the bookingRef rather than stored in the database,
// since it's fully derived data: the QR image never needs to change independently of the
// bookingRef it encodes, so persisting it would just be a cache that could go stale.
export async function generateBookingQrCode(bookingRef: string): Promise<string> {
  return QRCode.toDataURL(bookingRef);
}
