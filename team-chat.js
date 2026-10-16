
/* Chat Comercial: sala de equipe exclusiva por loja, com regras no Supabase. */
let teamChatChannel=null;
let teamChatPeople=new Map();
let teamChatLastReadAt=null;
let teamChatBusy=false;
let teamChatTypingMap=new Map();
let teamChatTypingLastSent=0;
let teamChatTypingStopTimer=null;
let teamChatTypingExpiryTimer=null;
let teamChatPreviewTimer=null;
let teamChatPulseTimer=null;
let teamChatTypingQueue=Promise.resolve();
let teamChatVisibilityBound=false;
function isTeamChatMember(){
  return !!(currentUser && currentUser.organization_id && currentUser.store_id
    && ["seller","manager","network_admin","super_admin"].includes(currentUser.rawRole));
}
function teamChatOpen(){
  return document.getElementById("teamChatModal").classList.contains("show");
}
function teamChatFeedback(message){
  document.getElementById("teamChatStatus").textContent=message||"";
}
async function initTeamChat(){
  const btn=document.getElementById("teamChatButton");
  if(!isTeamChatMember()){btn.classList.remove("available");return}
  btn.classList.add("available");
  document.getElementById("teamChatModerationShortcut").classList.toggle("available",canModerateTeamChat());
  document.getElementById("teamChatFloat").classList.add("available");
  document.getElementById("teamChatFloat").classList.remove("chat-open");
  teamChatTypingMap.clear();
  teamChatLastReadAt=null;
  await loadTeamChatPeople();
  await loadTeamChatModerationState();
  await loadTeamChatTypingSnapshot();
  if(!teamChatVisibilityBound){
    document.addEventListener("visibilitychange",teamChatVisibilityChanged);
    teamChatVisibilityBound=true;
  }
  const {data,error}=await sb.from("team_chat_reads").select("last_read_at")
    .eq("user_id",currentUser.id).maybeSingle();
  if(!error)teamChatLastReadAt=data?.last_read_at||null;
  await refreshTeamChatUnread();
  if(teamChatChannel)await sb.removeChannel(teamChatChannel);
  teamChatChannel=sb.channel("team-chat-"+currentUser.store_id)
    .on("postgres_changes",{
      event:"INSERT",schema:"public",table:"team_chat_messages",
      filter:"store_id=eq."+currentUser.store_id
    },async(payload)=>{
      const row=payload.new||{};
      if(teamChatOpen()){
        const loaded=await loadTeamChatMessages();
        if(loaded)await markTeamChatRead();
      }else{
        await refreshTeamChatUnread();
        if(String(row.sender_id)!==String(currentUser?.id))
          teamChatIncomingMessage(row);
      }
    })
    .on("postgres_changes",{
      event:"INSERT",schema:"public",table:"team_chat_moderation_events",
      filter:"store_id=eq."+currentUser.store_id
    },payload=>onTeamChatModerationEvent(payload.new||{}))
    .on("postgres_changes",{
      event:"*",schema:"public",table:"team_chat_typing",
      filter:"store_id=eq."+currentUser.store_id
    },payload=>teamChatTypingEvent(payload.new||{}))
    .subscribe(status=>{
      if(teamChatOpen()&&status==="CHANNEL_ERROR")
        teamChatFeedback("Conexão instável. Reabra o chat para atualizar.");
    });
}
async function loadTeamChatPeople(){
  if(!isTeamChatMember())return;
  const {data,error}=await sb.from("profiles")
    .select("id,full_name,avatar_url,role")
    .eq("organization_id",currentUser.organization_id)
    .eq("store_id",currentUser.store_id)
    .eq("active",true)
    .in("role",["seller","manager","network_admin","super_admin"])
    .order("full_name");
  if(error){teamChatFeedback("Não foi possível atualizar a lista de participantes.");return}
  teamChatPeople=new Map((data||[]).map(p=>[String(p.id),p]));
}
async function openTeamChat(){
  if(!isTeamChatMember())return;
  document.getElementById("teamChatModal").classList.add("show");
  document.getElementById("teamChatFloat").classList.add("chat-open");
  teamChatHidePreview();
  document.getElementById("teamChatFloat").classList.remove("new-message");
  if(teamChatPulseTimer){clearTimeout(teamChatPulseTimer);teamChatPulseTimer=null}
  teamChatFeedback("");
  await loadTeamChatPeople();
  await loadTeamChatModerationState();
  // O gestor já encontra os vendedores e os bloqueios ao abrir o chat.
  if(canModerateTeamChat())document.getElementById("teamChatMemberPanel").hidden=false;
  const loaded=await loadTeamChatMessages();
  if(loaded)await markTeamChatRead();
  if(!teamChatBlocked)document.getElementById("teamChatInput").focus();
}
function minimizeTeamChat(){
  document.getElementById("teamChatModal").classList.remove("show");
  document.getElementById("teamChatFloat").classList.remove("chat-open");
  teamChatStopTyping();
}
function closeTeamChat(){minimizeTeamChat()}
async function loadTeamChatMessages(){
  if(!isTeamChatMember())return;
  const box=document.getElementById("teamChatMessages");
  const {data,error}=await sb.from("team_chat_messages")
    .select("id,sender_id,body,created_at").eq("store_id",currentUser.store_id)
    .order("created_at",{ascending:false}).limit(100);
  if(error){
    box.innerHTML='<div class="empty">Não foi possível carregar o chat. Feche e abra novamente.</div>';
    teamChatFeedback(error.message||"Falha de comunicação.");
    return false;
  }
  const messages=(data||[]).slice().reverse();
  if(!messages.length){
    box.innerHTML='<div class="empty">Comece a conversa! Envie a primeira mensagem da equipe.</div>';
    return true;
  }
  box.innerHTML=messages.map(m=>{
    const p=teamChatPeople.get(String(m.sender_id));
    const name=p?.full_name||(String(m.sender_id)===String(currentUser.id)?currentUser.nome:"Participante");
    const photo=p?.avatar_url||fallback(name);
    const mine=String(m.sender_id)===String(currentUser.id);
    const when=new Date(m.created_at).toLocaleString("pt-BR",{
      day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"
    });
    const isSellerMessage=canModerateTeamChat()&&p?.role==="seller";
    const deleteAction=isSellerMessage
      ? '<button type="button" class="team-chat-delete-action" data-team-chat-delete="'+esc(m.id)+'" onclick="deleteTeamChatMessage(this.dataset.teamChatDelete)" title="Excluir esta mensagem da conversa">🗑️ Excluir mensagem</button>'
      : '';
    const banned=!!teamChatBanMap.get(String(m.sender_id))?.active;
    const blockAction=isSellerMessage
      ? '<button type="button" class="team-chat-member-action'+(banned?' is-blocked':'')+'" data-team-chat-user="'+esc(m.sender_id)+'" onclick="toggleTeamChatMemberBlock(this.dataset.teamChatUser)">'+
        (banned?'Desbloquear vendedor':'🚫 Bloquear vendedor')+'</button>' : '';
    return '<div class="team-chat-row'+(mine?' mine':'')+'">'+
      '<img class="team-chat-avatar" src="'+esc(photo)+'" alt="">'+
      '<div class="team-chat-bubble"><div class="team-chat-who">'+esc(name)+'</div>'+
      '<div class="team-chat-body">'+esc(m.body)+'</div>'+
      '<div class="team-chat-message-footer"><div class="team-chat-when">'+esc(when)+'</div><div class="team-chat-message-actions">'+deleteAction+blockAction+'</div></div></div></div>';
  }).join("");
  box.scrollTop=box.scrollHeight;
  return true;
}
async function markTeamChatRead(){
  if(!isTeamChatMember())return;
  const ts=new Date().toISOString();
  const {error}=await sb.from("team_chat_reads").upsert({
    user_id:currentUser.id,organization_id:currentUser.organization_id,
    store_id:currentUser.store_id,last_read_at:ts
  },{onConflict:"user_id"});
  if(error){teamChatFeedback("As mensagens foram carregadas, mas o status de leitura não foi salvo.");return}
  teamChatLastReadAt=ts;
  await refreshTeamChatUnread();
}
async function refreshTeamChatUnread(){
  if(!isTeamChatMember())return;
  let q=sb.from("team_chat_messages").select("id",{count:"exact",head:true})
    .eq("store_id",currentUser.store_id).neq("sender_id",currentUser.id);
  if(teamChatLastReadAt)q=q.gt("created_at",teamChatLastReadAt);
  const {count,error}=await q;
  if(error)return;
  const badge=document.getElementById("teamChatUnread");
  badge.textContent=(count||0)>99?"99+":String(count||0);
  badge.style.display=count>0?"inline-flex":"none";
  const floatBadge=document.getElementById("teamChatFloatBadge");
  floatBadge.textContent=(count||0)>99?"99+":String(count||0);
  floatBadge.style.display=count>0?"inline-flex":"none";
  document.getElementById("teamChatFloat").classList.toggle("has-unread",count>0);
  teamChatRenderTyping();
}
async function sendTeamChatMessage(){
  if(!isTeamChatMember()||teamChatBusy||teamChatBlocked){
    if(teamChatBlocked)teamChatFeedback("Você está bloqueado para enviar mensagens no chat pela gestão.");
    return;
  }
  const field=document.getElementById("teamChatInput");
  const btn=document.getElementById("teamChatSend");
  const body=field.value.trim();
  if(!body)return;
  if(body.length>2000){teamChatFeedback("Máximo de 2.000 caracteres.");return}
  teamChatBusy=true;
  btn.disabled=true;
  teamChatFeedback("");
  try{
    const {error}=await sb.from("team_chat_messages").insert({body});
    if(error)throw error;
    field.value="";
    teamChatStopTyping();
    const loaded=await loadTeamChatMessages();
    if(loaded)await markTeamChatRead();
    field.focus();
  }catch(e){
    teamChatFeedback("Não foi possível enviar a mensagem: "+(e.message||"Tente novamente."));
  }finally{
    teamChatBusy=false;
    btn.disabled=teamChatBlocked;
  }
}

