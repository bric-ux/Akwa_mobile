-- Feature flags plateforme (visibilité produits : longue durée, hôtel, …)
CREATE TABLE IF NOT EXISTS public.platform_feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  label text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_feature_flags_public_read ON public.platform_feature_flags;
CREATE POLICY platform_feature_flags_public_read
  ON public.platform_feature_flags
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS platform_feature_flags_admin_write ON public.platform_feature_flags;
CREATE POLICY platform_feature_flags_admin_write
  ON public.platform_feature_flags
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.platform_feature_flags (key, enabled, label, description)
VALUES
  (
    'monthly_rental',
    true,
    'Location longue durée',
    'Afficher le parcours location mensuelle (accueil, publication, modes propriétaire).'
  ),
  (
    'hotel',
    true,
    'Hôtels',
    'Afficher le parcours hôtel (accueil, publication, espace établissement).'
  )
ON CONFLICT (key) DO NOTHING;
