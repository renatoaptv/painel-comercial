/* Painel Comercial — moderação restrita ao gestor de loja. */
let teamChatBlocked=false;
let teamChatBanMap=new Map();
let teamChatModerationBusy=false;
let teamChatModerationMode=false;

// O perfil pode moderar, mas os controles so aparecem quando o botao
// "Moderar chat" e usado. O chat comum e sempre aberto no modo limpo.
function teamChatIsModerationMode(){
  return teamChatModerationMode && canModerateTeamChat();
}
function setTeamChatModerationMode(enabled){
  teamChatModerationMode=!!enabled && canModerateTeamChat();
  const tools=document.getElementById("teamChatMemberTools");
  const panel=document.getElementById("teamChatMemberPanel");
  tools.hidden=!teamChatModerationMode;
  if(!teamChatModerationMode)panel.hidden=true;
  document.getElementById("teamChatModal").classList.toggle("chat-moderation-active",teamChatModerationMode);
}

function canModerateTeamChat(){
  return !!(isTeamChatMember() && ["manager","super_admin"].includes(currentUser.rawRole));
}
async function loadTeamChatModerationState(){
  if(!isTeamChatMember())return false;
  let q=sb.from("team_chat_bans")
    .select("user_id,active,changed_at,changed_by")
    .eq("store_id",currentUser.store_id);
  if(!canModerateTeamChat())q=q.eq("user_id",currentUser.id);
  const {data,error}=await q;
  if(error){
    console.error("Chat: falha ao carregar bloqueios",error.message);
    teamChatFeedback("Falha ao conferir permissões do chat.");
    // Falha segura para o vendedor: não libera composição se bloqueios não puderem ser verificados.
    if(currentUser.rawRole==="seller")teamChatBlocked=true;
    renderTeamChatModerationState();
    return false;
  }
  teamChatBanMap=new Map((data||[]).map(b=>[String(b.user_id),b]));
  teamChatBlocked=!!teamChatBanMap.get(String(currentUser.id))?.active;
  renderTeamChatModerationState();
  return true;
}
function renderTeamChatModerationState(){
  const locked=teamChatBlocked;
  const input=document.getElementById("teamChatInput");
  const button=document.getElementById("teamChatSend");
  input.disabled=locked;
  button.disabled=locked || teamChatBusy;
  input.placeholder=locked?"Envio de mensagens bloqueado pelo gestor":"Escreva para a equipe...";
  const banner=document.getElementById("teamChatBlockedBanner");
  banner.hidden=!locked;
  if(locked){
    teamChatStopTyping();
    input.value="";
  }
  document.getElementById("teamChatMemberTools").hidden=!teamChatIsModerationMode();
  if(!teamChatIsModerationMode())document.getElementById("teamChatMemberPanel").hidden=true;
  renderTeamChatModerationMembers();
}
async function openTeamChatModeration(){
  if(!canModerateTeamChat())return;
  await openTeamChat(true);
  if(teamChatIsModerationMode())
    document.getElementById("teamChatMemberPanel").scrollIntoView({block:"nearest",behavior:"smooth"});
}
function toggleTeamChatMemberPanel(){
  if(!teamChatIsModerationMode())return;
  const panel=document.getElementById("teamChatMemberPanel");
  panel.hidden=!panel.hidden;
  if(!panel.hidden)renderTeamChatModerationMembers();
}
function renderTeamChatModerationMembers(){
  const box=document.getElementById("teamChatMemberList");
  if(!box)return;
  if(!canModerateTeamChat()){box.textContent="";return}
  const sellers=[...teamChatPeople.values()].filter(p=>p.role==="seller")
    .sort((a,b)=>a.full_name.localeCompare(b.full_name,"pt-BR"));
  if(!sellers.length){
    box.innerHTML='<div class="empty">Nenhum vendedor ativo cadastrado nesta loja.</div>';
    return;
  }
  box.innerHTML=sellers.map(p=>{
    const blocked=!!teamChatBanMap.get(String(p.id))?.active;
    return '<div class="team-chat-member-row">'+
      '<img class="team-chat-member-avatar" src="'+esc(p.avatar_url||fallback(p.full_name))+'" alt="">'+
      '<div class="team-chat-member-name">'+esc(p.full_name)+
      '<small class="'+(blocked?'team-chat-member-blocked':'team-chat-member-allowed')+'">'+
      (blocked?'Envio bloqueado':'Pode enviar mensagens')+'</small></div>'+
      '<button type="button" class="team-chat-member-action'+(blocked?' is-blocked':'')+
      '" data-team-chat-user="'+esc(p.id)+'" onclick="toggleTeamChatMemberBlock(this.dataset.teamChatUser)"'+
      (teamChatModerationBusy?' disabled':'')+'>'+
      (blocked?'Desbloquear':'Bloquear')+'</button></div>';
  }).join("");
}
async function toggleTeamChatMemberBlock(userId){
  if(!teamChatIsModerationMode()||teamChatModerationBusy)return;
  const target=teamChatPeople.get(String(userId));
  if(!target||target.role!=="seller")return;
  const current=teamChatBanMap.get(String(userId));
  const shouldBlock=!current?.active;
  const name=target.full_name;
  const question=shouldBlock
    ? "Bloquear "+name+" de enviar mensagens no chat da loja? Ele continuará usando o Painel Comercial e vendo a conversa."
    : "Desbloquear "+name+" e permitir que volte a enviar mensagens no chat?";
  if(!confirm(question))return;
  teamChatModerationBusy=true;renderTeamChatModerationMembers();teamChatFeedback("");
  try{
    let result;
    if(current){
      result=await sb.from("team_chat_bans")
        .update({active:shouldBlock})
        .eq("user_id",userId).eq("store_id",currentUser.store_id)
        .select("user_id");
    }else{
      result=await sb.from("team_chat_bans")
        .insert({user_id:userId,store_id:currentUser.store_id,active:true})
        .select("user_id");
    }
    if(result.error)throw result.error;
    if(!result.data?.length)throw new Error("A ação não foi permitida pelo banco de dados.");
    await loadTeamChatModerationState();
    teamChatFeedback(shouldBlock
      ? name+" não poderá enviar mensagens até ser desbloqueado."
      : name+" já pode voltar a enviar mensagens.");
  }catch(e){
    teamChatFeedback("Não foi possível atualizar o bloqueio: "+(e.message||"Tente novamente."));
    await loadTeamChatModerationState();
  }finally{teamChatModerationBusy=false;renderTeamChatModerationMembers()}
}
async function deleteTeamChatMessage(messageId){
  if(!teamChatIsModerationMode()||teamChatModerationBusy)return;
  if(!/^[0-9a-f-]{36}$/i.test(String(messageId)))return;
  if(!confirm("Excluir definitivamente esta mensagem do vendedor para toda a equipe? O conteúdo será removido do chat, mas a ação ficará registrada na auditoria."))return;
  teamChatModerationBusy=true;teamChatFeedback("");
  try{
    const {data,error}=await sb.from("team_chat_messages")
      .delete().eq("id",messageId).eq("store_id",currentUser.store_id).select("id");
    if(error)throw error;
    if(!data?.length)throw new Error("Mensagem não encontrada ou sem permissão para excluir.");
    await loadTeamChatMessages();
    teamChatFeedback("Mensagem excluída do chat. A ação foi registrada.");
  }catch(e){
    teamChatFeedback("Não foi possível excluir a mensagem: "+(e.message||"Tente novamente."));
  }finally{teamChatModerationBusy=false}
}
async function onTeamChatModerationEvent(row){
  if(!isTeamChatMember()||row.store_id!==currentUser.store_id)return;
  if(row.event_type==="message_deleted"){
    if(teamChatOpen())await loadTeamChatMessages();
    // Contador reflete exclusões mesmo com chat minimizado.
    await refreshTeamChatUnread();
    if(document.getElementById("teamChatPeek").hidden===false)
      teamChatHidePreview();
  }else if(row.event_type==="member_blocked"||row.event_type==="member_unblocked"){
    await loadTeamChatModerationState();
  }
}
function resetTeamChatModeration(){
  teamChatModerationMode=false;
  document.getElementById("teamChatModal").classList.remove("chat-moderation-active");
  teamChatBlocked=false;
  teamChatBanMap.clear();
  teamChatModerationBusy=false;
  document.getElementById("teamChatBlockedBanner").hidden=true;
  document.getElementById("teamChatMemberTools").hidden=true;
  document.getElementById("teamChatMemberPanel").hidden=true;
  document.getElementById("teamChatInput").disabled=false;
  document.getElementById("teamChatSend").disabled=false;
}
