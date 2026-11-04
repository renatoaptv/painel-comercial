/* MOVAMI — Vendas de Veiculos Usados | dados locais, sem servidor */
(function(){
'use strict';
const KEY='movami_usados_v1', DB='movami_usados_anexos_v1', DOCS='documentos';
const STAGES=[['novo','NOVO CONTATO'],['atendimento','EM ATENDIMENTO'],['proposta','PROPOSTA ENVIADA'],['negociacao','EM NEGOCIAÇÃO'],['aprovado','AGUARDANDO ENTREGA'],['vendido','VENDIDO'],['perdido','NÃO FECHOU']];
const CATEGORIES=['CNH / IDENTIFICAÇÃO','PROPOSTA','FICHA CADASTRAL','ANÁLISE DE CRÉDITO','COMPROVANTE DE PAGAMENTO','CONTRATO','NOTA FISCAL','DOCUMENTO DO VEÍCULO','OUTROS'];
const ACCEPT=['application/pdf','image/png','image/jpeg','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reais=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=()=>new Date().toISOString().slice(0,10);
const uid=()=>crypto.randomUUID();
const fmtDate=s=>s?String(s).split('-').reverse().join('/'):'—';
const stageName=v=>STAGES.find(s=>s[0]===v)?.[1]||'—';
let deals=[],stock=[],query='',filter='todos',view='negociacoes',editing=null,editVehicle=null,dbPromise;
try{const data=JSON.parse(localStorage.getItem(KEY)||'{}');deals=Array.isArray(data.deals)?data.deals:[];stock=Array.isArray(data.stock)?data.stock:[]}catch(e){alert('Não foi possível ler os dados de usados. Confira o backup.')}
function save(){localStorage.setItem(KEY,JSON.stringify({deals,stock}))}
function idb(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(DOCS,{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return dbPromise}
async function putDoc(x){const db=await idb();return new Promise((ok,bad)=>{const t=db.transaction(DOCS,'readwrite');t.objectStore(DOCS).put(x);t.oncomplete=ok;t.onerror=()=>bad(t.error)})}
async function getDoc(id){const db=await idb();return new Promise((ok,bad)=>{const r=db.transaction(DOCS).objectStore(DOCS).get(id);r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)})}
async function delDoc(id){const db=await idb();return new Promise((ok,bad)=>{const t=db.transaction(DOCS,'readwrite');t.objectStore(DOCS).delete(id);t.oncomplete=ok;t.onerror=()=>bad(t.error)})}
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function read64(blob){return new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>bad(r.error);r.readAsDataURL(blob)})}
async function load64(s){return (await fetch(s)).blob()}
function notice(s){const el=$('usedMsg');if(el){el.textContent=s;el.hidden=false}}
function vehicleLabel(id){let v=stock.find(s=>s.id===id);return v?[v.brand,v.model,v.version,v.year,v.plate].filter(Boolean).join(' • '):'NÃO VINCULADO'}
function opt(v,label,selected){return '<option value="'+esc(v)+'"'+(v===selected?' selected':'')+'>'+esc(label)+'</option>'}
const css=document.createElement('style');
css.textContent='#usadosArea .used-hero{background:#171717;color:#fff;border-radius:13px;padding:19px;margin-bottom:15px}#usadosArea .used-hero h1{color:#ffcf00;margin:0 0 5px}#usadosArea .used-bar,#usadosArea .used-toolbar{display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin:15px 0}#usadosArea .used-bar button.active{background:#171717;color:#ffcf00}#usadosArea .used-toolbar label{display:grid;gap:5px;font-size:12px;font-weight:700}#usadosArea .used-toolbar input,#usadosArea .used-toolbar select{padding:10px;border-radius:8px;border:1px solid #ccc;min-width:180px}#usadosArea .used-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}#usadosArea .used-kpis article{background:white;border-top:4px solid #ffcf00;border-radius:11px;padding:16px}#usadosArea .used-kpis strong{display:block;font-size:24px;margin:7px 0}#usadosArea .used-kanban{display:grid;grid-template-columns:repeat(7,minmax(228px,1fr));gap:11px;overflow-x:auto;padding:10px 0 18px}#usadosArea .used-column{border-radius:11px;background:#e8e8e8;min-height:270px;padding:10px}#usadosArea .used-column h3{font-size:12px;min-height:30px}#usadosArea .used-card{border:1px solid #ddd;border-left:5px solid #ffcf00;background:white;border-radius:9px;margin:9px 0;padding:12px}#usadosArea .used-card strong{display:block}#usadosArea .used-card small{display:block;color:#666;margin:7px 0}#usadosArea .used-tablebox{overflow:auto;background:white;border-radius:12px}#usadosArea table{border-collapse:collapse;width:100%;min-width:830px;font-size:13px}#usadosArea th,#usadosArea td{padding:12px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}#usadosArea th{background:#fff0a9}#usadosArea .used-warning{font-size:13px;line-height:1.5;background:#fff4d0;border:1px solid #efce70;border-radius:11px;padding:13px;margin-top:15px}#usedDealDialog,#usedStockDialog{max-width:720px;width:95vw}#usedDealDialog form,#usedStockDialog form{display:grid;gap:10px}#usedDealDialog .used-formgrid,#usedStockDialog .used-formgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}#usedDealDialog label,#usedStockDialog label{display:grid;gap:5px;font-size:13px;font-weight:700}#usedDealDialog input,#usedDealDialog select,#usedDealDialog textarea,#usedStockDialog input,#usedStockDialog select{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font:inherit}#usedDealDialog textarea{min-height:76px}#usedDealDialog .used-docs{border:1px solid #e6e6e6;border-radius:8px;padding:12px}#usedDealDialog .used-docrow{border-bottom:1px solid #eee;padding:8px 0;font-size:13px;overflow-wrap:anywhere}#usedDealDialog .used-docrow button{margin-left:6px}#usedDealDialog .used-history{max-height:170px;overflow:auto;background:#f6f6f4;border-radius:8px;padding:10px;font-size:13px}#usedDealDialog .used-history p{margin:0 0 9px}#usedDealDialog .used-actions,#usedStockDialog .used-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}#usedMsg{font-size:13px;color:#205e30;font-weight:700}@media(max-width:750px){#usadosArea .used-kpis{grid-template-columns:1fr 1fr}#usedDealDialog .used-formgrid,#usedStockDialog .used-formgrid{grid-template-columns:1fr}}@media print{#usadosArea{display:none!important}}';
document.head.appendChild(css);
const area=$('usadosArea');
area.innerHTML='<div class="used-hero"><h1>VENDAS DE VEÍCULOS USADOS</h1><span>Estoque • Clientes em negociação • Vendas concluídas • Processo documental</span></div><div class="used-bar"><button id="usedDealsTab" class="active">NEGOCIAÇÕES E VENDAS</button><button id="usedStockTab">ESTOQUE DE USADOS</button><button id="usedBackupBtn">EXPORTAR BACKUP DE USADOS</button><button id="usedRestoreBtn">IMPORTAR BACKUP DE USADOS</button><input type="file" accept=".json,application/json" id="usedRestoreFile" hidden></div><div id="usedMsg" hidden></div><div id="usedContent"></div><p class="used-warning"><b>PRIVACIDADE:</b> clientes, estoque e anexos ficam somente neste navegador, sem sincronização. A página pública não tem login nem armazenamento central seguro. Não cadastre documentos sensíveis de clientes em computadores compartilhados. Os backups incluem os arquivos e dados pessoais sem criptografia: guarde-os em local protegido. O backup do cabeçalho também inclui este módulo.</p>';
const dlg=document.createElement('dialog');dlg.id='usedDealDialog';
dlg.innerHTML='<form id="usedDealForm"><div class="row"><h2 id="usedDealTitle">CADASTRAR CLIENTE</h2><button type="button" id="usedCloseDeal">FECHAR ✕</button></div><div class="used-formgrid"><label>NOME DO CLIENTE *<input id="udName" maxlength="140" required></label><label>WHATSAPP<input id="udPhone" maxlength="35" inputmode="tel"></label><label>E-MAIL<input type="email" id="udEmail" maxlength="140"></label><label>VEÍCULO DO ESTOQUE<select id="udVehicle"></select></label><label>ETAPA<select id="udStage"></select></label><label>VALOR NEGOCIADO (R$)<input id="udPrice" type="number" min="0" step=".01"></label><label>PRÓXIMO CONTATO<input id="udFollow" type="date"></label><label>DATA DA VENDA / ENTREGA<input id="udSaleDate" type="date"></label><label>FORMA DE PAGAMENTO<select id="udPayment"><option value="">Não definido</option><option>PIX / À VISTA</option><option>FINANCIAMENTO</option><option>CONSÓRCIO</option><option>MISTO / TROCA</option><option>OUTROS</option></select></label><label>DOCUMENTO DE REFERÊNCIA / PLACA (OPCIONAL)<input id="udRef" maxlength="50" placeholder="Somente se necessário"></label></div><label>OBSERVAÇÕES GERAIS<textarea id="udNotes" maxlength="4000" placeholder="Condições, avaliação do usado, pendências..."></textarea></label><label>NOVA ATUALIZAÇÃO NO HISTÓRICO<textarea id="udEvent" maxlength="1000" placeholder="Ex.: cliente enviou documentos, aguardando aprovação..."></textarea></label><div class="used-history" id="usedHistory"></div><div class="used-docs"><strong>DOCUMENTOS DO PROCESSO</strong><p class="muted">Arquivos vinculados a este cliente (PDF, JPG, PNG, WEBP ou DOCX; até 15 MB por arquivo)</p><label>CATEGORIA<select id="udDocCategory"></select></label><label>ANEXAR ARQUIVOS<input type="file" id="udDocInput" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" multiple></label><div id="usedDocsList"></div></div><div class="used-actions"><button type="button" id="usedDeleteDeal" style="color:#a22;margin-right:auto">EXCLUIR REGISTRO</button><button type="button" id="usedCancelDeal">CANCELAR</button><button type="submit" class="primary">SALVAR CLIENTE</button></div></form>';
document.body.appendChild(dlg);
const vs=document.createElement('dialog');vs.id='usedStockDialog';
vs.innerHTML='<form id="usedStockForm"><div class="row"><h2 id="usedStockTitle">CADASTRAR VEÍCULO</h2><button type="button" id="usedCloseStock">FECHAR ✕</button></div><div class="used-formgrid"><label>CÓDIGO DO ESTOQUE<input id="uvCode" maxlength="40"></label><label>MARCA *<input id="uvBrand" maxlength="70" required></label><label>MODELO *<input id="uvModel" maxlength="90" required></label><label>VERSÃO<input id="uvVersion" maxlength="100"></label><label>ANO / MODELO<input id="uvYear" maxlength="12" placeholder="2022/2023"></label><label>CHASSI<input id="uvChassis" maxlength="25"></label><label>PLACA<input id="uvPlate" maxlength="10"></label><label>QUILOMETRAGEM<input id="uvKm" type="number" min="0" step="1"></label><label>COR<input id="uvColor" maxlength="40"></label><label>PREÇO DE VENDA (R$)<input id="uvPrice" type="number" min="0" step=".01"></label><label>SITUAÇÃO<select id="uvStatus"><option value="disponivel">DISPONÍVEL</option><option value="reservado">RESERVADO</option><option value="vendido">VENDIDO</option><option value="indisponivel">INDISPONÍVEL</option></select></label></div><div class="used-actions"><button type="button" id="usedDeleteStock" style="color:#a22;margin-right:auto">EXCLUIR VEÍCULO</button><button type="button" id="usedCancelStock">CANCELAR</button><button type="submit" class="primary">SALVAR VEÍCULO</button></div></form>';
document.body.appendChild(vs);
function render(){
$('usedDealsTab').classList.toggle('active',view==='negociacoes');$('usedStockTab').classList.toggle('active',view==='estoque');
const root=$('usedContent');
if(view==='estoque'){
 const available=stock.filter(x=>x.status==='disponivel').length;
 root.innerHTML='<div class="used-kpis"><article><small>VEÍCULOS CADASTRADOS</small><strong>'+stock.length+'</strong></article><article><small>DISPONÍVEIS</small><strong>'+available+'</strong></article><article><small>RESERVADOS</small><strong>'+stock.filter(x=>x.status==='reservado').length+'</strong></article><article><small>VENDIDOS</small><strong>'+stock.filter(x=>x.status==='vendido').length+'</strong></article></div><div class="used-toolbar"><button class="primary" id="usedNewStock">+ CADASTRAR VEÍCULO</button></div><div class="used-tablebox"><table><thead><tr><th>ESTOQUE / PLACA</th><th>VEÍCULO</th><th>KM</th><th>PREÇO</th><th>SITUAÇÃO</th><th>AÇÃO</th></tr></thead><tbody>'+stock.map(s=>'<tr><td>'+esc(s.code||'—')+'<br><small>'+esc(s.plate||'')+'</small></td><td>'+esc(vehicleLabel(s.id))+'</td><td>'+Number(s.km||0).toLocaleString('pt-BR')+'</td><td>'+reais(s.price)+'</td><td>'+esc(s.status.toUpperCase())+'</td><td><button data-veh="'+esc(s.id)+'">EDITAR</button></td></tr>').join('')+'</tbody></table>'+(stock.length?'':'<p style="padding:15px">Ainda não há veículos cadastrados.</p>')+'</div>';
 $('usedNewStock').onclick=()=>openVehicle();
 root.querySelectorAll('[data-veh]').forEach(b=>b.onclick=()=>openVehicle(b.dataset.veh));
 return;
}
const active=deals.filter(d=>!['vendido','perdido'].includes(d.stage)).length;
const sold=deals.filter(d=>d.stage==='vendido');
const shown=deals.filter(d=>(filter==='todos'||d.stage===filter)&&([d.name,d.phone,d.email,vehicleLabel(d.vehicleId),d.ref].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))));
root.innerHTML='<div class="used-kpis"><article><small>NEGOCIAÇÕES EM ABERTO</small><strong>'+active+'</strong></article><article><small>VENDAS CONCLUÍDAS</small><strong>'+sold.length+'</strong></article><article><small>VALOR VENDIDO</small><strong>'+reais(sold.reduce((s,d)=>s+Number(d.price||0),0))+'</strong></article><article><small>CLIENTES CADASTRADOS</small><strong>'+deals.length+'</strong></article></div><div class="used-toolbar"><button class="primary" id="usedNewDeal">+ CADASTRAR CLIENTE</button><label>BUSCAR<input id="usedSearch" placeholder="Nome, veículo, WhatsApp..." value="'+esc(query)+'"></label><label>FILTRAR ETAPA<select id="usedFilter">'+opt('todos','TODAS AS ETAPAS',filter)+STAGES.map(s=>opt(s[0],s[1],filter)).join('')+'</select></label></div><div class="used-kanban">'+STAGES.map(s=>'<section class="used-column"><h3>'+s[1]+' ('+shown.filter(d=>d.stage===s[0]).length+')</h3>'+shown.filter(d=>d.stage===s[0]).map(d=>'<article class="used-card"><strong>'+esc(d.name)+'</strong><small>'+esc(vehicleLabel(d.vehicleId))+'</small><small>'+reais(d.price)+' • '+((d.docs||[]).length)+' anexo(s)</small><small>PRÓXIMO CONTATO: '+fmtDate(d.follow)+'</small><button data-deal="'+esc(d.id)+'">ABRIR FICHA</button>'+(d.stage==='vendido'?'<button type="button" data-print-ficha="'+esc(d.id)+'">FICHA / PDF</button>':'')+'</article>').join('')+'</section>').join('')+'</div>';
$('usedNewDeal').onclick=()=>openDeal();
$('usedSearch').oninput=e=>{query=e.target.value;const pos=e.target.selectionStart;render();const el=$('usedSearch');el.focus();el.setSelectionRange(pos,pos)};
$('usedFilter').onchange=e=>{filter=e.target.value;render()};
root.querySelectorAll('[data-deal]').forEach(b=>b.onclick=()=>openDeal(b.dataset.deal));
}
function openDeal(id){
editing=id||null;
const d=deals.find(x=>x.id===id)||{};
$('usedDealTitle').textContent=id?'FICHA DE VENDA / NEGOCIAÇÃO':'NOVO CLIENTE DE USADOS';
for(const [k,f] of Object.entries({udName:'name',udPhone:'phone',udEmail:'email',udPrice:'price',udFollow:'follow',udSaleDate:'saleDate',udPayment:'payment',udRef:'ref',udNotes:'notes'}))$(k).value=d[f]??'';
$('udVehicle').innerHTML=opt('','SELECIONE O VEÍCULO',d.vehicleId||'')+stock.map(v=>opt(v.id,vehicleLabel(v.id),d.vehicleId)).join('');
$('udStage').innerHTML=STAGES.map(s=>opt(s[0],s[1],d.stage||'novo')).join('');
$('udDocCategory').innerHTML=CATEGORIES.map(c=>opt(c,c,CATEGORIES[0])).join('');
$('udEvent').value='';$('udDocInput').value='';
$('usedDeleteDeal').hidden=!id;
$('usedHistory').innerHTML='<b>HISTÓRICO DO ATENDIMENTO</b>'+((d.history||[]).length?(d.history||[]).slice().reverse().map(e=>'<p><small>'+esc(new Date(e.at).toLocaleString('pt-BR'))+'</small> — '+esc(e.text)+'</p>').join(''):'<p class="muted">Sem atualizações registradas.</p>');
renderDocs(d);
window.usadosFichaOpen?.(d);
dlg.showModal();
}
function renderDocs(d){
$('usedDocsList').innerHTML=(d.docs||[]).map(f=>'<div class="used-docrow"><b>'+esc(f.category)+'</b> — '+esc(f.name)+' <button type="button" data-getdoc="'+esc(f.id)+'">BAIXAR</button><button type="button" data-deldoc="'+esc(f.id)+'">EXCLUIR</button></div>').join('')||'<p class="muted">Nenhum arquivo anexado.</p>';
$('usedDocsList').querySelectorAll('[data-getdoc]').forEach(b=>b.onclick=async()=>{const x=await getDoc(b.dataset.getdoc);if(!x){alert('Documento não encontrado neste navegador. Restaure seu backup.');return}download(x.blob,x.name)});
$('usedDocsList').querySelectorAll('[data-deldoc]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este anexo do navegador?'))return;const d=deals.find(x=>x.id===editing);if(!d)return;const id=b.dataset.deldoc;try{await delDoc(id);d.docs=d.docs.filter(x=>x.id!==id);save();renderDocs(d);render();notice('Anexo removido')}catch(e){alert('Erro ao excluir anexo: '+e.message)}});
}
$('usedDealForm').onsubmit=async e=>{
e.preventDefault();
const name=$('udName').value.trim();if(!name)return;
const old=deals.find(x=>x.id===editing), d=old?structuredClone(old):{id:uid(),history:[],docs:[],createdAt:new Date().toISOString()};
d.name=name;for(const [k,f] of Object.entries({udPhone:'phone',udEmail:'email',udVehicle:'vehicleId',udStage:'stage',udFollow:'follow',udSaleDate:'saleDate',udPayment:'payment',udRef:'ref',udNotes:'notes'}))d[f]=$(k).value.trim();
d.price=Number($('udPrice').value||0);d.ficha=window.usadosFichaCapture?.() ?? d.ficha ?? {};d.updatedAt=new Date().toISOString();
const msg=$('udEvent').value.trim();if(msg)(d.history||(d.history=[])).push({at:new Date().toISOString(),text:msg});
if(d.stage==='vendido'&&d.vehicleId){const conflict=deals.find(x=>x.id!==d.id&&x.stage==='vendido'&&x.vehicleId===d.vehicleId);if(conflict){alert('Este veículo já consta como vendido para outro cliente.');return}}
const becomingSold=d.stage==='vendido'&&(!old||old.stage!=='vendido');
const printTab=becomingSold?window.usadosFichaReserve?.():null;
const newDocs=[];
try{
 for(const file of $('udDocInput').files){
  const type=file.type||({'pdf':'application/pdf','jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','webp':'image/webp','docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}[file.name.split('.').pop().toLowerCase()]||'');
  if(!ACCEPT.includes(type))throw Error('Tipo não permitido: '+file.name);
  if(file.size>15*1024*1024)throw Error('Arquivo maior que 15 MB: '+file.name);
  const meta={id:uid(),name:file.name,category:$('udDocCategory').value,addedAt:new Date().toISOString()};
  await putDoc({...meta,blob:file});newDocs.push(meta);
 }
 d.docs=[...(d.docs||[]),...newDocs];
 if(old){deals[deals.findIndex(x=>x.id===d.id)]=d}else deals.push(d);
 for(const v of stock)if(v.soldDealId===d.id&&!(d.stage==='vendido'&&v.id===d.vehicleId)){v.soldDealId=null;v.status='disponivel'}
 if(d.stage==='vendido'&&d.vehicleId){const v=stock.find(x=>x.id===d.vehicleId);if(v){v.status='vendido';v.soldDealId=d.id}}
 save();dlg.close();render();notice('Ficha de cliente salva com sucesso');if(becomingSold)window.usadosFichaAfterSale?.(d,stock,printTab);
}catch(err){alert('Não foi possível salvar: '+err.message)}
};
function openVehicle(id){
editVehicle=id||null;const v=stock.find(x=>x.id===id)||{};
$('usedStockTitle').textContent=id?'EDITAR VEÍCULO DO ESTOQUE':'NOVO VEÍCULO DO ESTOQUE';
for(const [k,f] of Object.entries({uvCode:'code',uvBrand:'brand',uvModel:'model',uvVersion:'version',uvYear:'year',uvChassis:'chassis',uvPlate:'plate',uvKm:'km',uvColor:'color',uvPrice:'price',uvStatus:'status'}))$(k).value=v[f]??(f==='status'?'disponivel':'');
$('usedDeleteStock').hidden=!id;vs.showModal();
}
$('usedStockForm').onsubmit=e=>{
e.preventDefault();const v=stock.find(x=>x.id===editVehicle)||{id:uid()};
for(const [k,f] of Object.entries({uvCode:'code',uvBrand:'brand',uvModel:'model',uvVersion:'version',uvYear:'year',uvChassis:'chassis',uvPlate:'plate',uvColor:'color',uvStatus:'status'}))v[f]=$(k).value.trim();
v.km=Number($('uvKm').value||0);v.price=Number($('uvPrice').value||0);
if(v.soldDealId&&v.status!=='vendido'){alert('Há uma venda concluída vinculada a este veículo. Altere primeiro a ficha de venda.');return}
if(!editVehicle)stock.push(v);
try{save();vs.close();render();notice('Veículo salvo no estoque')}catch(err){alert('Não foi possível salvar: '+err.message)}
};
$('usedDeleteStock').onclick=()=>{const v=stock.find(x=>x.id===editVehicle);if(!v)return;if(deals.some(d=>d.vehicleId===v.id)){alert('Não é possível excluir veículo vinculado a clientes. Edite a ficha primeiro.');return}if(confirm('Excluir este veículo do estoque?')){stock=stock.filter(x=>x.id!==v.id);save();vs.close();render()}};
$('usedDeleteDeal').onclick=async()=>{const d=deals.find(x=>x.id===editing);if(!d||!confirm('Excluir permanentemente a ficha e todos os anexos deste cliente?'))return;try{for(const f of d.docs||[])await delDoc(f.id);deals=deals.filter(x=>x.id!==d.id);for(const v of stock)if(v.soldDealId===d.id){v.soldDealId=null;v.status='disponivel'}save();dlg.close();render();notice('Ficha excluída')}catch(err){alert('Falha ao excluir: '+err.message)}};
$('usedCloseDeal').onclick=$('usedCancelDeal').onclick=()=>dlg.close();
$('usedCloseStock').onclick=$('usedCancelStock').onclick=()=>vs.close();
$('usedDealsTab').onclick=()=>{view='negociacoes';render()};
$('usedStockTab').onclick=()=>{view='estoque';render()};
async function exportAll(){
const files=[];
for(const d of deals)for(const f of d.docs||[]){const x=await getDoc(f.id);if(!x)throw Error('Anexo não encontrado: '+f.name);files.push({id:f.id,name:f.name,category:f.category,data:await read64(x.blob)})}
return{version:1,deals,stock,files};
}
async function importAll(data){
if(!data||!Array.isArray(data.deals)||!Array.isArray(data.stock)||!Array.isArray(data.files))throw Error('Dados de usados inválidos');
for(const f of data.files){if(!f.id||typeof f.data!=='string'||!f.data.startsWith('data:'))throw Error('Anexo inválido');await putDoc({id:f.id,name:f.name,category:f.category,blob:await load64(f.data)})}
deals=data.deals;stock=data.stock;save();render();
}
window.usadosExport=exportAll;window.usadosImport=importAll;window.drawUsados=render;window.usadosFichaAccess={getDeals:()=>deals,getStock:()=>stock};
$('usedBackupBtn').onclick=async()=>{try{download(new Blob([JSON.stringify({format:'MOVAMI-USADOS',exportedAt:new Date().toISOString(),data:await exportAll()})],{type:'application/json'}),'MOVAMI_Usados_Backup_'+date()+'.json');notice('Backup de usados exportado')}catch(err){alert('Erro no backup: '+err.message)}};
$('usedRestoreBtn').onclick=()=>$('usedRestoreFile').click();
$('usedRestoreFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const x=JSON.parse(await file.text());if(x.format!=='MOVAMI-USADOS')throw Error('Arquivo não é backup de usados');if(!confirm('Substituir TODAS as fichas de usados e estoque por este backup?'))return;await importAll(x.data);notice('Backup restaurado')}catch(err){alert('Não foi possível importar: '+err.message)}finally{e.target.value=''}};
render();
})();