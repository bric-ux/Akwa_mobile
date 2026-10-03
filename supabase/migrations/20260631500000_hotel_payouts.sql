-- Versements admin aux hôteliers (carte / Wave uniquement — pas d'espèces)
-- Aligné sur vehicle_payouts ; commission hôte 2 % sans TVA

CREATE TABLE IF NOT EXISTS public.hotel_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.hotel_bookings(id) ON DELETE CASCADE,
  payment_id UUID,
  host_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  total_amount INTEGER NOT NULL,
  commission_rate NUMERIC NOT NULL DEFAULT 0.02,
  commission_amount INTEGER NOT NULL,
  host_amount INTEGER NOT NULL,

  payout_method TEXT NOT NULL DEFAULT 'bank_transfer',
  payout_details JSONB,

  status TEXT NOT NULL DEFAULT 'scheduled',

  admin_payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (admin_payment_status IN ('pending', 'paid')),
  admin_paid_at TIMESTAMPTZ,
  admin_paid_by UUID REFERENCES auth.users(id),
  admin_payment_method TEXT,
  admin_payment_reference TEXT,

  scheduled_for TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT hotel_payouts_booking_id_key UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS idx_hotel_payouts_host_id ON public.hotel_payouts(host_id);
CREATE INDEX IF NOT EXISTS idx_hotel_payouts_status ON public.hotel_payouts(status);
CREATE INDEX IF NOT EXISTS idx_hotel_payouts_admin_payment_status ON public.hotel_payouts(admin_payment_status);
CREATE INDEX IF NOT EXISTS idx_hotel_payouts_scheduled_for ON public.hotel_payouts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_hotel_payouts_booking_id ON public.hotel_payouts(booking_id);

ALTER TABLE public.hotel_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can view their own hotel payouts" ON public.hotel_payouts;
CREATE POLICY "Hosts can view their own hotel payouts"
ON public.hotel_payouts FOR SELECT
USING (host_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all hotel payouts" ON public.hotel_payouts;
CREATE POLICY "Admins can manage all hotel payouts"
ON public.hotel_payouts FOR ALL
USING (check_user_role(auth.uid(), 'admin'::user_role));

CREATE OR REPLACE FUNCTION public.create_hotel_payout_after_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  host_id_val UUID;
  commission_amt INTEGER;
  host_amt INTEGER;
  scheduled_date TIMESTAMPTZ;
  pay_method TEXT;
BEGIN
  pay_method := lower(COALESCE(NEW.payment_method, ''));

  -- Uniquement paiements encaissés par la plateforme (pas espèces)
  IF NEW.payment_status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;
  IF pay_method NOT IN ('card', 'wave', 'stripe') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.payment_status = 'paid'
     AND lower(COALESCE(OLD.payment_method, '')) IN ('card', 'wave', 'stripe') THEN
    RETURN NEW;
  END IF;

  SELECT he.host_id INTO host_id_val
  FROM public.hotel_establishments he
  WHERE he.id = NEW.establishment_id;

  IF host_id_val IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.host_net_amount IS NOT NULL AND NEW.host_net_amount >= 0 THEN
    host_amt := NEW.host_net_amount;
    commission_amt := GREATEST(0, COALESCE(NEW.total_price, 0) - host_amt);
  ELSE
    -- Fallback : 2 % sur le total (sans TVA)
    commission_amt := ROUND(COALESCE(NEW.total_price, 0) * 0.02);
    host_amt := COALESCE(NEW.total_price, 0) - commission_amt;
  END IF;

  scheduled_date := (NEW.check_in_date::date + INTERVAL '1 day')::timestamptz;

  IF NOT EXISTS (
    SELECT 1 FROM public.hotel_payouts WHERE booking_id = NEW.id
  ) THEN
    INSERT INTO public.hotel_payouts (
      booking_id,
      host_id,
      total_amount,
      commission_rate,
      commission_amount,
      host_amount,
      payout_method,
      status,
      scheduled_for
    ) VALUES (
      NEW.id,
      host_id_val,
      COALESCE(NEW.total_price, 0),
      0.02,
      commission_amt,
      host_amt,
      'bank_transfer',
      'scheduled',
      scheduled_date
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_hotel_payout ON public.hotel_bookings;
CREATE TRIGGER trigger_create_hotel_payout
AFTER INSERT OR UPDATE OF payment_status, payment_method, host_net_amount, total_price, check_in_date
ON public.hotel_bookings
FOR EACH ROW
EXECUTE FUNCTION public.create_hotel_payout_after_booking();

CREATE OR REPLACE FUNCTION public.update_hotel_payout_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_hotel_payout_timestamp ON public.hotel_payouts;
CREATE TRIGGER trigger_update_hotel_payout_timestamp
BEFORE UPDATE ON public.hotel_payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_hotel_payout_timestamp();

-- Backfill : réservations hôtel déjà payées en ligne
INSERT INTO public.hotel_payouts (
  booking_id,
  host_id,
  total_amount,
  commission_rate,
  commission_amount,
  host_amount,
  payout_method,
  status,
  scheduled_for
)
SELECT
  hb.id,
  he.host_id,
  COALESCE(hb.total_price, 0),
  0.02,
  CASE
    WHEN hb.host_net_amount IS NOT NULL AND hb.host_net_amount >= 0
      THEN GREATEST(0, COALESCE(hb.total_price, 0) - hb.host_net_amount)
    ELSE ROUND(COALESCE(hb.total_price, 0) * 0.02)
  END,
  COALESCE(
    hb.host_net_amount,
    COALESCE(hb.total_price, 0) - ROUND(COALESCE(hb.total_price, 0) * 0.02)
  ),
  'bank_transfer',
  'scheduled',
  (hb.check_in_date::date + INTERVAL '1 day')::timestamptz
FROM public.hotel_bookings hb
JOIN public.hotel_establishments he ON he.id = hb.establishment_id
WHERE hb.payment_status = 'paid'
  AND lower(COALESCE(hb.payment_method, '')) IN ('card', 'wave', 'stripe')
  AND NOT EXISTS (
    SELECT 1 FROM public.hotel_payouts hp WHERE hp.booking_id = hb.id
  )
ON CONFLICT (booking_id) DO NOTHING;

COMMENT ON TABLE public.hotel_payouts IS
  'Versements plateforme → hôtelier pour réservations payées carte/Wave (pas espèces).';
