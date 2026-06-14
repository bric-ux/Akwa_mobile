-- Catégorie de chambre (Standard, Suite, Deluxe, etc.)
ALTER TABLE public.hotel_room_types
  ADD COLUMN IF NOT EXISTS room_category text
  CHECK (
    room_category IS NULL
    OR room_category IN (
      'standard', 'double', 'twin', 'deluxe', 'suite',
      'family', 'studio', 'executive', 'other'
    )
  );

COMMENT ON COLUMN public.hotel_room_types.room_category IS
  'Catégorie commerciale du type de chambre (Standard, Suite, etc.)';
