import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const json = (obj: unknown, status=200) => new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type":"application/json","Cache-Control":"no-store" }
  });
  if (req.method!=="POST") return json({error:"method_not_allowed"},405);
  try {
    const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {auth:{persistSession:false}});
    const {data:cfg,error:ce}=await sb.from("push_config")
      .select("vapid_public_key,vapid_private_key,webhook_secret").eq("id",1).single();
    if (ce||!cfg) throw ce||new Error("push_config_missing");
    if(!cfg.webhook_secret||req.headers.get("x-push-secret")!==cfg.webhook_secret)
      return json({error:"unauthorized"},401);
    const payload=await req.json();
    const id=String(payload?.support_message_id||"");
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return json({error:"invalid_message_id"},400);
    const {data:msg,error:me}=await sb.from("support_messages")
      .select("id,thread_id,sender_id").eq("id",id).maybeSingle();
    if(me) throw me;
    if(!msg) return json({error:"message_not_found"},404);
    const {data:sender,error:se}=await sb.from("profiles")
      .select("role,active").eq("id",msg.sender_id).maybeSingle();
    if(se) throw se;
    if(!sender||sender.role==="super_admin") return json({ok:true,sent:0,reason:"support_reply"});
    const {data:recipients,error:re}=await sb.from("profiles")
      .select("id").eq("active",true).eq("role","super_admin");
    if(re) throw re;
    const ids=(recipients||[]).map((p:{id:string})=>p.id);
    if(!ids.length)return json({ok:true,sent:0,reason:"no_super_admin"});
    const {data:subs,error:pe}=await sb.from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth").eq("enabled",true).in("user_id",ids);
    if(pe)throw pe;
    webpush.setVapidDetails("mailto:admin@prospectareal.com.br",
      cfg.vapid_public_key,cfg.vapid_private_key);
    let sent=0,failed=0;
    const notice=JSON.stringify({
      title:"🛟 Nova mensagem de suporte",
      body:"Um usuário solicitou ajuda no Painel Comercial.",
      url:"./",
      event:"support",
      thread_id:msg.thread_id,
      tag:"support-"+msg.id
    });
    for(const sub of subs||[]) {
      try {
        await webpush.sendNotification(
          {endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},
          notice,{TTL:3600}
        );
        sent++;
      }catch(e:any){
        failed++;
        const code=e?.statusCode||e?.status;
        if(code===404||code===410)
          await sb.from("push_subscriptions").update({enabled:false}).eq("id",sub.id);
        console.error("support-push-delivery",{status:code||null});
      }
    }
    return json({ok:true,sent,failed});
  }catch(e:any){
    console.error("support-push-error",e?.message||String(e));
    return json({error:"internal_error"},500);
  }
});
