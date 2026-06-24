INSERT INTO treatments (id, category, name, tag, duration_min, duration_max, active) VALUES
  ('imported', 'general', 'Cita importada', 'Importada desde Google Calendar', 60, 120, false),
  ('brow-design-seguimiento', 'cejas', 'Brow Design', 'Perfilado seguimiento', 30, NULL, true),
  ('brow-design-primera', 'cejas', 'Brow Design', 'Perfilado primera vez', 60, NULL, true),
  ('brow-define', 'cejas', 'Brow Define', 'Diseño + tinte + perfilado', 45, NULL, true),
  ('brow-lami', 'cejas', 'Brow Lami', 'Laminado + perfilado', 60, NULL, true),
  ('brow-lami-define', 'cejas', 'Brow Lami Define', 'Laminado + tinte + perfilado', 70, NULL, true),
  ('brow-henna', 'cejas', 'Brow Henna', 'Henna + perfilado', 60, NULL, true),
  ('brow-restored', 'cejas', 'Brow Restored', 'Dermapen en cejas', 50, NULL, true),
  ('micropigmentacion-soft-pixel', 'cejas', 'Soft Pixel Brow', 'Micropigmentación efecto sombreado', 120, 150, true),
  ('nanoblading', 'cejas', 'Nanoblading', 'Efecto pelo a pelo', 120, 150, true),
  ('lash-lift-korean', 'pestanas', 'Lash Lift Korean', 'Lifting coreano + tinte', 120, NULL, true),
  ('skin-reset', 'rostro', 'Skin Reset', 'Limpieza facial cosmética coreana', 60, 70, true),
  ('ritual-glow', 'rostro', 'Ritual Glow', 'Tratamiento facial avanzado', 70, 75, true),
  ('skin-boost', 'rostro', 'Skin Boost', 'Dermapen facial', 50, NULL, true),
  ('labio-superior', 'depilacion', 'Labio superior', 'Depilación con hilo', 10, NULL, true),
  ('depilacion-facial', 'depilacion', 'Depilación facial', 'Depilación completa', 30, NULL, true),
  ('smile-gem', 'smile', 'Smile Gem', 'Swarovski', 30, NULL, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clients (name, email)
VALUES ('Importado Google', 'imported@studio.local')
ON CONFLICT (email) DO NOTHING;

INSERT INTO studio_settings (id, booking_start_date)
VALUES (1, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;
