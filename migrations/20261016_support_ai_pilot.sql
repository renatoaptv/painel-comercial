-- Preparacao da IA do suporte (inicialmente DESATIVADA).
-- Aplicar somente apos configurar OPENAI_API_KEY no Supabase.
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false;

ALTER TABLE public.support_messages ALTER COLUMN sender_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='support_messages_actor_check') THEN
    ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_actor_check
    CHECK ((is_ai=true AND sender_id IS NULL) OR (is_ai=false AND sender_id IS NOT NULL));
  END IF;
END $$;

ALTER TABLE public.support_threads
  ADD COLUMN IF NOT EXISTS last_sender_is_ai boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.support_assign_message()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
BEGIN
  IF auth.role()='service_role' AND NEW.is_ai IS TRUE THEN
    IF NOT EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id=NEW.thread_id)
    THEN RAISE EXCEPTION 'Atendimento inexistente'; END IF;
    NEW.sender_id:=NULL;
    NEW.body:=btrim(NEW.body);
    NEW.created_at:=clock_timestamp();
    RETURN NEW;
  END IF;

  IF NEW.is_ai IS TRUE THEN RAISE EXCEPTION 'Somente o backend pode gerar uma resposta de IA'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.support_threads t
    JOIN public.profiles p ON p.id=auth.uid()
    WHERE t.id=NEW.thread_id AND p.active=true
      AND ((t.requester_id=auth.uid()
            AND p.role IN ('seller','manager','network_admin','receptionist'))
      OR p.role='super_admin')
  ) THEN RAISE EXCEPTION 'Sem permissao para esta conversa'; END IF;

  NEW.is_ai:=false;
  NEW.sender_id:=auth.uid();
  NEW.body:=btrim(NEW.body);
  NEW.created_at:=clock_timestamp();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.support_touch_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.support_threads
    SET last_message_at=NEW.created_at,
        last_sender_id=NEW.sender_id,
        last_sender_is_ai=NEW.is_ai
  WHERE id=NEW.thread_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.support_touch_thread() FROM PUBLIC,anon,authenticated;

-- Bloqueia eventos de push ao administrador quando quem respondeu foi o robo.
CREATE OR REPLACE FUNCTION public.support_dispatch_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,extensions AS $$
DECLARE v_secret text; v_sender_role text;
BEGIN
  IF NEW.is_ai THEN RETURN NEW; END IF;
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

CREATE TABLE IF NOT EXISTS public.support_ai_config (
  id smallint PRIMARY KEY CHECK (id=1),
  enabled boolean NOT NULL DEFAULT false,
  model text NOT NULL DEFAULT 'gpt-5.6-luna',
  monthly_max_requests integer NOT NULL DEFAULT 1000 CHECK(monthly_max_requests BETWEEN 1 AND 10000),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO public.support_ai_config (id,enabled,model,monthly_max_requests)
VALUES (1,false,'gpt-5.6-luna',1000)
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.support_ai_jobs (
  source_message_id uuid PRIMARY KEY REFERENCES public.support_messages(id),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id),
  status text NOT NULL DEFAULT 'processing'
    CHECK(status IN ('processing','answered','escalated','failed')),
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_micro_usd bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS support_ai_jobs_month_idx
  ON public.support_ai_jobs(created_at DESC);
ALTER TABLE public.support_ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ai_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_ai_config,public.support_ai_jobs FROM anon,authenticated;

-- SERIALIZA RESERVAS: evita resposta repetida e limita em 1000 no mes,
-- mesmo com muitas pessoas enviando ao mesmo tempo.
CREATE OR REPLACE FUNCTION public.support_ai_claim(p_message_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE c public.support_ai_config%ROWTYPE;
        m public.support_messages%ROWTYPE;
        n integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    THEN RAISE EXCEPTION 'Nao autorizado'; END IF;
  SELECT * INTO c FROM public.support_ai_config WHERE id=1 FOR UPDATE;
  IF NOT FOUND OR NOT c.enabled THEN RETURN false; END IF;
  SELECT * INTO m FROM public.support_messages WHERE id=p_message_id;
  IF NOT FOUND OR m.is_ai THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=m.sender_id AND p.role='super_admin')
    THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.support_ai_jobs WHERE source_message_id=p_message_id)
    THEN RETURN false; END IF;
  SELECT count(*) INTO n FROM public.support_ai_jobs
    WHERE created_at>=date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC')
      AND created_at<date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC')+interval '1 month';
  IF n>=c.monthly_max_requests THEN RETURN false; END IF;
  INSERT INTO public.support_ai_jobs(source_message_id,thread_id,model)
  VALUES(p_message_id,m.thread_id,c.model);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.support_ai_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_ai_claim(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.support_ai_complete(
  p_message_id uuid,p_status text,p_input_tokens integer,p_output_tokens integer,
  p_cost_micro_usd bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado'; END IF;
  IF p_status NOT IN ('answered','escalated','failed')
    THEN RAISE EXCEPTION 'Estado invalido'; END IF;
  UPDATE public.support_ai_jobs SET status=p_status,
    input_tokens=greatest(0,p_input_tokens),
    output_tokens=greatest(0,p_output_tokens),
    estimated_cost_micro_usd=greatest(0,p_cost_micro_usd),
    completed_at=clock_timestamp()
  WHERE source_message_id=p_message_id AND status='processing';
END $$;
REVOKE ALL ON FUNCTION public.support_ai_complete(uuid,text,integer,integer,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_ai_complete(uuid,text,integer,integer,bigint) TO service_role;

-- Edge Function consulta configuracao apenas usando service role.
GRANT SELECT ON public.support_ai_config,public.support_ai_jobs TO service_role;
GRANT INSERT,UPDATE ON public.support_ai_jobs TO service_role;
GRANT INSERT(is_ai,thread_id,body) ON public.support_messages TO service_role;
