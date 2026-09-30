-- Harden admin ↔ user messaging (Service AkwaHome)
-- Re-applies critical bits + participant-based send (covers is_admin edge cases)

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'listing';

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_kind_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_kind_check
  CHECK (kind IN ('listing', 'admin_support'));

ALTER TABLE public.conversations
  ALTER COLUMN property_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_admin_support_guest
  ON public.conversations (guest_id)
  WHERE kind = 'admin_support';

DROP POLICY IF EXISTS "Admins can view admin support conversations" ON public.conversations;
CREATE POLICY "Admins can view admin support conversations"
  ON public.conversations
  FOR SELECT
  USING (kind = 'admin_support' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can create admin support conversations" ON public.conversations;
CREATE POLICY "Admins can create admin support conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (
    kind = 'admin_support'
    AND public.is_admin()
    AND auth.uid() = host_id
    AND guest_id IS NOT NULL
    AND guest_id <> auth.uid()
  );

DROP POLICY IF EXISTS "Admins can update admin support conversations" ON public.conversations;
CREATE POLICY "Admins can update admin support conversations"
  ON public.conversations
  FOR UPDATE
  USING (kind = 'admin_support' AND public.is_admin())
  WITH CHECK (kind = 'admin_support' AND public.is_admin());

DROP POLICY IF EXISTS "Guests can view own admin support conversations" ON public.conversations;
CREATE POLICY "Guests can view own admin support conversations"
  ON public.conversations
  FOR SELECT
  USING (kind = 'admin_support' AND auth.uid() = guest_id);

DROP POLICY IF EXISTS "Admins can send admin support messages" ON public.conversation_messages;
CREATE POLICY "Admins can send admin support messages"
  ON public.conversation_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.kind = 'admin_support'
    )
  );

-- Participants (host admin or guest) — filet de sécurité si is_admin() est flaky
DROP POLICY IF EXISTS "Participants can send admin support messages" ON public.conversation_messages;
CREATE POLICY "Participants can send admin support messages"
  ON public.conversation_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.kind = 'admin_support'
        AND (c.host_id = auth.uid() OR c.guest_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can read admin support messages" ON public.conversation_messages;
CREATE POLICY "Admins can read admin support messages"
  ON public.conversation_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.kind = 'admin_support'
        AND public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Guests can read own admin support messages" ON public.conversation_messages;
CREATE POLICY "Guests can read own admin support messages"
  ON public.conversation_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.kind = 'admin_support'
        AND c.guest_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Guests can send admin support messages" ON public.conversation_messages;
CREATE POLICY "Guests can send admin support messages"
  ON public.conversation_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.kind = 'admin_support'
        AND c.guest_id = auth.uid()
    )
  );
