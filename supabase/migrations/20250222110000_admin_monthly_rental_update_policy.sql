-- Admin : droit de mettre à jour les annonces (approuver / refuser)
DROP POLICY IF EXISTS "mrl_admin_update" ON monthly_rental_listings;
CREATE POLICY "mrl_admin_update" ON monthly_rental_listings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
