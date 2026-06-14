-- Synchronisation iCal par type de chambre hôtel (même modèle que ical_sync_links / blocked_dates)

CREATE TABLE IF NOT EXISTS public.hotel_room_type_ical_sync_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id uuid NOT NULL REFERENCES public.hotel_room_types(id) ON DELETE CASCADE,
  platform text NOT NULL,
  import_url text,
  export_url text,
  last_synced_at timestamptz,
  sync_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hotel_room_type_ical_unique UNIQUE (room_type_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_hotel_room_type_ical_room_type
  ON public.hotel_room_type_ical_sync_links(room_type_id);

ALTER TABLE public.hotel_room_type_ical_sync_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_ical_host_manage ON public.hotel_room_type_ical_sync_links;
CREATE POLICY hotel_ical_host_manage ON public.hotel_room_type_ical_sync_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.hotel_room_types rt
      INNER JOIN public.hotel_establishments e ON e.id = rt.establishment_id
      WHERE rt.id = hotel_room_type_ical_sync_links.room_type_id
        AND e.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.hotel_room_types rt
      INNER JOIN public.hotel_establishments e ON e.id = rt.establishment_id
      WHERE rt.id = hotel_room_type_ical_sync_links.room_type_id
        AND e.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS hotel_ical_admin_all ON public.hotel_room_type_ical_sync_links;
CREATE POLICY hotel_ical_admin_all ON public.hotel_room_type_ical_sync_links
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
