-- Réductions par durée de séjour sur les types de chambre hôtel

ALTER TABLE public.hotel_room_types
  ADD COLUMN IF NOT EXISTS discount_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_min_nights integer,
  ADD COLUMN IF NOT EXISTS discount_percentage integer,
  ADD COLUMN IF NOT EXISTS long_stay_discount_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS long_stay_discount_min_nights integer,
  ADD COLUMN IF NOT EXISTS long_stay_discount_percentage integer;

ALTER TABLE public.hotel_room_types
  DROP CONSTRAINT IF EXISTS hotel_room_types_discount_percentage_check;

ALTER TABLE public.hotel_room_types
  ADD CONSTRAINT hotel_room_types_discount_percentage_check
  CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100));

ALTER TABLE public.hotel_room_types
  DROP CONSTRAINT IF EXISTS hotel_room_types_long_stay_discount_percentage_check;

ALTER TABLE public.hotel_room_types
  ADD CONSTRAINT hotel_room_types_long_stay_discount_percentage_check
  CHECK (
    long_stay_discount_percentage IS NULL
    OR (long_stay_discount_percentage >= 0 AND long_stay_discount_percentage <= 100)
  );

COMMENT ON COLUMN public.hotel_room_types.discount_enabled IS
  'Réduction standard si le séjour atteint discount_min_nights nuits';
COMMENT ON COLUMN public.hotel_room_types.long_stay_discount_enabled IS
  'Réduction long séjour (seuil plus élevé)';
