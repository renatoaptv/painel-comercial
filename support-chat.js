/* Painel Comercial - mensagens privadas entre solicitante e superadministrador.
 * Autorizacao de verdade: RLS e gatilhos no Supabase. Nunca usar o chat legado.
 */
let supportChannel=null;
let supportThreads=[];
let supportPeople=new Map();
let supportReadTimes=new Map();
let supportCurrentThread=null;
let supportBusy=false;
let supportOpening=false;
let supportToastTimer=null;
let supportToastThread=null;

function isSupportAgent(){
  return !!(currentUser&&currentUser.rawRole==="super_admin");
}
function canUseSupport(){
  return !!(currentUser && ["seller","manager","network_admin","super_admin"].includes(currentUser.rawRole));
}
function supportEl(id){return document.getElementById(id)}
function supportIsOpen(){return supportEl("supportModal").classList.contains("show")}
function supportStatus(text){supportEl("supportStatus").textContent=text||""}
function supportDisplayName(uid){
  if(uid==null)return "Assistente IA";
  if(String(uid)===String(currentUser?.id))return "Você";
  const p=supportPeople.get(String(uid));
  if(p?.role==="super_admin")return "Suporte";
  return p?.full_name||"Usuário";
}
function supportSetOpen(open){
  supportEl("supportModal").classList.toggle("show",!!open);
  if(!open)supportHideToast();
}
function supportHideToast(){
  supportEl("supportToast").hidden=true;
  if(supportToastTimer)clearTimeout(supportToastTimer);
  supportToastTimer=null;
}
function supportShowToast(row){
  if(!canUseSupport()||String(row.sender_id)===String(currentUser.id)||supportIsOpen())return;
  const agent=isSupportAgent();
  supportEl("supportToastTitle").textContent=agent?"🛟 Novo pedido de suporte":"🛟 Resposta do suporte";
  supportEl("supportToastBody").textContent=agent?"Um usuário enviou uma mensagem.":"Você recebeu uma resposta.";
  supportEl("supportToast").hidden=false;
  supportToastThread=row.thread_id;
  if(supportToastTimer)clearTimeout(supportToastTimer);
  supportToastTimer=setTimeout(supportHideToast,6500);
}
function supportOpenFromToast(){
  if(isSupportAgent()&&supportToastThread)openSupportChat(supportToastThread);
  else openSupportChat();
}
async function initTeamChat(){
  if(!canUseSupport())return;
  const button=supportEl("supportButton");
  button.classList.add("available");
  supportEl("supportButtonText").textContent=isSupportAgent()?"🛟 Central de suporte":"🛟 Pedir suporte";
  supportEl("supportInbox").hidden=!isSupportAgent();
  supportEl("supportLayout").classList.toggle("agent",isSupportAgent());
  await supportRefreshThreads();
  if(supportChannel)await sb.removeChannel(supportChannel);
  // O RLS filtra os eventos de modo que cada solicitante receba somente seu chamado.
  supportChannel=sb.channel("support-private-"+currentUser.id)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"support_messages"},
      async payload=>{
        if(!currentUser)return;
        const row=payload.new||{};
        if(String(row.sender_id)!==String(currentUser.id))supportShowToast(row);
        await supportRefreshThreads();
        if(supportIsOpen()&&String(supportCurrentThread)===String(row.thread_id)){
          const ok=await supportLoadMessages();
          if(ok)await supportMarkRead();
        }
      })
    .on("postgres_changes",{event:"*",schema:"public",table:"support_threads"},
      async()=>{if(currentUser)await supportRefreshThreads()})
    .subscribe(status=>{
      if(status==="CHANNEL_ERROR")console.warn("Suporte: conexao em tempo real instavel");
    });
  // Quando o suporte e aberto pela notificacao push, selecionar o chamado correto.
  if(isSupportAgent() && typeof window!=="undefined"){
    const address=new URL(window.location.href);
    const ticket=address.searchParams.get("suporte");
    if(ticket){
      address.searchParams.delete("suporte");
      window.history.replaceState(window.history.state,"",
        address.pathname+address.search+address.hash);
      if(/^[0-9a-f-]{36}$/i.test(ticket))await openSupportChat(ticket);
    }
  }
}
async function supportRefreshThreads(){
  if(!canUseSupport())return false;
  let q=sb.from("support_threads")
    .select("id,requester_id,organization_id,store_id,last_message_at,last_sender_id,last_sender_is_ai,needs_human")
    .order("last_message_at",{ascending:false}).limit(200);
  if(!isSupportAgent())q=q.eq("requester_id",currentUser.id);
  const {data,error}=await q;
  if(error){console.error("Suporte: falha ao listar conversas",error.message);return false}
  supportThreads=data||[];
  const profileIds=[...new Set(supportThreads.map(t=>String(t.requester_id)))];
  if(profileIds.length){
    const result=await sb.from("profiles").select("id,full_name,role,avatar_url")
      .in("id",profileIds);
    if(!result.error)
      for(const p of result.data||[])supportPeople.set(String(p.id),p);
  }
  const reads=await sb.from("support_reads").select("thread_id,last_read_at")
    .eq("user_id",currentUser.id);
  if(!reads.error)supportReadTimes=new Map((reads.data||[]).map(x=>[String(x.thread_id),x.last_read_at]));
  if(!isSupportAgent())supportCurrentThread=supportThreads[0]?.id||supportCurrentThread;
  supportRenderThreads();
  supportUpdateBadge();
  return true;
}
function supportIsUnread(t){
  if(isSupportAgent()&&t.needs_human)return true;
  if(isSupportAgent()&&t.last_sender_is_ai)return false;
  return !!((t.last_sender_is_ai || t.last_sender_id) &&
    String(t.last_sender_id)!==String(currentUser?.id) &&
    (!supportReadTimes.get(String(t.id)) ||
      Date.parse(t.last_message_at)>Date.parse(supportReadTimes.get(String(t.id)))));
}
function supportUpdateBadge(){
  const unread=supportThreads.filter(supportIsUnread).length;
  const badge=supportEl("supportUnread");
  badge.textContent=unread>99?"99+":String(unread);
  badge.style.display=unread?"inline-flex":"none";
  supportEl("supportButton").classList.toggle("support-has-unread",unread>0);
}
function supportRenderThreads(){
  if(!isSupportAgent())return;
  const box=supportEl("supportThreadList");
  if(!supportThreads.length){
    box.innerHTML='<div class="support-empty">Nenhum pedido de suporte ainda.</div>';return;
  }
  box.innerHTML=supportThreads.map(t=>{
    const p=supportPeople.get(String(t.requester_id));
    const name=p?.full_name||"Usuário";
    const when=new Date(t.last_message_at).toLocaleString("pt-BR",{
      day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"
    });
    const selected=String(t.id)===String(supportCurrentThread);
    return '<button type="button" class="support-thread'+(selected?' selected':'')+
      '" data-support-thread="'+esc(t.id)+'" onclick="supportSelectThread(this.dataset.supportThread)">'+
      '<span class="support-thread-name">'+esc(name)+
      (supportIsUnread(t)?'<span class="support-dot"></span>':'')+
      (t.needs_human?'<span class="support-escalated">Precisa de você</span>':'')+'</span>'+
      '<span class="support-thread-info">'+esc(p?.role==="seller"?"Vendedor":p?.role==="manager"?"Gestor":"Usuário")+' • '+esc(when)+'</span></button>';
  }).join("");
}
async function supportEnsureThread(){
  if(isSupportAgent())return null;
  if(supportCurrentThread)return supportCurrentThread;
  const read=await sb.from("support_threads").select("id").eq("requester_id",currentUser.id).maybeSingle();
  if(read.error)throw read.error;
  if(read.data?.id){supportCurrentThread=read.data.id;return supportCurrentThread}
  const create=await sb.from("support_threads")
    .insert({requester_id:currentUser.id}).select("id").single();
  if(create.error){
    // Duas abas podem tentar abrir o primeiro atendimento ao mesmo tempo.
    const again=await sb.from("support_threads").select("id")
      .eq("requester_id",currentUser.id).maybeSingle();
    if(!again.error&&again.data?.id){supportCurrentThread=again.data.id;return supportCurrentThread}
    throw create.error;
  }
  supportCurrentThread=create.data.id;
  return supportCurrentThread;
}
async function openSupportChat(threadId=null){
  if(!canUseSupport())return;
  if(supportOpening)return;
  supportOpening=true;
  supportSetOpen(true);
  supportHideToast();
  supportStatus("");
  try{
    await supportRefreshThreads();
    if(isSupportAgent()){
      const allowed=threadId&&supportThreads.some(t=>String(t.id)===String(threadId));
      supportCurrentThread=allowed?String(threadId):
        (supportThreads.some(t=>String(t.id)===String(supportCurrentThread))
          ?supportCurrentThread:supportThreads[0]?.id||null);
    }else supportCurrentThread=supportThreads[0]?.id||null;
    supportRenderThreads();
    const ok=await supportLoadMessages();
    if(ok&&supportCurrentThread)await supportMarkRead();
    if(supportCurrentThread || !isSupportAgent())supportEl("supportInput").focus();
  }catch(e){supportStatus("Não foi possível abrir o atendimento: "+(e.message||"Tente novamente."))}
  finally{supportOpening=false}
}
async function supportSelectThread(threadId){
  if(!isSupportAgent()||!supportThreads.some(t=>String(t.id)===String(threadId)))return;
  supportCurrentThread=String(threadId);
  supportStatus("");
  supportRenderThreads();
  const ok=await supportLoadMessages();
  if(ok)await supportMarkRead();
}
async function supportLoadMessages(){
  const box=supportEl("supportMessages");
  if(!supportCurrentThread){
    box.innerHTML='<div class="support-empty">'+
      (isSupportAgent()?"Selecione um atendimento à esquerda.":"Envie sua mensagem para iniciar o atendimento.")+
      '</div>';
    supportEl("supportTitle").textContent=isSupportAgent()?"Central de suporte":"Conversa com o suporte";
    supportEl("supportCompose").hidden=isSupportAgent();
    return true;
  }
  supportEl("supportCompose").hidden=false;
  const chosen=supportThreads.find(t=>String(t.id)===String(supportCurrentThread));
  supportEl("supportTitle").textContent=isSupportAgent()
    ? (supportPeople.get(String(chosen?.requester_id))?.full_name||"Atendimento")
    : "Conversa com o suporte";
  const {data,error}=await sb.from("support_messages")
    .select("id,thread_id,sender_id,body,created_at,is_ai")
    .eq("thread_id",supportCurrentThread)
    .order("created_at",{ascending:false}).limit(150);
  if(error){
    box.innerHTML='<div class="support-empty">Não foi possível carregar as mensagens.</div>';
    supportStatus(error.message);
    return false;
  }
  const msgs=(data||[]).slice().reverse();
  if(!msgs.length){
    box.innerHTML='<div class="support-empty">Ainda não há mensagens neste atendimento.</div>';
    return true;
  }
  box.innerHTML=msgs.map(m=>{
    const mine=String(m.sender_id)===String(currentUser.id);
    const name=m.is_ai?"Assistente IA":supportDisplayName(m.sender_id);
    const when=new Date(m.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
    return '<div class="support-message'+(mine?' mine':'')+(m.is_ai?' support-ai-message':'')+'"><div class="support-message-name">'+esc(name)+'</div>'+
      '<div class="support-message-text">'+esc(m.body)+'</div><div class="support-message-date">'+esc(when)+'</div></div>';
  }).join("");
  box.scrollTop=box.scrollHeight;
  return true;
}
async function supportMarkRead(){
  if(!supportCurrentThread||!currentUser)return;
  const key=String(supportCurrentThread);
  const payload={last_read_at:new Date().toISOString()};
  const existing=supportReadTimes.has(key);
  let read=existing
    ? await sb.from("support_reads").update(payload).eq("thread_id",key)
        .eq("user_id",currentUser.id).select("last_read_at").single()
    : await sb.from("support_reads")
        .insert({thread_id:key,user_id:currentUser.id})
        .select("last_read_at").single();
  if(!existing && read.error?.code==="23505"){
    read=await sb.from("support_reads").update(payload).eq("thread_id",key)
      .eq("user_id",currentUser.id).select("last_read_at").single();
  }
  if(read.error){console.warn("Suporte: falha ao marcar leitura",read.error.message);return}
  supportReadTimes.set(key,read.data?.last_read_at||new Date().toISOString());
  supportRenderThreads();supportUpdateBadge();
}
async function sendSupportMessage(){
  if(!canUseSupport()||supportBusy)return;
  const input=supportEl("supportInput"),button=supportEl("supportSend");
  const body=input.value.trim();
  if(!body)return;
  if(body.length>2000){supportStatus("Máximo de 2.000 caracteres.");return}
  if(isSupportAgent()&&!supportCurrentThread){supportStatus("Selecione um atendimento primeiro.");return}
  supportBusy=true;button.disabled=true;supportStatus("");
  try{
    if(!isSupportAgent())await supportEnsureThread();
    const result=await sb.from("support_messages")
      .insert({thread_id:supportCurrentThread,body}).select("id").single();
    if(result.error)throw result.error;
    input.value="";
    // A chave da API nunca fica no navegador: apenas chama a funcao autenticada.
    // Nao deixar falhas de rede/API sem explicacao para o usuario.
    if(!isSupportAgent()&&result.data?.id){
      const messageId=result.data.id;
      const threadId=supportCurrentThread;
      const sameThread=()=>String(supportCurrentThread)===String(threadId)&&supportIsOpen();
      if(sameThread())supportStatus("Mensagem enviada. Assistente IA verificando sua dúvida...");
      sb.functions.invoke("support-ai",{body:{message_id:messageId}})
        .then(async({data,error})=>{
          if(error){
            console.warn("Suporte: chamada de IA indisponivel",error.message);
            if(sameThread())supportStatus("Sua mensagem foi enviada, mas a IA não conseguiu responder. O suporte humano poderá ajudar.");
            return;
          }
          if(sameThread()&&data?.ai_enabled===false){
            supportStatus("Sua mensagem foi enviada. A IA está temporariamente indisponível; aguarde o suporte humano.");
          }else if(sameThread()&&data?.human_support){
            supportStatus("A IA não conseguiu concluir sua resposta. O suporte humano continuará o atendimento.");
          }else if(sameThread()&&data?.skipped){
            supportStatus("Não foi possível iniciar uma resposta automática. O suporte humano continuará o atendimento.");
          }else if(sameThread()&&data?.ok){
            supportStatus(data.escalated?"Atendimento encaminhado para o suporte humano.":"Resposta da Assistente IA recebida.");
          }
          if(sameThread()&&data?.ok)await supportLoadMessages();
        })
        .catch(e=>{
          console.warn("Suporte: chamada de IA falhou",e?.message||"erro");
          if(sameThread())supportStatus("Sua mensagem foi enviada. A IA não respondeu; o suporte humano poderá ajudar.");
        });
    }
    await supportRefreshThreads();
    const loaded=await supportLoadMessages();
    if(loaded)await supportMarkRead();
    input.focus();
  }catch(e){
    supportStatus("Não foi possível enviar: "+(e.message||"Tente novamente."));
  }finally{supportBusy=false;button.disabled=false}
}
function closeSupportChat(){
  supportSetOpen(false);
}
async function stopTeamChat(){
  if(supportChannel){await sb.removeChannel(supportChannel);supportChannel=null}
  if(supportToastTimer)clearTimeout(supportToastTimer);
  supportToastTimer=null;supportToastThread=null;
  supportThreads=[];supportPeople.clear();supportReadTimes.clear();
  supportCurrentThread=null;supportBusy=false;supportOpening=false;
  supportSetOpen(false);supportHideToast();
  supportEl("supportButton").classList.remove("available","support-has-unread");
  supportEl("supportUnread").style.display="none";
  supportEl("supportThreadList").innerHTML="";
  supportEl("supportMessages").innerHTML="";
}
