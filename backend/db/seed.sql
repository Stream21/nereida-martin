INSERT INTO treatments (id, category, name, tag, duration_min, duration_max, price, active) VALUES
  ('imported', 'general', 'Cita importada', 'Importada desde Google Calendar', 60, 120, NULL, false),
  ('brow-design-primera', 'cejas', 'Brow Design', 'Primera vez', 45, NULL, 18, true),
  ('brow-design-seguimiento', 'cejas', 'Brow Design', 'Mantenimiento', 45, NULL, 15, true),
  ('brow-define', 'cejas', 'Brow Define', 'Diseño + tinte + perfilado', 60, NULL, 25, true),
  ('brow-lami', 'cejas', 'Brow Lami', 'Laminado + perfilado', 60, NULL, 35, true),
  ('brow-lami-define', 'cejas', 'Brow Lami Define', 'Laminado + perfilado + tinte', 75, NULL, 45, true),
  ('brow-henna', 'cejas', 'Brow Henna', 'Henna + perfilado', 60, NULL, 35, true),
  ('brow-restored', 'cejas', 'Brow Restored', 'Dermapen en cejas', 45, NULL, 30, true),
  ('micropigmentacion-soft-pixel', 'cejas', 'Soft Pixel Brow', 'Micropigmentación efecto polvo', 150, NULL, 280, true),
  ('nanoblading', 'cejas', 'Nanoblading', 'Efecto pelo a pelo', 120, 150, NULL, true),
  ('lash-lift-korean', 'pestanas', 'Korean Lash Lift', 'Lifting coreano + tinte', 60, NULL, 60, true),
  ('skin-reset', 'rostro', 'Skin Reset', 'Limpieza facial coreana', 75, NULL, 60, true),
  ('ritual-glow', 'rostro', 'Ritual Glow', 'Tratamiento facial avanzado', 70, 75, NULL, true),
  ('skin-boost', 'rostro', 'Skin Boost', 'Dermapen facial', 45, NULL, 40, true),
  ('labio-superior', 'depilacion', 'Depilación labio superior', 'Depilación con hilo', 10, NULL, 5, true),
  ('depilacion-facial', 'depilacion', 'Depilación facial completa', 'Depilación completa', 30, NULL, 10, true),
  ('smile-gem', 'smile', 'Gema dental', 'Swarovski (desde)', 30, NULL, 25, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clients (name, email)
VALUES ('Importado Google', 'imported@studio.local')
ON CONFLICT (email) DO NOTHING;

INSERT INTO studio_settings (id, booking_start_date)
VALUES (1, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;
