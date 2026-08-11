-- Micropigmentación: deja de reservarse online; Nereida la agenda manualmente.
UPDATE treatments
SET active = false
WHERE id = 'micropigmentacion-soft-pixel';
