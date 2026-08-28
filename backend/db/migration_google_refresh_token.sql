-- Persist Google OAuth refresh tokens so rotation survives Render restarts.
ALTER TABLE studio_settings
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;

COMMENT ON COLUMN studio_settings.google_refresh_token IS
  'OAuth refresh token vigente. Si Google rota el token, se actualiza aquí; no depende solo de env vars.';
