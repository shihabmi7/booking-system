import fs from "fs";
import path from "path";
import multer from "multer";

// Local-disk storage for now — served statically from index.ts as /uploads/*. Deliberately
// simple: no cloud SDK, no bucket config, just a folder on the same machine the API runs on.
// This is a known, accepted limitation for local dev (see customer-accounts-plan.md) — Phase
// 6's AWS deployment plan already lists S3 for the QR codes, and profile pictures are a
// natural second thing to move there when that happens, for the same reason: a real deployment
// usually runs multiple/ephemeral API instances, and "a file on this instance's disk" doesn't
// survive a redeploy or scale past one instance the way S3 does.
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "profile-pictures");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Created on first upload rather than assumed to exist — the repo only ships an empty
    // uploads/.gitkeep, and a fresh clone/deploy shouldn't require a manual mkdir step.
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // customerId + timestamp: unique per upload, and traceable back to who uploaded it just
    // by reading the filename — useful during dev without needing a DB lookup.
    const ext = path.extname(file.originalname).toLowerCase();
    const customerId = req.customer?.customerId ?? "unknown";
    cb(null, `${customerId}-${Date.now()}${ext}`);
  },
});

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadProfilePicture = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — a profile picture, not a photo album
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, or WebP images are allowed"));
      return;
    }
    cb(null, true);
  },
}).single("picture");
