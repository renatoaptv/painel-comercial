-- Painel Comercial: moderacao por gestor no chat, sem alterar perfis CRM.
-- Excluir mensagem de vendedor e bloquear apenas envio no chat, com trilha de auditoria.
CREATE TABLE public.team_chat_bans (
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  active boolean NOT NULL DEFAULT true,
  changed_by uuid NOT NULL REFERENCES public.profiles(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,store_id)
);
CREATE INDEX team_chat_bans_active_store_idx ON public.team_chat_bans(store_id) WHERE active;
ALTER TABLE public.team_chat_bans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_chat_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  target_user_id uuid NOT NULL REFERENCES public.profiles(id),
  message_id uuid,
  event_type text NOT NULL CHECK(event_type IN ('message_deleted','member_blocked','member_unblocked')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_chat_moderation_events_store_date_idx ON public.team_chat_moderation_events(store_id,created_at DESC);
ALTER TABLE public.team_chat_moderation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_chat_moderation_events FROM anon,authenticated;
GRANT SELECT ON public.team_chat_moderation_events TO authenticated;

CREATE POLICY team_chat_moderation_events_read_store
ON public.team_chat_moderation_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true
  AND p.role IN ('manager','seller','network_admin','super_admin')
  AND p.organization_id=team_chat_moderation_events.organization_id
  AND p.store_id=team_chat_moderation_events.store_id
));

-- Gestores de loja podem observar bloqueios; vendedor pode ver o proprio.
REVOKE ALL ON public.team_chat_bans FROM anon,authenticated;
GRANT SELECT ON public.team_chat_bans TO authenticated;
GRANT INSERT(user_id,store_id,active) ON public.team_chat_bans TO authenticated;
GRANT UPDATE(active) ON public.team_chat_bans TO authenticated;

CREATE POLICY team_chat_bans_read ON public.team_chat_bans
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true
    AND p.organization_id=team_chat_bans.organization_id
    AND p.store_id=team_chat_bans.store_id
    AND (p.role IN ('manager','network_admin','super_admin') OR (p.role='seller' AND p.id=team_chat_bans.user_id))
  )
);
CREATE POLICY team_chat_bans_insert_manager ON public.team_chat_bans
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=auth.uid() AND p.active=true AND p.role='manager'
    AND p.organization_id=team_chat_bans.organization_id AND p.store_id=team_chat_bans.store_id)
  AND EXISTS (SELECT 1 FROM public.profiles target
    WHERE target.id=team_chat_bans.user_id AND target.role='seller'
    AND target.organization_id=team_chat_bans.organization_id AND target.store_id=team_chat_bans.store_id)
);
CREATE POLICY team_chat_bans_update_manager ON public.team_chat_bans
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=auth.uid() AND p.active=true AND p.role='manager'
  AND p.organization_id=team_chat_bans.organization_id AND p.store_id=team_chat_bans.store_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=auth.uid() AND p.active=true AND p.role='manager'
  AND p.organization_id=team_chat_bans.organization_id AND p.store_id=team_chat_bans.store_id));

CREATE OR REPLACE FUNCTION public.team_chat_assign_ban()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $$
DECLARE v_org uuid; v_store uuid; v_role text;
BEGIN
  SELECT p.organization_id,p.store_id INTO v_org,v_store FROM public.profiles p
   WHERE p.id=auth.uid() AND p.active=true AND p.role='manager';
  IF v_org IS NULL OR v_store IS NULL THEN
    RAISE EXCEPTION 'Somente gestor ativo pode moderar o chat.';
  END IF;
  SELECT p.role INTO v_role FROM public.profiles p
   WHERE p.id=NEW.user_id AND p.organization_id=v_org AND p.store_id=v_store;
  IF v_role IS DISTINCT FROM 'seller' THEN
    RAISE EXCEPTION 'O bloqueio do chat so se aplica a vendedores da loja.';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.store_id IS DISTINCT FROM OLD.store_id) THEN
    RAISE EXCEPTION 'Usuario e loja do bloqueio nao podem ser alterados.';
  END IF;
  NEW.organization_id:=v_org;
  NEW.store_id:=v_store;
  NEW.changed_by:=auth.uid();
  NEW.changed_at:=clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_team_chat_assign_ban
BEFORE INSERT OR UPDATE ON public.team_chat_bans
FOR EACH ROW EXECUTE FUNCTION public.team_chat_assign_ban();

