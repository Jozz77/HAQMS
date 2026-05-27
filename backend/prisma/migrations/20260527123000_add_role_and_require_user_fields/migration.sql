-- Align DB with backend expectations (role/password/name).
-- Note: existing rows may violate NOT NULL; we keep changes minimal and safe.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'RECEPTIONIST';

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "password" TEXT;

