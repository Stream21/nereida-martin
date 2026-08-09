-- Feedback pruebas clienta (ago 2026): nombres, duraciones, servicios retirados.
-- Idempotente. También se ejecuta vía npm run db:init.

BEGIN;

UPDATE treatments SET name = 'Perfilado', tag = 'Primera vez'
WHERE id = 'brow-design-primera';

UPDATE treatments SET name = 'Perfilado', tag = 'Mantenimiento'
WHERE id = 'brow-design-seguimiento';

UPDATE treatments
SET name = 'Lifting koreano',
    tag = 'Lifting + tinte',
    duration_min = 120,
    duration_max = NULL,
    price = 60
WHERE id = 'lash-lift-korean';

UPDATE treatments SET tag = 'Swarovski' WHERE id = 'smile-gem';

UPDATE treatments SET active = false WHERE id IN ('nanoblading', 'ritual-glow');

COMMIT;