-- Eventos sao criados exclusivamente pelo banco e utilizados tambem pelo realtime.
CREATE OR REPLACE FUNCTION public.team_chat_log_ban()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
BEGIN
  IF TG_OP='INSERT' OR (OLD.active IS DISTINCT FROM NEW.active) THEN
    INSERT INTO public.team_chat_moderation_events
    (organization_id,store_id,actor_id,target_user_id,event_type)
    VALUES(NEW.organization_id,NEW.store_id,NEW.changed_by,NEW.user_id,
      CASE WHEN NEW.active THEN 'member_blocked' ELSE 'member_unblocked' END);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.team_chat_log_ban() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_team_chat_log_ban
AFTER INSERT OR UPDATE ON public.team_chat_bans
FOR EACH ROW EXECUTE FUNCTION public.team_chat_log_ban();

-- Exclusao definitiva: somente mensagens de vendedores da MESMA loja.
GRANT DELETE ON public.team_chat_messages TO authenticated;
CREATE POLICY team_chat_messages_delete_seller_by_manager ON public.team_chat_messages
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles manager_profile
    WHERE manager_profile.id=auth.uid() AND manager_profile.active=true
    AND manager_profile.role='manager'
    AND manager_profile.organization_id=team_chat_messages.organization_id
    AND manager_profile.store_id=team_chat_messages.store_id)
  AND EXISTS (SELECT 1 FROM public.profiles author_profile
    WHERE author_profile.id=team_chat_messages.sender_id AND author_profile.role='seller'
    AND author_profile.organization_id=team_chat_messages.organization_id
    AND author_profile.store_id=team_chat_messages.store_id)
);

-- Pinos associados a mensagens eliminadas devem ser removidos tambem.
ALTER TABLE public.team_chat_pins DROP CONSTRAINT team_chat_pins_message_id_fkey;
ALTER TABLE public.team_chat_pins ADD CONSTRAINT team_chat_pins_message_id_fkey
 FOREIGN KEY(message_id) REFERENCES public.team_chat_messages(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.team_chat_log_message_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
BEGIN
  INSERT INTO public.team_chat_moderation_events
  (organization_id,store_id,actor_id,target_user_id,message_id,event_type)
  VALUES(OLD.organization_id,OLD.store_id,auth.uid(),OLD.sender_id,OLD.id,'message_deleted');
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.team_chat_log_message_removal() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_team_chat_log_message_removal
AFTER DELETE ON public.team_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.team_chat_log_message_removal();

-- Impede envio de mensagens enquanto bloqueado, mesmo por chamadas diretas à API.
DROP POLICY IF EXISTS team_chat_messages_insert_same_store ON public.team_chat_messages;
CREATE POLICY team_chat_messages_insert_same_store ON public.team_chat_messages
FOR INSERT TO authenticated WITH CHECK (
  sender_id=auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true
    AND p.role IN ('seller','manager','network_admin','super_admin')
    AND p.organization_id=team_chat_messages.organization_id AND p.store_id=team_chat_messages.store_id)
  AND NOT EXISTS (SELECT 1 FROM public.team_chat_bans b WHERE b.user_id=auth.uid()
    AND b.store_id=team_chat_messages.store_id AND b.active=true)
);

-- O bloqueado pode ler os avisos, mas nao indicar que esta digitando.
DROP POLICY IF EXISTS team_chat_typing_insert_self ON public.team_chat_typing;
CREATE POLICY team_chat_typing_insert_self ON public.team_chat_typing
FOR INSERT TO authenticated WITH CHECK (
  user_id=auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true
    AND p.role IN ('seller','manager','network_admin','super_admin')
    AND p.organization_id=team_chat_typing.organization_id AND p.store_id=team_chat_typing.store_id)
  AND (is_typing=false OR NOT EXISTS (SELECT 1 FROM public.team_chat_bans b
    WHERE b.user_id=auth.uid() AND b.store_id=team_chat_typing.store_id AND b.active=true))
);
DROP POLICY IF EXISTS team_chat_typing_update_self ON public.team_chat_typing;
CREATE POLICY team_chat_typing_update_self ON public.team_chat_typing
FOR UPDATE TO authenticated
USING (user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=auth.uid() AND p.active=true
  AND p.role IN ('seller','manager','network_admin','super_admin')
  AND p.organization_id=team_chat_typing.organization_id AND p.store_id=team_chat_typing.store_id))
WITH CHECK (user_id=auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=auth.uid() AND p.active=true
    AND p.role IN ('seller','manager','network_admin','super_admin')
    AND p.organization_id=team_chat_typing.organization_id AND p.store_id=team_chat_typing.store_id)
  AND (is_typing=false OR NOT EXISTS (SELECT 1 FROM public.team_chat_bans b
    WHERE b.user_id=auth.uid() AND b.store_id=team_chat_typing.store_id AND b.active=true))
);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_bans;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_moderation_events;
END;
$$;
