-- Add is_admin flag to profiles (owner-only access to /admin dashboard)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Set the current owner as admin
UPDATE profiles SET is_admin = true WHERE id = '45435140-9a0a-49aa-a95e-5ace7657f61a';
