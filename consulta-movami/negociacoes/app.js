/* Movami Comercial Pro — módulo independente /consulta-movami/negociacoes/
 * Chave publicável Supabase; nunca incluir service_role neste arquivo.
 */
"use strict";
const SUPA_URL="https://tlzshlerpspgpjaqskdg.supabase.co";
const SUPA_PUBLIC_KEY="sb_publishable_LQRp4_juiOoAobJmNqU1rQ_YCt84lEQ";
const TABLE_CLIENTES="movami_crm_clientes";
const TABLE_NOTAS="movami_crm_notas_rapidas";
const TABLE_INTERACOES="movami_crm_interacoes";
const STAGES=[
 ["prospectar","A prospectar"],
 ["conversamos","Já conversamos"],
 ["aguardando_resposta","Aguardando resposta"],
 ["proposta_enviada","Proposta enviada"],
 ["negociando","Negociando"],
 ["visita_agendada","Visita agendada"],
 ["fechado","Fechado"],
 ["perdido","Perdido"]
];
const LABELS=Object.fromEntries(STAGES);
const state={user:null,clientes:[],notas:[],view:"inicio",layout:"lista",search:"",stage:"todos",detailId:null,authMode:"login",fetching:false};
const $=id=>document.getElementById(id);
const esc=v=>String(v===null||v===undefined?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formatDate=v=>v?new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v)):"—";
const formatShort=v=>v?new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(v)):"Sem data";
const money=n=>n===null||n===undefined||n===""?"—":new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n));
const initials=v=>String(v||"?").trim().slice(0,2).toUpperCase();
const stageBadge=s=>'<span class="stage '+esc(s)+'">'+esc(LABELS[s]||s)+'</span>';
const empty=(title,body)=>'<div class="empty"><strong>'+esc(title)+'</strong>'+esc(body)+'</div>';
const phone=v=>String(v||"").replace(/[^0-9]/g,"");
const clientById=id=>state.clientes.find(c=>c.id===id);
const todayEnd=()=>{const d=new Date();d.setHours(23,59,59,999);return d};
const isOverdue=c=>c.retorno_em&&new Date(c.retorno_em)<new Date()&&!["fechado","perdido"].includes(c.etapa);
const isToday=c=>c.retorno_em&&new Date(c.retorno_em)<=todayEnd()&&!["fechado","perdido"].includes(c.etapa);
const authMessage=t=>{$("auth-message").textContent=t};
let toastTimer;
function toast(message,isError=false){
 const box=$("toast");box.textContent=message;box.classList.toggle("error",isError);box.classList.remove("hidden");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.add("hidden"),4500);
}
function syncLabel(txt,bad=false){$("sync-state").textContent=(bad?"● ":"● ")+txt;$("sync-state").classList.toggle("offline",bad)}
let db;
if(window.supabase&&window.supabase.createClient){
 db=window.supabase.createClient(SUPA_URL,SUPA_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}else{
 authMessage("Não foi possível carregar a conexão segura. Verifique sua internet e recarregue a página.");
 $("auth-submit").disabled=true;
}
async function startup(){
 if(!db)return;
 db.auth.onAuthStateChange((event,session)=>{
  if(event==="SIGNED_OUT"||!session){leave();return}
  if((event==="SIGNED_IN"||event==="INITIAL_SESSION"||event==="TOKEN_REFRESHED")&&session.user){
   if(!state.user||state.user.id!==session.user.id) setTimeout(()=>enter(session.user),0);
  }
 });
 const {data,error}=await db.auth.getSession();
 if(error){authMessage("Sua sessão não pôde ser verificada: "+error.message);return}
 if(data.session&&data.session.user)await enter(data.session.user);
}
async function enter(user){
 if(state.user&&state.user.id===user.id)return;
 state.user=user;
 $("auth-view").classList.add("hidden");
 $("workspace").classList.remove("hidden");
 $("account-name").textContent=user.email||"Minha conta";
 $("today-label").textContent=new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"2-digit",month:"long"}).format(new Date());
 setView("inicio");await loadAll();
}
function leave(){
 state.user=null;state.clientes=[];state.notas=[];state.detailId=null;
 $("workspace").classList.add("hidden");$("auth-view").classList.remove("hidden");
 $("client-dialog").close?.();$("detail-dialog").close?.();
 $("float-panel").classList.add("hidden");$("float-bubble").classList.add("hidden");
}
$("auth-mode").addEventListener("click",()=>{
 state.authMode=state.authMode==="login"?"signup":"login";
 $("auth-submit").textContent=state.authMode==="login"?"Entrar no meu painel":"Criar minha conta";
 $("auth-mode").textContent=state.authMode==="login"?"Criar conta de acesso":"Já tenho conta: entrar";
 authMessage("");
});
$("auth-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!db)return;
 const btn=$("auth-submit");btn.disabled=true;
 const email=$("auth-email").value.trim(),password=$("auth-password").value;
 try{
  const result=state.authMode==="signup"?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  if(state.authMode==="signup"&&!result.data.session){authMessage("Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre no painel.");state.authMode="login";$("auth-submit").textContent="Entrar no meu painel";$("auth-mode").textContent="Criar conta de acesso";}
  else if(result.data.user)await enter(result.data.user);
 }catch(err){authMessage("Não foi possível acessar: "+(err.message||"verifique seus dados"))}
 finally{btn.disabled=false}
});
$("logout").addEventListener("click",async()=>{if(db){const {error}=await db.auth.signOut();if(error)toast(error.message,true);else leave()}});
async function loadAll(){
 if(!state.user||state.fetching)return;
 state.fetching=true;syncLabel("Carregando...");
 try{
  const [a,b]=await Promise.all([
   db.from(TABLE_CLIENTES).select("*").eq("usuario_id",state.user.id).order("atualizado_em",{ascending:false}).limit(1000),
   db.from(TABLE_NOTAS).select("*").eq("usuario_id",state.user.id).order("criado_em",{ascending:false}).limit(1000)
  ]);
  if(a.error)throw a.error;if(b.error)throw b.error;
  state.clientes=a.data||[];state.notas=b.data||[];
  syncLabel("Sincronizado");render();populateFloatSelect();
 }catch(err){syncLabel("Falha de sincronização",true);toast("Erro ao carregar dados: "+err.message,true)}
 finally{state.fetching=false}
}
const PAGE={
 inicio:["PAINEL DE ACOMPANHAMENTO","Visão geral","Prioridades, conversas e oportunidades em um só lugar.","VISÃO GERAL"],
 negociacoes:["CARTEIRA DE OPORTUNIDADES","Negociações","Todas as empresas e contatos comerciais.","NEGOCIAÇÕES"],
 retornos:["SUA ROTINA COMERCIAL","Retornos e visitas","O que precisa ser feito e quando.","RETORNOS E VISITAS"],
 notas:["IDEIAS E LEMBRETES","Notas rápidas","Anotações salvas na nuvem, vinculadas ou não a clientes.","NOTAS RÁPIDAS"]
};
function setView(view){
 state.view=view;const p=PAGE[view]||PAGE.inicio;
 $("page-kicker").textContent=p[0];$("page-title").innerHTML=esc(p[1])+'<span class="yellow-dot">.</span>';
 $("page-description").textContent=p[2];$("section-breadcrumb").textContent=p[3];
 for(const v of Object.keys(PAGE))$(v+"-view").classList.toggle("hidden",v!==view);
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 document.querySelector(".sidebar").classList.remove("open");render();
}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
document.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.jump)));
$("mobile-menu").addEventListener("click",()=>document.querySelector(".sidebar").classList.toggle("open"));
function render(){if(!state.user)return;renderDashboard();renderNegotiations();renderSchedule();renderNotes()}
function renderDashboard(){
 const live=state.clientes.filter(c=>!["fechado","perdido"].includes(c.etapa));
 const due=live.filter(isToday).length,waiting=live.filter(c=>["aguardando_resposta","proposta_enviada"].includes(c.etapa)).length;
 const values=[
  ["Empresas cadastradas",state.clientes.length,"No seu acompanhamento","▦"],
  ["Precisam de retorno",due,"Até o fim de hoje","◷"],
  ["Aguardando / propostas",waiting,"Clientes em acompanhamento","↗"],
  ["Negócios fechados",state.clientes.filter(c=>c.etapa==="fechado").length,"Oportunidades conquistadas","✓"]
 ];
 $("stats").innerHTML=values.map((x,i)=>'<article class="stat '+(i===1?"highlight":"")+'"><div class="stat-top"><span>'+esc(x[0])+'</span><span class="stat-icon">'+x[3]+'</span></div><strong>'+x[1]+'</strong><small>'+esc(x[2])+'</small></article>').join("");
 const attention=live.filter(c=>isToday(c)||c.etapa==="aguardando_resposta").sort((a,b)=>{
  const da=a.retorno_em?new Date(a.retorno_em).getTime():Infinity,dbv=b.retorno_em?new Date(b.retorno_em).getTime():Infinity;return da-dbv;
 }).slice(0,6);
 $("priority-list").innerHTML=attention.length?attention.map(c=>{
  const overdue=isOverdue(c);
  return '<div class="attention"><div class="initial">'+esc(initials(c.empresa))+'</div><div class="info"><b>'+esc(c.empresa)+'</b><small>'+esc(c.proxima_acao||LABELS[c.etapa]||"Sem próxima ação")+'</small></div><span class="due '+(!overdue?"today":"")+'">'+esc(c.retorno_em?overdue?"Atrasado":"Hoje":"Sem data")+'</span><button type="button" class="small-icon-btn" data-client="'+esc(c.id)+'" aria-label="Abrir cliente">↗</button></div>';
 }).join(""):empty("Tudo em ordem por enquanto","Cadastre a próxima ação e a data de retorno dos seus clientes.");
 const topStages=["prospectar","conversamos","proposta_enviada","aguardando_resposta","negociando","visita_agendada","fechado"];
 $("pipeline-summary").innerHTML=topStages.map((s,i)=>{
  const n=state.clientes.filter(c=>c.etapa===s).length;
  return '<div class="pipeline-line"><div class="line-label"><span>'+esc(LABELS[s])+'</span><b>'+n+'</b></div><div class="progress '+(s==="fechado"?"green":i<2?"gray":"")+'"><span style="width:'+ (state.clientes.length?Math.round(n/state.clientes.length*100):0)+'%"></span></div></div>';
 }).join("");
 $("recent-list").innerHTML=tableMarkup([...state.clientes].sort((a,b)=>new Date(b.atualizado_em)-new Date(a.atualizado_em)).slice(0,7));
}
function tableMarkup(items){
 if(!items.length)return empty("Nenhuma empresa encontrada","Cadastre um cliente para começar a acompanhar a negociação.");
 return '<table class="data-table"><thead><tr><th>Empresa</th><th>Etapa</th><th>Próxima ação</th><th>Retorno</th><th>Prioridade</th><th></th></tr></thead><tbody>'+items.map(c=>
 '<tr data-client="'+esc(c.id)+'"><td><div class="company-cell"><span class="mini-avatar">'+esc(initials(c.empresa))+'</span><div><b>'+esc(c.empresa)+'</b><small>'+esc(c.contato||c.cnpj||"Sem contato")+'</small></div></div></td><td>'+stageBadge(c.etapa)+'</td><td>'+esc(c.proxima_acao||"—")+'</td><td>'+esc(formatShort(c.retorno_em))+'</td><td>'+esc(c.prioridade==="alta"?"● Alta":c.prioridade==="baixa"?"Baixa":"Normal")+'</td><td>↗</td></tr>').join("")+'</tbody></table>';
}
function filteredClients(){
 const q=state.search.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 return state.clientes.filter(c=>{
  if(state.stage!=="todos"&&c.etapa!==state.stage)return false;
  const needle=[c.empresa,c.cnpj,c.contato,c.telefone,c.cidade,c.veiculo,c.segmento].join(" ").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  return needle.includes(q);
 }).sort((a,b)=>{
  if(a.prioridade==="alta"&&b.prioridade!=="alta")return -1;
  if(b.prioridade==="alta"&&a.prioridade!=="alta")return 1;
  return new Date(b.atualizado_em)-new Date(a.atualizado_em);
 });
}
function renderNegotiations(){
 const clients=filteredClients();
 $("table-mode").classList.toggle("selected",state.layout==="lista");$("board-mode").classList.toggle("selected",state.layout==="quadro");
 if(state.layout==="lista"){$("negotiations-content").innerHTML='<div class="surface"><div class="section-heading"><h2>'+clients.length+' empresa(s)</h2><span class="tiny muted">Clique para abrir o histórico</span></div><div class="table-wrap">'+tableMarkup(clients)+'</div></div>';return}
 $("negotiations-content").innerHTML='<div class="board">'+STAGES.map(([id,label])=>{
  const group=clients.filter(c=>c.etapa===id);
  return '<section class="board-column"><div class="board-title">'+esc(label)+'<span>'+group.length+'</span></div>'+group.map(c=>
   '<div class="board-card" tabindex="0" role="button" data-client="'+esc(c.id)+'"><b>'+esc(c.empresa)+'</b><small>'+esc(c.contato||c.cidade||"Sem contato")+'</small><small>'+esc(c.proxima_acao||"Sem ação agendada")+'</small><div class="tag">'+(c.prioridade==="alta"?'<span class="stage aguardando_resposta">Alta prioridade</span>':'')+'</div></div>').join("")+'</section>';
 }).join("")+'</div>';
}
$("search").addEventListener("input",e=>{state.search=e.target.value;renderNegotiations()});
$("stage-filter").addEventListener("change",e=>{state.stage=e.target.value;renderNegotiations()});
$("table-mode").addEventListener("click",()=>{state.layout="lista";renderNegotiations()});
$("board-mode").addEventListener("click",()=>{state.layout="quadro";renderNegotiations()});
function renderSchedule(){
 const clients=state.clientes.filter(c=>c.retorno_em&&!["fechado","perdido"].includes(c.etapa)).sort((a,b)=>new Date(a.retorno_em)-new Date(b.retorno_em));
 const groups=[["Atrasados",clients.filter(c=>new Date(c.retorno_em)<new Date())],["Hoje",clients.filter(c=>new Date(c.retorno_em)>=new Date()&&new Date(c.retorno_em)<=todayEnd())],["Próximos retornos e visitas",clients.filter(c=>new Date(c.retorno_em)>todayEnd())]];
 $("schedule-list").innerHTML=clients.length?groups.filter(g=>g[1].length).map(([title,rows])=>'<div class="schedule-group"><h3>'+title+' ('+rows.length+')</h3>'+rows.map(c=>
 '<div class="schedule-row"><div class="time">'+esc(formatShort(c.retorno_em))+'</div><div class="schedule-info"><b>'+esc(c.empresa)+'</b><p>'+esc(c.proxima_acao||LABELS[c.etapa])+'</p></div>'+stageBadge(c.etapa)+'<button class="small-icon-btn" type="button" data-client="'+esc(c.id)+'">Abrir ↗</button></div>').join("")+'</div>').join(""):empty("Sem visitas ou retornos","Defina o próximo contato na ficha de cada empresa.");
}
function renderNotes(){
 $("all-notes").innerHTML=state.notas.length?'<div class="note-grid">'+state.notas.map(n=>{
  const c=clientById(n.cliente_id);
  return '<article class="note-card '+(n.concluida?"done":"")+'"><div><small>'+esc(formatDate(n.criado_em))+(c?" • "+esc(c.empresa):"")+'</small><p>'+esc(n.texto)+'</p></div><div class="note-actions"><button type="button" data-note-toggle="'+esc(n.id)+'">'+(n.concluida?"↶ Reabrir":"✓ Concluir")+'</button><button type="button" data-note-delete="'+esc(n.id)+'">Excluir ×</button></div></article>';
 }).join("")+'</div>':empty("Bloco de notas vazio","Use a nota flutuante para registrar ideias, pendências e detalhes das conversas.");
}
document.addEventListener("click",e=>{
 const client=e.target.closest("[data-client]");
 if(client){openDetails(client.dataset.client);return}
 const noteToggle=e.target.closest("[data-note-toggle]");
 if(noteToggle){toggleNote(noteToggle.dataset.noteToggle);return}
 const noteDelete=e.target.closest("[data-note-delete]");
 if(noteDelete){deleteNote(noteDelete.dataset.noteDelete);return}
 if(e.target.closest("[data-quick]"))showFloat();
 const closing=e.target.closest("[data-close]");if(closing)$(closing.dataset.close).close();
});
document.addEventListener("keydown",e=>{
 if(e.key==="Enter"&&e.target.matches(".board-card[data-client]"))openDetails(e.target.dataset.client);
});
function clearClientForm(){
 $("client-form").reset();$("client-id").value="";$("client-dialog-title").textContent="Novo cliente";
}
function openClientForm(id){
 clearClientForm();
 if(id){const c=clientById(id);if(!c)return;
  $("client-dialog-title").textContent="Editar cliente";$("client-id").value=c.id;
  const fields={empresa:c.empresa,cnpj:c.cnpj,contato:c.contato,telefone:c.telefone,email:c.email,cidade:c.cidade,segmento:c.segmento,veiculo:c.veiculo,quantidade:c.quantidade_veiculos,km:c.km_mes,valor:c.valor_proposta,etapa:c.etapa,prioridade:c.prioridade,acao:c.proxima_acao,notas:c.notas};
  for(const [name,value] of Object.entries(fields))$("f-"+name).value=value===null||value===undefined?"":value;
  if(c.retorno_em){const d=new Date(c.retorno_em);const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);$("f-retorno").value=local.toISOString().slice(0,16)}
 }
 $("client-dialog").showModal();
}
$("new-client").addEventListener("click",()=>openClientForm());
$("client-form").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!state.user)return;
 const id=$("client-id").value;
 const rawCnpj=$("f-cnpj").value.toUpperCase().replace(/[^0-9A-Z]/g,"");
 if(rawCnpj&&!/^[0-9A-Z]{12}[0-9]{2}$/.test(rawCnpj)){toast("CNPJ inválido: use 14 caracteres, com dois dígitos finais.",true);return}
 const retorno=$("f-retorno").value;const parsed=retorno?new Date(retorno):null;
 if(parsed&&isNaN(parsed.getTime())){toast("Data de retorno inválida.",true);return}
 const optionalNumber=v=>v===""?null:Number(v);
 const payload={
  empresa:$("f-empresa").value.trim(),cnpj:rawCnpj||null,contato:$("f-contato").value.trim()||null,
  telefone:$("f-telefone").value.trim()||null,email:$("f-email").value.trim()||null,
  cidade:$("f-cidade").value.trim()||null,segmento:$("f-segmento").value.trim()||null,
  veiculo:$("f-veiculo").value.trim()||null,quantidade_veiculos:optionalNumber($("f-quantidade").value),
  km_mes:optionalNumber($("f-km").value),valor_proposta:optionalNumber($("f-valor").value),
  etapa:$("f-etapa").value,prioridade:$("f-prioridade").value,
  proxima_acao:$("f-acao").value.trim()||null,
  retorno_em:parsed?parsed.toISOString():null,notas:$("f-notas").value.trim()||null,
  atualizado_em:new Date().toISOString()
 };
 if(payload.empresa.length<2){toast("Informe o nome da empresa.",true);return}
 const btn=$("save-client");btn.disabled=true;syncLabel("Salvando...");
 try{
  const q=id?db.from(TABLE_CLIENTES).update(payload).eq("id",id).eq("usuario_id",state.user.id):db.from(TABLE_CLIENTES).insert({...payload,usuario_id:state.user.id});
  const {data,error}=await q.select("id").single();
  if(error)throw error;
  $("client-dialog").close();await loadAll();
  toast(id?"Cliente atualizado.":"Cliente cadastrado.");
  if(data?.id&&!id)openDetails(data.id);
 }catch(err){syncLabel("Falha ao salvar",true);
  toast(err.code==="23505"?"Já existe um cliente cadastrado com este CNPJ.":"Falha ao salvar cliente: "+err.message,true);
 }finally{btn.disabled=false}
});
async function openDetails(id){
 const c=clientById(id);if(!c)return;
 state.detailId=id;
 $("detail-title").textContent=c.empresa;
 const meta=[
 ["CNPJ",c.cnpj||"Não informado"],["Contato",c.contato||"Não informado"],["Telefone",c.telefone||"Não informado"],["Cidade",c.cidade||"Não informada"],
 ["Segmento",c.segmento||"—"],["Veículo",c.veiculo||"—"],["Quantidade / km",String(c.quantidade_veiculos??"—")+" carro(s) • "+String(c.km_mes??"—")+" km/mês"],
 ["Valor mensal",money(c.valor_proposta)],["Etapa",LABELS[c.etapa]||c.etapa],["Prioridade",c.prioridade],["Próxima ação",c.proxima_acao||"Não definida"],["Retornar em",formatDate(c.retorno_em)]
 ];
 let contacts="";
 const digits=phone(c.telefone);
 if(digits.length>=10){const number=digits.startsWith("55")?digits:"55"+digits;contacts='<a class="btn outline" href="https://wa.me/'+number+'" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>'}
 const linked=state.notas.filter(n=>n.cliente_id===id);
 $("detail-content").innerHTML='<div class="detail-meta">'+meta.map(([k,v])=>'<div><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join("")+'</div>'+
 '<p style="font-size:12px;white-space:pre-wrap;line-height:1.65;color:#5c655a">'+esc(c.notas||"")+'</p>'+contacts+
 (linked.length?'<h3 style="font-size:13px;margin-top:22px">Notas rápidas deste cliente</h3>'+linked.map(n=>'<div class="activity"><small>'+esc(formatDate(n.criado_em))+'</small><p>'+esc(n.texto)+'</p></div>').join(""):"");
 $("activity-text").value="";$("activity-list").innerHTML=empty("Carregando histórico","Buscando as conversas registradas...");
 $("detail-dialog").showModal();
 await loadActivities(id);
}
async function loadActivities(id){
 const {data,error}=await db.from(TABLE_INTERACOES).select("*").eq("usuario_id",state.user.id).eq("cliente_id",id).order("criado_em",{ascending:false}).limit(100);
 if(state.detailId!==id)return;
 if(error){$("activity-list").innerHTML=empty("Erro ao carregar histórico",error.message);return}
 $("activity-list").innerHTML=data.length?data.map(r=>'<div class="activity"><b>'+esc(({anotacao:"Anotação",ligacao:"Ligação",whatsapp:"WhatsApp",email:"E-mail",visita:"Visita",proposta:"Proposta",retorno:"Retorno"})[r.tipo]||r.tipo)+'</b><small>'+esc(formatDate(r.criado_em))+'</small><p>'+esc(r.conteudo)+'</p></div>').join(""):empty("Sem interações registradas","Anote aqui cada ligação, WhatsApp, proposta ou visita.");
}
$("activity-form").addEventListener("submit",async e=>{
 e.preventDefault();const id=state.detailId;if(!id||!state.user)return;
 const text=$("activity-text").value.trim();if(!text)return;
 const btn=e.target.querySelector('button[type="submit"]');btn.disabled=true;
 try{
  const {error}=await db.from(TABLE_INTERACOES).insert({usuario_id:state.user.id,cliente_id:id,tipo:$("activity-type").value,conteudo:text});
  if(error)throw error;
  const {error:upErr}=await db.from(TABLE_CLIENTES).update({atualizado_em:new Date().toISOString()}).eq("id",id).eq("usuario_id",state.user.id);
  if(upErr)throw upErr;
  $("activity-text").value="";await loadActivities(id);await loadAll();toast("Interação salva no histórico.");
 }catch(err){toast("Erro ao registrar interação: "+err.message,true)}finally{btn.disabled=false}
});
$("detail-edit").addEventListener("click",()=>{const id=state.detailId;$("detail-dialog").close();openClientForm(id)});
$("detail-delete").addEventListener("click",async()=>{
 const id=state.detailId,c=clientById(id);if(!c)return;
 if(!confirm("Excluir o cadastro e o histórico de "+c.empresa+"? Esta operação não pode ser desfeita."))return;
 try{
  const {error}=await db.from(TABLE_CLIENTES).delete().eq("id",id).eq("usuario_id",state.user.id);
  if(error)throw error;
  $("detail-dialog").close();state.detailId=null;await loadAll();toast("Cliente excluído.");
 }catch(err){toast("Erro ao excluir: "+err.message,true)}
});
function populateFloatSelect(){
 const el=$("float-client"),selected=el.value;
 el.innerHTML='<option value="">Nota avulsa</option>'+[...state.clientes].sort((a,b)=>a.empresa.localeCompare(b.empresa,"pt-BR")).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.empresa)+'</option>').join("");
 if([...el.options].some(o=>o.value===selected))el.value=selected;
}
function showFloat(){
 $("float-panel").classList.remove("hidden");$("float-bubble").classList.add("hidden");
 const pos=localStorage.getItem("movami_crm_float_pos");
 if(pos&&window.innerWidth>760){try{const p=JSON.parse(pos);const x=Math.max(0,Math.min(p.x,window.innerWidth-330));const y=Math.max(0,Math.min(p.y,window.innerHeight-150));$("float-panel").style.left=x+"px";$("float-panel").style.top=y+"px";$("float-panel").style.right="auto";$("float-panel").style.bottom="auto"}catch(e){/* sem posição salva */}}
 $("float-text").focus();
}
function hideFloat(){
 $("float-panel").classList.add("hidden");$("float-bubble").classList.remove("hidden");
}
$("open-float").addEventListener("click",showFloat);
$("float-bubble").addEventListener("click",showFloat);
$("float-close").addEventListener("click",hideFloat);
$("float-minimize").addEventListener("click",()=>{
 const body=$("float-body");body.classList.toggle("hidden");$("float-minimize").textContent=body.classList.contains("hidden")?"+":"−";
});
$("float-save").addEventListener("click",async()=>{
 const text=$("float-text").value.trim();
 if(!text){$("float-status").textContent="Digite alguma anotação antes de salvar.";return}
 if(!state.user)return;
 const btn=$("float-save");btn.disabled=true;$("float-status").textContent="Salvando...";
 const clientId=$("float-client").value;
 try{
  const {error}=await db.from(TABLE_NOTAS).insert({usuario_id:state.user.id,cliente_id:clientId||null,texto:text});
  if(error)throw error;
  $("float-text").value="";$("float-status").textContent="Nota salva e sincronizada.";
  await loadAll();toast("Nota rápida salva.");
 }catch(err){$("float-status").textContent="Falha ao salvar. O texto foi mantido.";toast(err.message,true)}
 finally{btn.disabled=false}
});
async function toggleNote(id){
 if(!state.user)return;
 const n=state.notas.find(x=>x.id===id);if(!n)return;
 const {error}=await db.from(TABLE_NOTAS).update({concluida:!n.concluida,atualizado_em:new Date().toISOString()}).eq("id",id).eq("usuario_id",state.user.id);
 if(error){toast(error.message,true);return}await loadAll();
}
async function deleteNote(id){
 if(!state.user||!confirm("Excluir esta nota?"))return;
 const {error}=await db.from(TABLE_NOTAS).delete().eq("id",id).eq("usuario_id",state.user.id);
 if(error){toast(error.message,true);return}await loadAll();toast("Nota excluída.");
}
const handle=$("float-handle"),float=$("float-panel");let drag=null;
handle.addEventListener("pointerdown",e=>{
 if(e.target.closest("button")||window.innerWidth<=760)return;
 const r=float.getBoundingClientRect();drag={dx:e.clientX-r.left,dy:e.clientY-r.top};
 handle.setPointerCapture(e.pointerId);
});
handle.addEventListener("pointermove",e=>{
 if(!drag)return;
 const x=Math.max(0,Math.min(e.clientX-drag.dx,window.innerWidth-float.offsetWidth));
 const y=Math.max(0,Math.min(e.clientY-drag.dy,window.innerHeight-float.offsetHeight));
 float.style.left=x+"px";float.style.top=y+"px";float.style.right="auto";float.style.bottom="auto";
});
function endDrag(){if(!drag)return;drag=null;
 const r=float.getBoundingClientRect();localStorage.setItem("movami_crm_float_pos",JSON.stringify({x:r.left,y:r.top}));
}
handle.addEventListener("pointerup",endDrag);handle.addEventListener("pointercancel",endDrag);
window.addEventListener("focus",()=>{if(state.user&&!state.fetching)loadAll()});
window.addEventListener("online",()=>{if(state.user)loadAll()});
if(db)startup();
