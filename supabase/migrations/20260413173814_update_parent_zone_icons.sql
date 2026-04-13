-- Update parent zone icons to be more distinctive and descriptive
-- Previous icons were too generic (sparkles, shield, plus-circle, etc.)

BEGIN;

-- Hogar: home → house
UPDATE public.categories SET icon = 'house'
WHERE id = 'b0000001-0001-4000-8000-000000000001';

-- Transporte: car → car-front
UPDATE public.categories SET icon = 'car-front'
WHERE id = 'b0000001-0001-4000-8000-000000000003';

-- Estilo de vida: sparkles → shopping-bag
UPDATE public.categories SET icon = 'shopping-bag'
WHERE id = 'b0000001-0001-4000-8000-000000000005';

-- Obligaciones: shield → scroll-text
UPDATE public.categories SET icon = 'scroll-text'
WHERE id = 'b0000001-0001-4000-8000-000000000006';

-- Ingresos: briefcase → wallet
UPDATE public.categories SET icon = 'wallet'
WHERE id = 'b0000001-0001-4000-8000-000000000007';

-- Otros ingresos: plus-circle → coins
UPDATE public.categories SET icon = 'coins'
WHERE id = 'b0000001-0001-4000-8000-000000000008';

-- Entretenimiento: gamepad-2 → clapperboard
UPDATE public.categories SET icon = 'clapperboard'
WHERE id = 'a0000001-0000-0000-0000-000000000006';

COMMIT;
