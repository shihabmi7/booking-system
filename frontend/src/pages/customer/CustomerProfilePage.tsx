import { FormEvent, useRef, useState } from "react";
import { useCustomerAuth } from "../../auth/CustomerAuthContext";
import { useCustomerAuthFetch } from "../../auth/useCustomerAuthFetch";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";

// /customer/account/profile — edit name/phone (PATCH /api/customer/me) and swap the profile
// picture (POST /api/customer/me/picture, multipart). Email isn't editable here — see
// backend/src/routes/customer.ts's comment on PATCH /me for why it's the fixed identifier.
export default function CustomerProfilePage() {
  const { customer, updateCustomer } = useCustomerAuth();
  const customerAuthFetch = useCustomerAuthFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(customer?.name || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);

  if (!customer) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingProfile(true);
    try {
      const res = await customerAuthFetch("/api/customer/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: phone || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Update failed: ${res.status}`);
      updateCustomer(body);
      setSuccess("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);
    setUploadingPicture(true);
    try {
      const formData = new FormData();
      formData.append("picture", file);
      // No Content-Type header here on purpose — the browser sets multipart/form-data with
      // the correct boundary itself; setting it manually would break the upload.
      const res = await customerAuthFetch("/api/customer/me/picture", {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Upload failed: ${res.status}`);
      updateCustomer(body);
      setSuccess("Profile picture updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingPicture(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={3} sx={{ maxWidth: 480 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ position: "relative" }}>
              <Avatar
                src={customer.profilePictureUrl || undefined}
                sx={{ width: 72, height: 72, fontSize: 28 }}
              >
                {customer.name.charAt(0).toUpperCase()}
              </Avatar>
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPicture}
                sx={{
                  position: "absolute",
                  bottom: -4,
                  right: -4,
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  "&:hover": { bgcolor: "background.paper" },
                }}
              >
                <PhotoCameraIcon fontSize="small" />
              </IconButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={handlePictureChange}
              />
            </Box>
            <Stack>
              <Typography variant="h6">{customer.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {customer.email}
              </Typography>
              {uploadingPicture && (
                <Typography variant="caption" color="text.secondary">
                  Uploading…
                </Typography>
              )}
            </Stack>
          </Stack>

          <Stack component="form" onSubmit={handleSubmit} spacing={2}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              fullWidth
            />
            <TextField label="Email" value={customer.email} disabled fullWidth helperText="Email can't be changed." />
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}
            <Button type="submit" variant="contained" disabled={savingProfile} sx={{ alignSelf: "flex-start" }}>
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
