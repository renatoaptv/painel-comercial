-- Indicador de digitação do chat: apenas usuários ativos da mesma loja.
-- O banco controla autor, loja e horário para impedir falsificação.
CREATE TABLE IF NOT EXISTS public.team_chat_typing (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_chat_typing_by_store
  ON public.team_chat_typing (store_id, updated_at DESC);

ALTER TABLE public.team_chat_typing ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.team_chat_assign_typing()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  p_org uuid;
  p_store uuid;
BEGIN
  SELECT p.organization_id, p.store_id INTO p_org, p_store
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = true
      AND p.role IN ('seller', 'manager', 'network_admin', 'super_admin');

  IF p_org IS NULL OR p_store IS NULL THEN
    RAISE EXCEPTION 'Indicador de digitação disponível somente para usuários ativos de uma loja.';
  END IF;

  NEW.user_id := auth.uid();
  NEW.organization_id := p_org;
  NEW.store_id := p_store;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_chat_assign_typing ON public.team_chat_typing;
CREATE TRIGGER trg_team_chat_assign_typing
BEFORE INSERT OR UPDATE ON public.team_chat_typing
FOR EACH ROW EXECUTE FUNCTION public.team_chat_assign_typing();

REVOKE ALL ON TABLE public.team_chat_typing FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.team_chat_typing TO authenticated;

DROP POLICY IF EXISTS team_chat_typing_read_store ON public.team_chat_typing;
CREATE POLICY team_chat_typing_read_store
ON public.team_chat_typing FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = true
      AND p.role IN ('seller','manager','network_admin','super_admin')
      AND p.organization_id = team_chat_typing.organization_id
      AND p.store_id = team_chat_typing.store_id)
);

DROP POLICY IF EXISTS team_chat_typing_insert_self ON public.team_chat_typing;
CREATE POLICY team_chat_typing_insert_self
ON public.team_chat_typing FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = true
      AND p.role IN ('seller','manager','network_admin','super_admin')
      AND p.organization_id = team_chat_typing.organization_id
      AND p.store_id = team_chat_typing.store_id)
);

DROP POLICY IF EXISTS team_chat_typing_update_self ON public.team_chat_typing;
CREATE POLICY team_chat_typing_update_self
ON public.team_chat_typing FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = true
      AND p.role IN ('seller','manager','network_admin','super_admin')
      AND p.organization_id = team_chat_typing.organization_id
      AND p.store_id = team_chat_typing.store_id)
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = true
      AND p.role IN ('seller','manager','network_admin','super_admin')
      AND p.organization_id = team_chat_typing.organization_id
      AND p.store_id = team_chat_typing.store_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'team_chat_typing'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_typing;
  END IF;
END;
$$;
