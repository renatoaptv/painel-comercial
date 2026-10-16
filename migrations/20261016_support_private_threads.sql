-- Painel Comercial: atendimento privado ao suporte (superadministradores)
-- Dados de mensagens legadas sao preservados; o antigo chat geral fica somente leitura.
CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  store_id uuid REFERENCES public.stores(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_message_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_sender_id uuid REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS support_threads_recent_idx
ON public.support_threads (last_message_at DESC);

CREATE OR REPLACE FUNCTION public.support_assign_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
DECLARE v_org uuid; v_store uuid;
BEGIN
  SELECT p.organization_id,p.store_id INTO v_org,v_store
  FROM public.profiles p
  WHERE p.id=auth.uid() AND p.active=true
    AND p.role IN ('seller','manager','network_admin','receptionist');
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Somente usuarios ativos podem solicitar suporte.';
  END IF;
  NEW.requester_id:=auth.uid();
  NEW.organization_id:=v_org;
  NEW.store_id:=v_store;
  NEW.created_at:=clock_timestamp();
  NEW.last_message_at:=NEW.created_at;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_support_assign_thread ON public.support_threads;
CREATE TRIGGER trg_support_assign_thread
BEFORE INSERT ON public.support_threads
FOR EACH ROW EXECUTE FUNCTION public.support_assign_thread();

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_threads FROM anon,authenticated;
GRANT SELECT ON public.support_threads TO authenticated;
GRANT INSERT(requester_id) ON public.support_threads TO authenticated;
DROP POLICY IF EXISTS support_threads_select_allowed ON public.support_threads;
CREATE POLICY support_threads_select_allowed
ON public.support_threads FOR SELECT TO authenticated USING (
  (
    requester_id=auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true)
  )
  OR public.is_super_admin()
);
DROP POLICY IF EXISTS support_threads_insert_self ON public.support_threads;
CREATE POLICY support_threads_insert_self
ON public.support_threads FOR INSERT TO authenticated WITH CHECK (
  requester_id=auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=auth.uid() AND p.active=true
      AND p.role IN ('seller','manager','network_admin','receptionist')
      AND p.organization_id=support_threads.organization_id
      AND p.store_id IS NOT DISTINCT FROM support_threads.store_id)
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id),
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  body text NOT NULL CHECK(char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS support_messages_thread_recent_idx
ON public.support_messages (thread_id,created_at DESC);
CREATE INDEX IF NOT EXISTS support_messages_created_idx
ON public.support_messages (created_at DESC);

CREATE OR REPLACE FUNCTION public.support_assign_message()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.support_threads t
    JOIN public.profiles p ON p.id=auth.uid()
    WHERE t.id=NEW.thread_id AND p.active=true
    AND (
      (t.requester_id=auth.uid() AND p.role IN ('seller','manager','network_admin','receptionist'))
      OR p.role='super_admin'
    )
  ) THEN
    RAISE EXCEPTION 'Voce nao tem permissao para enviar mensagens neste atendimento.';
  END IF;
  NEW.sender_id:=auth.uid();
  NEW.body:=btrim(NEW.body);
  NEW.created_at:=clock_timestamp();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_support_assign_message ON public.support_messages;
CREATE TRIGGER trg_support_assign_message
BEFORE INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.support_assign_message();

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_messages FROM anon,authenticated;
GRANT SELECT ON public.support_messages TO authenticated;
GRANT INSERT(thread_id,body) ON public.support_messages TO authenticated;

DROP POLICY IF EXISTS support_messages_read_participants ON public.support_messages;
CREATE POLICY support_messages_read_participants
ON public.support_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id=support_messages.thread_id
    AND (
      (t.requester_id=auth.uid() AND EXISTS
         (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true))
      OR public.is_super_admin()
    ))
);
DROP POLICY IF EXISTS support_messages_insert_participants ON public.support_messages;
CREATE POLICY support_messages_insert_participants
ON public.support_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id=auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.support_threads t WHERE t.id=support_messages.thread_id
    AND (
      (t.requester_id=auth.uid() AND EXISTS
        (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true
          AND p.role IN ('seller','manager','network_admin','receptionist')))
      OR public.is_super_admin()
    )
  )
);