/* Balão minimizado, prévia de novas mensagens e indicador de digitação. */
function teamChatHidePreview(){
  document.getElementById("teamChatPeek").hidden=true;
  if(teamChatPreviewTimer){clearTimeout(teamChatPreviewTimer);teamChatPreviewTimer=null}
}
function teamChatIncomingMessage(row){
  if(!isTeamChatMember()||teamChatOpen())return;
  const sender=teamChatPeople.get(String(row.sender_id));
  document.getElementById("teamChatPeekName").textContent=sender?.full_name||"Alguém da equipe";
  document.getElementById("teamChatPeekText").textContent=String(row.body||"Nova mensagem").slice(0,100);
  document.getElementById("teamChatPeek").hidden=false;
  if(teamChatPreviewTimer)clearTimeout(teamChatPreviewTimer);
  teamChatPreviewTimer=setTimeout(teamChatHidePreview,7000);
  const f=document.getElementById("teamChatFloat");
  f.classList.add("new-message");
  if(teamChatPulseTimer)clearTimeout(teamChatPulseTimer);
  teamChatPulseTimer=setTimeout(()=>{
    f.classList.remove("new-message");
    teamChatPulseTimer=null;
  },7500);
}
async function loadTeamChatTypingSnapshot(){
  if(!isTeamChatMember())return;
  const since=new Date(Date.now()-6500).toISOString();
  const {data,error}=await sb.from("team_chat_typing")
    .select("user_id,updated_at,is_typing").eq("store_id",currentUser.store_id)
    .eq("is_typing",true).gte("updated_at",since);
  if(error){console.warn("Chat: indicador de digitação indisponível",error.message);return}
  for(const row of data||[])teamChatTypingEvent(row);
}
function teamChatTypingEvent(row){
  if(!row.user_id||!isTeamChatMember()||String(row.user_id)===String(currentUser.id))return;
  const until=Date.parse(row.updated_at)+6500;
  if(row.is_typing&&Number.isFinite(until)&&until>Date.now())
    teamChatTypingMap.set(String(row.user_id),until);
  else teamChatTypingMap.delete(String(row.user_id));
  teamChatRenderTyping();
}
function teamChatRenderTyping(){
  if(teamChatTypingExpiryTimer){clearTimeout(teamChatTypingExpiryTimer);teamChatTypingExpiryTimer=null}
  const now=Date.now();
  for(const [id,expiresAt] of teamChatTypingMap){
    if(expiresAt<=now)teamChatTypingMap.delete(id);
  }
  const ids=[...teamChatTypingMap.keys()];
  let label="";
  if(ids.length===1){
    const p=teamChatPeople.get(ids[0]);
    label=(p?.full_name||"Alguém")+" está digitando...";
  }else if(ids.length>1)label=ids.length+" pessoas estão digitando...";
  const bubble=document.getElementById("teamChatFloat");
  bubble.classList.toggle("typing",ids.length>0);
  document.getElementById("teamChatTypingStatus").textContent=label;
  const hint=document.getElementById("teamChatFloatHint");
  if(label)hint.textContent=label;
  else if(bubble.classList.contains("has-unread"))hint.textContent="Novas mensagens";
  else hint.textContent="Chat da equipe";
  if(ids.length){
    const next=Math.min(...teamChatTypingMap.values())-now;
    teamChatTypingExpiryTimer=setTimeout(teamChatRenderTyping,Math.max(100,next+30));
  }
}
function teamChatOnInput(){
  if(!isTeamChatMember()||!teamChatOpen()||teamChatBlocked)return;
  const field=document.getElementById("teamChatInput");
  const typing=field.value.trim().length>0;
  if(teamChatTypingStopTimer){clearTimeout(teamChatTypingStopTimer);teamChatTypingStopTimer=null}
  if(!typing){teamChatStopTyping();return}
  const now=Date.now();
  if(now-teamChatTypingLastSent>=2000)teamChatSendTyping(true);
  teamChatTypingStopTimer=setTimeout(teamChatStopTyping,3500);
}
function teamChatSendTyping(typing){
  if(!isTeamChatMember())return;
  teamChatTypingLastSent=typing?Date.now():0;
  const payload={
    user_id:currentUser.id,
    organization_id:currentUser.organization_id,
    store_id:currentUser.store_id,
    is_typing:!!typing
  };
  // Envia na ordem correta para não deixar "digitando" preso após parar.
  teamChatTypingQueue=teamChatTypingQueue.catch(()=>{}).then(async()=>{
    const {error}=await sb.from("team_chat_typing").upsert(payload,{onConflict:"user_id"});
    if(error)console.warn("Chat: digitação não sincronizada",error.message);
  });
}
function teamChatStopTyping(){
  if(teamChatTypingStopTimer){clearTimeout(teamChatTypingStopTimer);teamChatTypingStopTimer=null}
  if(teamChatTypingLastSent)teamChatSendTyping(false);
}
function teamChatVisibilityChanged(){
  if(document.hidden){teamChatStopTyping();return}
  if(isTeamChatMember())refreshTeamChatUnread();
}


