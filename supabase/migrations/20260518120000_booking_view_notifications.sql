-- Suivi « vu » pour les badges réservations (hôte / voyageur / véhicules)

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS host_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guest_viewed_at TIMESTAMPTZ;

ALTER TABLE public.vehicle_bookings
  ADD COLUMN IF NOT EXISTS owner_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS renter_viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_host_unseen
  ON public.bookings (property_id)
  WHERE status = 'pending' AND host_viewed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_guest_unseen
  ON public.bookings (guest_id)
  WHERE guest_viewed_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_host_unseen_bookings_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.bookings b
  INNER JOIN public.properties p ON p.id = b.property_id
  WHERE p.host_id = p_user_id
    AND b.status = 'pending'
    AND b.host_viewed_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_guest_unseen_bookings_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.bookings b
  WHERE b.guest_id = p_user_id
    AND b.status IN ('confirmed', 'cancelled', 'completed')
    AND (
      b.guest_viewed_at IS NULL
      OR b.guest_viewed_at < COALESCE(b.updated_at, b.created_at)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_vehicle_owner_unseen_bookings_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.vehicle_bookings vb
  INNER JOIN public.vehicles v ON v.id = vb.vehicle_id
  WHERE v.owner_id = p_user_id
    AND vb.status = 'pending'
    AND vb.owner_viewed_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_vehicle_renter_unseen_bookings_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.vehicle_bookings vb
  WHERE vb.renter_id = p_user_id
    AND vb.status IN ('confirmed', 'cancelled', 'completed')
    AND (
      vb.renter_viewed_at IS NULL
      OR vb.renter_viewed_at < COALESCE(vb.updated_at, vb.created_at)
    );
$$;

CREATE OR REPLACE FUNCTION public.mark_host_property_bookings_viewed(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings b
  SET host_viewed_at = now()
  FROM public.properties p
  WHERE b.property_id = p.id
    AND p.host_id = p_user_id
    AND b.host_viewed_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_guest_property_bookings_viewed(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings
  SET guest_viewed_at = now()
  WHERE guest_id = p_user_id
    AND (
      guest_viewed_at IS NULL
      OR guest_viewed_at < COALESCE(updated_at, created_at)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_vehicle_owner_bookings_viewed(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicle_bookings vb
  SET owner_viewed_at = now()
  FROM public.vehicles v
  WHERE vb.vehicle_id = v.id
    AND v.owner_id = p_user_id
    AND vb.owner_viewed_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_vehicle_renter_bookings_viewed(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicle_bookings
  SET renter_viewed_at = now()
  WHERE renter_id = p_user_id
    AND (
      renter_viewed_at IS NULL
      OR renter_viewed_at < COALESCE(updated_at, created_at)
    );
END;
$$;