CREATE TABLE IF NOT EXISTS public.support_reads (
  thread_id uuid NOT NULL REFERENCES public.support_threads(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  last_read_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(thread_id,user_id)
);
ALTER TABLE public.support_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_reads FROM anon,authenticated;
GRANT SELECT ON public.support_reads TO authenticated;
GRANT INSERT(thread_id,user_id,last_read_at) ON public.support_reads TO authenticated;
GRANT UPDATE(last_read_at) ON public.support_reads TO authenticated;

CREATE OR REPLACE FUNCTION public.support_assign_read_time()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Nao e permitido alterar leituras de outro usuario.';
  END IF;
  NEW.last_read_at:=clock_timestamp();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_support_assign_read_time ON public.support_reads;
CREATE TRIGGER trg_support_assign_read_time
BEFORE INSERT OR UPDATE ON public.support_reads
FOR EACH ROW EXECUTE FUNCTION public.support_assign_read_time();

DROP POLICY IF EXISTS support_reads_select_self ON public.support_reads;
CREATE POLICY support_reads_select_self
ON public.support_reads FOR SELECT TO authenticated USING (
  user_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_threads t WHERE t.id=support_reads.thread_id
    AND (t.requester_id=auth.uid() OR public.is_super_admin())
  )
);
DROP POLICY IF EXISTS support_reads_insert_self ON public.support_reads;
CREATE POLICY support_reads_insert_self
ON public.support_reads FOR INSERT TO authenticated WITH CHECK (
  user_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_threads t WHERE t.id=support_reads.thread_id
    AND (t.requester_id=auth.uid() OR public.is_super_admin())
  )
);
DROP POLICY IF EXISTS support_reads_update_self ON public.support_reads;
CREATE POLICY support_reads_update_self
ON public.support_reads FOR UPDATE TO authenticated USING (
  user_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_threads t WHERE t.id=support_reads.thread_id
    AND (t.requester_id=auth.uid() OR public.is_super_admin())
  )
) WITH CHECK (
  user_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_threads t WHERE t.id=support_reads.thread_id
    AND (t.requester_id=auth.uid() OR public.is_super_admin())
  )
);

CREATE OR REPLACE FUNCTION public.support_touch_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.support_threads SET last_message_at=NEW.created_at,last_sender_id=NEW.sender_id WHERE id=NEW.thread_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.support_touch_thread() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_support_touch_thread ON public.support_messages;
CREATE TRIGGER trg_support_touch_thread
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.support_touch_thread();

-- Somente notificacoes de solicitações de usuarios ao suporte.
-- Entrega por pg_net para Edge Function que busca novamente a mensagem usando service role.
CREATE OR REPLACE FUNCTION public.support_dispatch_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,extensions AS $$
DECLARE v_secret text; v_sender_role text;
BEGIN
  SELECT role INTO v_sender_role FROM public.profiles WHERE id=NEW.sender_id;
  IF v_sender_role='super_admin' THEN RETURN NEW; END IF;
  SELECT webhook_secret INTO v_secret FROM public.push_config WHERE id=1;
  IF nullif(v_secret,'') IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url:='https://tlzshlerpspgpjaqskdg.supabase.co/functions/v1/support-push',
    headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',v_secret),
    body:=jsonb_build_object('support_message_id',NEW.id)
  );
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.support_dispatch_push() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_support_dispatch_push ON public.support_messages;
CREATE TRIGGER trg_support_dispatch_push
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.support_dispatch_push();

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_threads')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_messages')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages; END IF;
END $$;

-- Desativar novas mensagens e a digitacao no chat geral antigo, sem destruir o historico.
REVOKE INSERT(body),DELETE ON public.team_chat_messages FROM authenticated;
REVOKE INSERT,UPDATE ON public.team_chat_typing FROM authenticated;
REVOKE INSERT,UPDATE ON public.team_chat_bans FROM authenticated;
REVOKE INSERT,UPDATE ON public.team_chat_reads FROM authenticated;

-- Revogacao de recursos de escrita do chat antigo, inclusive privilegios por coluna.
DROP POLICY IF EXISTS team_chat_messages_insert_same_store ON public.team_chat_messages;
DROP POLICY IF EXISTS team_chat_messages_delete_seller_by_manager ON public.team_chat_messages;
DROP POLICY IF EXISTS team_chat_typing_insert_self ON public.team_chat_typing;
DROP POLICY IF EXISTS team_chat_typing_update_self ON public.team_chat_typing;
DROP POLICY IF EXISTS team_chat_bans_insert_manager ON public.team_chat_bans;
DROP POLICY IF EXISTS team_chat_bans_update_manager ON public.team_chat_bans;
