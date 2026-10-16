-- Chat Comercial: recados fixados pelo gerente, visíveis somente à própria loja.
-- Mantém histórico dos recados desafixados, sem alterar as mensagens originais.
CREATE TABLE IF NOT EXISTS public.team_chat_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.team_chat_messages(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  pinned_by uuid NOT NULL REFERENCES public.profiles(id),
  pinned_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS team_chat_only_one_active_pin_per_message
ON public.team_chat_pins(message_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS team_chat_pins_store_active_time_idx
ON public.team_chat_pins(store_id, active, pinned_at DESC);

ALTER TABLE public.team_chat_pins ENABLE ROW LEVEL SECURITY;

-- Autor, data, loja e empresa são sempre atribuídos pelo banco, não pelo navegador.
CREATE OR REPLACE FUNCTION public.team_chat_assign_pin()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  manager_org uuid;
  manager_store uuid;
  message_org uuid;
  message_store uuid;
BEGIN
  SELECT p.organization_id, p.store_id
    INTO manager_org, manager_store
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.active = true
    AND p.role = 'manager';

  IF manager_org IS NULL OR manager_store IS NULL THEN
    RAISE EXCEPTION 'Somente gestores ativos de uma loja podem fixar avisos.';
  END IF;

  SELECT m.organization_id, m.store_id
    INTO message_org, message_store
  FROM public.team_chat_messages m
  WHERE m.id = NEW.message_id;

  IF message_org IS NULL OR message_org <> manager_org
     OR message_store IS DISTINCT FROM manager_store THEN
    RAISE EXCEPTION 'A mensagem não pertence à loja do gestor.';
  END IF;

  NEW.organization_id := manager_org;
  NEW.store_id := manager_store;
  NEW.pinned_by := auth.uid();
  NEW.pinned_at := clock_timestamp();
  NEW.active := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_chat_assign_pin ON public.team_chat_pins;
CREATE TRIGGER trg_team_chat_assign_pin
BEFORE INSERT ON public.team_chat_pins
FOR EACH ROW EXECUTE FUNCTION public.team_chat_assign_pin();

-- Nenhum usuário pode editar o autor, a loja ou o conteúdo de um recado fixado.
-- O gestor pode apenas mudar active:true -> false (desafixar).
REVOKE ALL ON TABLE public.team_chat_pins FROM anon, authenticated;
GRANT SELECT ON TABLE public.team_chat_pins TO authenticated;
GRANT INSERT(message_id) ON TABLE public.team_chat_pins TO authenticated;
GRANT UPDATE(active) ON TABLE public.team_chat_pins TO authenticated;

DROP POLICY IF EXISTS team_chat_pins_read_same_store ON public.team_chat_pins;
CREATE POLICY team_chat_pins_read_same_store ON public.team_chat_pins
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = true
      AND p.role IN ('seller','manager','network_admin','super_admin')
      AND p.organization_id = team_chat_pins.organization_id
      AND p.store_id = team_chat_pins.store_id
  )
);

DROP POLICY IF EXISTS team_chat_pins_insert_manager ON public.team_chat_pins;
CREATE POLICY team_chat_pins_insert_manager ON public.team_chat_pins
FOR INSERT TO authenticated
WITH CHECK (
  active = true AND pinned_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = true
      AND p.role = 'manager'
      AND p.organization_id = team_chat_pins.organization_id
      AND p.store_id = team_chat_pins.store_id
  )
  AND EXISTS (
    SELECT 1 FROM public.team_chat_messages m
    WHERE m.id = team_chat_pins.message_id
      AND m.organization_id = team_chat_pins.organization_id
      AND m.store_id = team_chat_pins.store_id
  )
);

DROP POLICY IF EXISTS team_chat_pins_unpin_manager ON public.team_chat_pins;
CREATE POLICY team_chat_pins_unpin_manager ON public.team_chat_pins
FOR UPDATE TO authenticated
USING (
  active = true
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = true
      AND p.role = 'manager'
      AND p.organization_id = team_chat_pins.organization_id
      AND p.store_id = team_chat_pins.store_id
  )
)
WITH CHECK (
  active = false
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = true
      AND p.role = 'manager'
      AND p.organization_id = team_chat_pins.organization_id
      AND p.store_id = team_chat_pins.store_id
  )
);

-- Atualizações INSERT/UPDATE no chat refletidas para usuários da loja.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'team_chat_pins'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_pins;
  END IF;
END;
$$;
