INSERT INTO treatments (id, category, name, tag, duration_min, duration_max) VALUES
  ('brow-design-seguimiento', 'cejas', 'Brow Design', 'Perfilado seguimiento', 30, NULL),
  ('brow-design-primera', 'cejas', 'Brow Design', 'Perfilado primera vez', 60, NULL),
  ('brow-define', 'cejas', 'Brow Define', 'Diseño + tinte + perfilado', 45, NULL),
  ('brow-lami', 'cejas', 'Brow Lami', 'Laminado + perfilado', 60, NULL),
  ('brow-lami-define', 'cejas', 'Brow Lami Define', 'Laminado + tinte + perfilado', 70, NULL),
  ('brow-henna', 'cejas', 'Brow Henna', 'Henna + perfilado', 60, NULL),
  ('brow-restored', 'cejas', 'Brow Restored', 'Dermapen en cejas', 50, NULL),
  ('micropigmentacion-soft-pixel', 'cejas', 'Soft Pixel Brow', 'Micropigmentación efecto sombreado', 120, 150),
  ('nanoblading', 'cejas', 'Nanoblading', 'Efecto pelo a pelo', 120, 150),
  ('lash-lift-korean', 'pestanas', 'Lash Lift Korean', 'Lifting coreano + tinte', 120, NULL),
  ('skin-reset', 'rostro', 'Skin Reset', 'Limpieza facial cosmética coreana', 60, 70),
  ('ritual-glow', 'rostro', 'Ritual Glow', 'Tratamiento facial avanzado', 70, 75),
  ('skin-boost', 'rostro', 'Skin Boost', 'Dermapen facial', 50, NULL),
  ('labio-superior', 'depilacion', 'Labio superior', 'Depilación con hilo', 10, NULL),
  ('depilacion-facial', 'depilacion', 'Depilación facial', 'Depilación completa', 30, NULL),
  ('smile-gem', 'smile', 'Smile Gem', 'Swarovski', 30, NULL)
ON CONFLICT (id) DO NOTHING;
