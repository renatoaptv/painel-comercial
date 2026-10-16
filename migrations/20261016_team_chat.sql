-- Painel Comercial: grupo de chat por loja, sem alterar leads ou vendas.
-- Regras validadas no banco: RLS, autoria e isolamento por loja.

CREATE TABLE IF NOT EXISTS public.team_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_chat_messages_store_time_idx
  ON public.team_chat_messages (store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.team_chat_reads (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_chat_reads_clock_check CHECK (last_read_at <= now() + interval '2 minutes')
);

ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_reads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.team_chat_assign_author()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  member_org uuid;
  member_store uuid;
BEGIN
  SELECT p.organization_id, p.store_id INTO member_org, member_store
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.active = true
    AND p.role IN ('seller','manager','network_admin','super_admin');
  IF member_store IS NULL OR member_org IS NULL THEN
    RAISE EXCEPTION 'Chat disponível somente para usuários ativos de uma loja.';
  END IF;
  NEW.organization_id := member_org;
  NEW.store_id := member_store;
  NEW.sender_id := auth.uid();
  NEW.body := btrim(NEW.body);
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_chat_assign_author ON public.team_chat_messages;
CREATE TRIGGER trg_team_chat_assign_author
BEFORE INSERT ON public.team_chat_messages FOR EACH ROW
EXECUTE FUNCTION public.team_chat_assign_author();

-- Sem permissões de alteração/remoção de mensagens para perfis comuns.
REVOKE ALL ON TABLE public.team_chat_messages FROM anon, authenticated;
GRANT SELECT ON TABLE public.team_chat_messages TO authenticated;
GRANT INSERT(body) ON TABLE public.team_chat_messages TO authenticated;

DROP POLICY IF EXISTS team_chat_messages_read_same_store ON public.team_chat_messages;
CREATE POLICY team_chat_messages_read_same_store ON public.team_chat_messages
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = true
      AND p.role IN ('seller','manager','network_admin','super_admin')
      AND p.organization_id = team_chat_messages.organization_id
      AND p.store_id = team_chat_messages.store_id
  )
);
DROP POLICY IF EXISTS team_chat_messages_insert_same_store ON public.team_chat_messages;
CREATE POLICY team_chat_messages_insert_same_store ON public.team_chat_messages
FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = true
      AND p.role IN ('seller','manager','network_admin','super_admin')
      AND p.organization_id = team_chat_messages.organization_id
      AND p.store_id = team_chat_messages.store_id
  )
);

REVOKE ALL ON TABLE public.team_chat_reads FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.team_chat_reads TO authenticated;
DROP POLICY IF EXISTS team_chat_reads_select_self ON public.team_chat_reads;
CREATE POLICY team_chat_reads_select_self ON public.team_chat_reads
FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=auth.uid() AND p.active=true
      AND p.role IN ('seller','manager','network_admin','super_admin')
      AND p.organization_id=team_chat_reads.organization_id
      AND p.store_id=team_chat_reads.store_id
  )
);
DROP POLICY IF EXISTS team_chat_reads_insert_self ON public.team_chat_reads;
CREATE POLICY team_chat_reads_insert_self ON public.team_chat_reads
FOR INSERT TO authenticated WITH CHECK (
  user_id=auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=auth.uid() AND p.active=true
      AND p.role IN ('seller','manager','network_admin','super_admin')
      AND p.organization_id=team_chat_reads.organization_id
      AND p.store_id=team_chat_reads.store_id
  )
);
DROP POLICY IF EXISTS team_chat_reads_update_self ON public.team_chat_reads;
CREATE POLICY team_chat_reads_update_self ON public.team_chat_reads
FOR UPDATE TO authenticated
USING (
  user_id=auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true
    AND p.role IN ('seller','manager','network_admin','super_admin')
    AND p.organization_id=team_chat_reads.organization_id
    AND p.store_id=team_chat_reads.store_id)
)
WITH CHECK (
  user_id=auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true
    AND p.role IN ('seller','manager','network_admin','super_admin')
    AND p.organization_id=team_chat_reads.organization_id
    AND p.store_id=team_chat_reads.store_id)
);

-- Correção de privilégio preexistente: um usuário autenticado não pode
-- mudar sua própria role, loja ou organização para ler dados de outros grupos.
-- Administradores autorizados seguem usando a Edge Function com service_role.
CREATE OR REPLACE FUNCTION public.team_chat_protect_profile_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_role text;
  actor_org uuid;
  actor_store uuid;
  actor_active boolean;
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF ROW(NEW.id, NEW.organization_id, NEW.store_id, NEW.role,
           NEW.email, NEW.full_name, NEW.daily_goal, NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.id, OLD.organization_id, OLD.store_id, OLD.role,
           OLD.email, OLD.full_name, OLD.daily_goal, OLD.created_at) THEN
      RAISE EXCEPTION 'Alteração de identidade e permissões requer administração.';
    END IF;

    IF NEW.active IS DISTINCT FROM OLD.active THEN
      SELECT p.role, p.organization_id, p.store_id, p.active
        INTO actor_role, actor_org, actor_store, actor_active
      FROM public.profiles p WHERE p.id=auth.uid();
      IF actor_active IS DISTINCT FROM true
         OR auth.uid()=OLD.id
         OR NOT (
           actor_role='super_admin'
           OR (actor_role='network_admin' AND actor_org=OLD.organization_id)
           OR (actor_role='manager' AND actor_org=OLD.organization_id
                AND actor_store=OLD.store_id
                AND OLD.role IN ('seller','receptionist'))
         ) THEN
        RAISE EXCEPTION 'Sem permissão para alterar acesso de usuário.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_team_chat_protect_profile_scope ON public.profiles;
CREATE TRIGGER trg_team_chat_protect_profile_scope
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.team_chat_protect_profile_scope();

-- Postgres Changes respeita RLS de SELECT para a sessão inscrita.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public'
      AND tablename='team_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_messages;
  END IF;
END;
$$;
