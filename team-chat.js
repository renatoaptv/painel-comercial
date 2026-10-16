
/* Chat Comercial: sala de equipe exclusiva por loja, com regras no Supabase. */
let teamChatChannel=null;
let teamChatPeople=new Map();
let teamChatLastReadAt=null;
let teamChatBusy=false;

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
  teamChatLastReadAt=null;
  const {data,error}=await sb.from("team_chat_reads").select("last_read_at")
    .eq("user_id",currentUser.id).maybeSingle();
  if(!error)teamChatLastReadAt=data?.last_read_at||null;
  await refreshTeamChatUnread();
  if(teamChatChannel)await sb.removeChannel(teamChatChannel);
  teamChatChannel=sb.channel("team-chat-"+currentUser.store_id)
    .on("postgres_changes",{
      event:"INSERT",schema:"public",table:"team_chat_messages",
      filter:"store_id=eq."+currentUser.store_id
    },async()=>{
      if(teamChatOpen()){
        await loadTeamChatMessages();
        await markTeamChatRead();
      }else{
        await refreshTeamChatUnread();
      }
    })
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
  const box=document.getElementById("teamChatPeople");
  box.innerHTML=(data||[]).map(p=>'<div class="team-chat-person">'+
    '<img src="'+esc(p.avatar_url||fallback(p.full_name))+'" alt="">'+
    '<span title="'+esc(p.full_name)+'">'+esc(p.full_name)+'</span></div>').join("");
}
async function openTeamChat(){
  if(!isTeamChatMember())return;
  document.getElementById("teamChatModal").classList.add("show");
  teamChatFeedback("");
  await loadTeamChatPeople();
  await loadTeamChatMessages();
  await markTeamChatRead();
  document.getElementById("teamChatInput").focus();
}
function closeTeamChat(){document.getElementById("teamChatModal").classList.remove("show")}
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
    return '<div class="team-chat-row'+(mine?' mine':'')+'">'+
      '<img class="team-chat-avatar" src="'+esc(photo)+'" alt="">'+
      '<div class="team-chat-bubble"><div class="team-chat-who">'+esc(name)+'</div>'+
      '<div class="team-chat-body">'+esc(m.body)+'</div>'+
      '<div class="team-chat-when">'+esc(when)+'</div></div></div>';
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
}
async function sendTeamChatMessage(){
  if(!isTeamChatMember()||teamChatBusy)return;
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
    const loaded=await loadTeamChatMessages();
    if(loaded)await markTeamChatRead();
    field.focus();
  }catch(e){
    teamChatFeedback("Não foi possível enviar a mensagem: "+(e.message||"Tente novamente."));
  }finally{
    teamChatBusy=false;
    btn.disabled=false;
  }
}
async function stopTeamChat(){
  if(teamChatChannel){
    await sb.removeChannel(teamChatChannel);
    teamChatChannel=null;
  }
  teamChatPeople=new Map();
  teamChatLastReadAt=null;
  teamChatBusy=false;
  document.getElementById("teamChatModal").classList.remove("show");
  document.getElementById("teamChatButton").classList.remove("available");
  document.getElementById("teamChatUnread").style.display="none";
}
