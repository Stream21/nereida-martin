-- Actualización de servicios (julio 2026): nuevas duraciones, precios y nombres.
-- Ejecutar sobre bases de datos existentes (el seed solo aplica en instalaciones nuevas):
--   psql $DATABASE_URL -f backend/db/migration_treatments_prices.sql

BEGIN;

UPDATE treatments SET name = 'Perfilado', tag = 'Mantenimiento', duration_min = 45, duration_max = NULL, price = 15 WHERE id = 'brow-design-seguimiento';
UPDATE treatments SET name = 'Perfilado', tag = 'Primera vez', duration_min = 45, duration_max = NULL, price = 18 WHERE id = 'brow-design-primera';
UPDATE treatments SET tag = 'Diseño + tinte + perfilado',   duration_min = 60,  duration_max = NULL, price = 25  WHERE id = 'brow-define';
UPDATE treatments SET tag = 'Laminado + perfilado',         duration_min = 60,  duration_max = NULL, price = 35  WHERE id = 'brow-lami';
UPDATE treatments SET tag = 'Laminado + perfilado + tinte', duration_min = 75,  duration_max = NULL, price = 45  WHERE id = 'brow-lami-define';
UPDATE treatments SET tag = 'Henna + perfilado',            duration_min = 60,  duration_max = NULL, price = 35  WHERE id = 'brow-henna';
UPDATE treatments SET tag = 'Dermapen en cejas',            duration_min = 45,  duration_max = NULL, price = 30  WHERE id = 'brow-restored';
UPDATE treatments SET tag = 'Micropigmentación efecto polvo', duration_min = 150, duration_max = NULL, price = 280 WHERE id = 'micropigmentacion-soft-pixel';

UPDATE treatments SET name = 'Lifting koreano', tag = 'Lifting + tinte', duration_min = 120, duration_max = NULL, price = 60 WHERE id = 'lash-lift-korean';

UPDATE treatments SET tag = 'Limpieza facial coreana', duration_min = 75, duration_max = NULL, price = 60 WHERE id = 'skin-reset';
UPDATE treatments SET tag = 'Dermapen facial',         duration_min = 45, duration_max = NULL, price = 40 WHERE id = 'skin-boost';

-- Depilación: duración pendiente de confirmar, solo se actualiza el precio.
UPDATE treatments SET name = 'Depilación labio superior',   price = 5  WHERE id = 'labio-superior';
UPDATE treatments SET name = 'Depilación facial completa',  price = 10 WHERE id = 'depilacion-facial';

UPDATE treatments SET name = 'Gema dental', tag = 'Swarovski', price = 25 WHERE id = 'smile-gem';

COMMIT;
