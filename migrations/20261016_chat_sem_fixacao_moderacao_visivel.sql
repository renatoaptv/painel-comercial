-- Ajuste de experiencia do Chat Comercial: desativar fixacao sem apagar mensagens.
-- Habilitar moderacao por gestor e superadministrador, sempre na propria loja.

-- Os recados existentes permanecem armazenados para auditoria/historico,
-- mas ninguem pode criar nem modificar fixacoes pela API.
REVOKE INSERT (message_id), UPDATE (active) ON TABLE public.team_chat_pins FROM authenticated;
DROP POLICY IF EXISTS team_chat_pins_insert_manager ON public.team_chat_pins;
DROP POLICY IF EXISTS team_chat_pins_unpin_manager ON public.team_chat_pins;

-- O administrador geral tambem e perfil administrativo.
-- Nenhum desses privilegios se estende aos vendedores.
DROP POLICY IF EXISTS team_chat_bans_insert_manager ON public.team_chat_bans;
CREATE POLICY team_chat_bans_insert_manager
ON public.team_chat_bans FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=auth.uid() AND p.active=true
      AND p.role IN ('manager','super_admin')
      AND p.organization_id=team_chat_bans.organization_id
      AND p.store_id=team_chat_bans.store_id)
  AND EXISTS (SELECT 1 FROM public.profiles t
    WHERE t.id=team_chat_bans.user_id AND t.role='seller'
      AND t.organization_id=team_chat_bans.organization_id
      AND t.store_id=team_chat_bans.store_id)
);

DROP POLICY IF EXISTS team_chat_bans_update_manager ON public.team_chat_bans;
CREATE POLICY team_chat_bans_update_manager
ON public.team_chat_bans FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=auth.uid() AND p.active=true
    AND p.role IN ('manager','super_admin')
    AND p.organization_id=team_chat_bans.organization_id
    AND p.store_id=team_chat_bans.store_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=auth.uid() AND p.active=true
    AND p.role IN ('manager','super_admin')
    AND p.organization_id=team_chat_bans.organization_id
    AND p.store_id=team_chat_bans.store_id));

CREATE OR REPLACE FUNCTION public.team_chat_assign_ban()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $$
DECLARE v_org uuid; v_store uuid; v_role text;
BEGIN
  SELECT p.organization_id,p.store_id INTO v_org,v_store FROM public.profiles p
   WHERE p.id=auth.uid() AND p.active=true
     AND p.role IN ('manager','super_admin');
  IF v_org IS NULL OR v_store IS NULL THEN
    RAISE EXCEPTION 'Somente gestores ou administradores ativos podem moderar o chat.';
  END IF;
  SELECT p.role INTO v_role FROM public.profiles p
   WHERE p.id=NEW.user_id AND p.organization_id=v_org AND p.store_id=v_store;
  IF v_role IS DISTINCT FROM 'seller' THEN
    RAISE EXCEPTION 'Somente vendedores da propria loja podem ser bloqueados no chat.';
  END IF;
  IF TG_OP='UPDATE' AND
    (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.store_id IS DISTINCT FROM OLD.store_id) THEN
    RAISE EXCEPTION 'Usuario e loja do bloqueio nao podem ser alterados.';
  END IF;
  NEW.organization_id:=v_org;
  NEW.store_id:=v_store;
  NEW.changed_by:=auth.uid();
  NEW.changed_at:=clock_timestamp();
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS team_chat_messages_delete_seller_by_manager ON public.team_chat_messages;
CREATE POLICY team_chat_messages_delete_seller_by_manager
ON public.team_chat_messages FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles g
    WHERE g.id=auth.uid() AND g.active=true
      AND g.role IN ('manager','super_admin')
      AND g.organization_id=team_chat_messages.organization_id
      AND g.store_id=team_chat_messages.store_id)
  AND EXISTS (SELECT 1 FROM public.profiles author
    WHERE author.id=team_chat_messages.sender_id AND author.role='seller'
      AND author.organization_id=team_chat_messages.organization_id
      AND author.store_id=team_chat_messages.store_id)
);