async function stopTeamChat(){
  teamChatStopTyping();
  if(teamChatVisibilityBound){
    document.removeEventListener("visibilitychange",teamChatVisibilityChanged);
    teamChatVisibilityBound=false;
  }
  if(teamChatTypingExpiryTimer)clearTimeout(teamChatTypingExpiryTimer);
  if(teamChatPreviewTimer)clearTimeout(teamChatPreviewTimer);
  if(teamChatPulseTimer)clearTimeout(teamChatPulseTimer);
  teamChatTypingMap.clear();
  teamChatTypingLastSent=0;
  resetTeamChatModeration();
  teamChatHidePreview();
  if(teamChatChannel){
    await sb.removeChannel(teamChatChannel);
    teamChatChannel=null;
  }
  teamChatPeople=new Map();
  teamChatLastReadAt=null;
  teamChatBusy=false;
  document.getElementById("teamChatModal").classList.remove("show");
  document.getElementById("teamChatButton").classList.remove("available");
  document.getElementById("teamChatModerationShortcut").classList.remove("available");
  document.getElementById("teamChatUnread").style.display="none";
  document.getElementById("teamChatFloat").classList.remove("available","chat-open","new-message","typing","has-unread");
  document.getElementById("teamChatFloatBadge").style.display="none";
  document.getElementById("teamChatFloatHint").textContent="Chat da equipe";
  document.getElementById("teamChatTypingStatus").textContent="";
}
