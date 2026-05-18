-- Permettre aux voyageurs / locataires d'enregistrer les détails de calcul à la création
-- (avant : SELECT + service_role uniquement → erreur 42501 côté mobile/web client)

DROP POLICY IF EXISTS "Booking participants can view calculation details" ON public.booking_calculation_details;

CREATE POLICY "Booking participants can view calculation details"
ON public.booking_calculation_details
FOR SELECT
TO authenticated
USING (
  (
    booking_type = 'property'
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.properties p ON p.id = b.property_id
      WHERE b.id = booking_calculation_details.booking_id
        AND (b.guest_id = auth.uid() OR p.host_id = auth.uid())
    )
  )
  OR (
    booking_type = 'vehicle'
    AND EXISTS (
      SELECT 1
      FROM public.vehicle_bookings vb
      JOIN public.vehicles v ON v.id = vb.vehicle_id
      WHERE vb.id = booking_calculation_details.booking_id
        AND (vb.renter_id = auth.uid() OR v.owner_id = auth.uid())
    )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Guests can insert property booking calculation details"
ON public.booking_calculation_details
FOR INSERT
TO authenticated
WITH CHECK (
  booking_type = 'property'
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_calculation_details.booking_id
      AND b.guest_id = auth.uid()
  )
);

CREATE POLICY "Renters can insert vehicle booking calculation details"
ON public.booking_calculation_details
FOR INSERT
TO authenticated
WITH CHECK (
  booking_type = 'vehicle'
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_bookings vb
    WHERE vb.id = booking_calculation_details.booking_id
      AND vb.renter_id = auth.uid()
  )
);

CREATE POLICY "Participants can update booking calculation details"
ON public.booking_calculation_details
FOR UPDATE
TO authenticated
USING (
  (
    booking_type = 'property'
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.properties p ON p.id = b.property_id
      WHERE b.id = booking_calculation_details.booking_id
        AND (b.guest_id = auth.uid() OR p.host_id = auth.uid())
    )
  )
  OR (
    booking_type = 'vehicle'
    AND EXISTS (
      SELECT 1
      FROM public.vehicle_bookings vb
      JOIN public.vehicles v ON v.id = vb.vehicle_id
      WHERE vb.id = booking_calculation_details.booking_id
        AND (vb.renter_id = auth.uid() OR v.owner_id = auth.uid())
    )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  (
    booking_type = 'property'
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.properties p ON p.id = b.property_id
      WHERE b.id = booking_calculation_details.booking_id
        AND (b.guest_id = auth.uid() OR p.host_id = auth.uid())
    )
  )
  OR (
    booking_type = 'vehicle'
    AND EXISTS (
      SELECT 1
      FROM public.vehicle_bookings vb
      JOIN public.vehicles v ON v.id = vb.vehicle_id
      WHERE vb.id = booking_calculation_details.booking_id
        AND (vb.renter_id = auth.uid() OR v.owner_id = auth.uid())
    )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
