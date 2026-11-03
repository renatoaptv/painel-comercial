/* MOVAMI - base de prospecção em massa: dados somente no navegador (IndexedDB). */
(()=>{'use strict';
const DB='movami_base_empresas_massiva_v1',STORE='empresas';
let dbPromise,cache=null,page=0,needle='',city='',state='todos',busy=false;
const PAGE=80,$=id=>document.getElementById(id);
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const onlyDigits=x=>String(x||'').replace(/\D/g,'');
function db(){
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
 const req=indexedDB.open(DB,1);
 req.onupgradeneeded=()=>{let st=req.result.createObjectStore(STORE,{keyPath:'id'});st.createIndex('city','city');st.createIndex('cnpj','cnpj')};
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });return dbPromise;
}
function readAll(){return db().then(d=>new Promise((resolve,reject)=>{const r=d.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}))}
function txPut(batch){return db().then(d=>new Promise((resolve,reject)=>{let tx=d.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);for(const item of batch)store.put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)}))}
function cityNormalize(x){const raw=String(x||'').trim();if(!raw)return '';const known=(typeof ALL_PROSPECT_CITIES!=='undefined'?ALL_PROSPECT_CITIES:[]).find(c=>c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')===raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));return known||raw}
function normHeader(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')}
const headerAliases={
name:['razaosocial','nomeempresarial','empresa','nome','nomefantasia','fantasia'],
cnpj:['cnpj','cnpjcompleto','cnpj14'],
city:['cidade','municipio','nomecidade'],
region:['regiao'],
opening:['abertura','datadeabertura','dataabertura','iniciodeatividade'],
capital:['capitalsocial','capital','capitalrs'],
phone:['telefone','fone','telefoneddd','celular','whatsapp'],
email:['email','emailcomercial','correioeletronico'],
activity:['cnae','atividade','atividadeprincipal','cnaeprincipal'],
status:['situacao','situacaocadastral'],
source:['fonte','origem']
};
function getCell(row,headers,field){let keys=headerAliases[field];for(const key of keys){let i=headers.indexOf(key);if(i>=0)return String(row[i]||'').trim()}return ''}
function parseDelimited(text){
 const sep=(text.slice(0,3000).split('\n')[0].match(/;/g)||[]).length>(text.slice(0,3000).split('\n')[0].match(/,/g)||[]).length?';':',';
 let rows=[],row=[],cell='',quote=false;
 for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else quote=!quote}
 else if(c===sep&&!quote){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows
}
function amount(x){let v=String(x||'').trim().replace(/\s/g,'').replace(/^R\$/i,'');if(!v)return null;
 if(v.includes(',')&&v.includes('.'))v=v.replace(/\./g,'').replace(',','.');else if(v.includes(','))v=v.replace(',','.');
 const n=Number(v);return Number.isFinite(n)?n:null}
function dateISO(v){v=String(v||'').trim();if(/^\d{8}$/.test(v))return v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8);if(/^\d{2}\/\d{2}\/\d{4}$/.test(v))return v.slice(6)+'-'+v.slice(3,5)+'-'+v.slice(0,2);return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:''}
function prepare(obj){
 let cnpj=onlyDigits(obj.cnpj),name=String(obj.name||'').trim(),city=cityNormalize(obj.city),opening=dateISO(obj.opening);
 if(!name&&!cnpj)return null;if(cnpj&&cnpj.length!==14)return null;
 const id=cnpj||('nome:'+name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')+':'+city.toLowerCase());
 return {id,cnpj,name:name||cnpj,city,region:obj.region||((typeof getProspectRegion==='function')?getProspectRegion(city):''),opening,capital:obj.capital==null?null:amount(obj.capital),phone:String(obj.phone||''),email:String(obj.email||''),activity:String(obj.activity||''),status:String(obj.status||''),source:String(obj.source||'Base importada'),contactedAt:obj.contactedAt||null}
}
function message(msg){const n=$('massImportMessage');if(n)n.textContent=msg}
function qualify(p){if(p.capital==null||!p.opening)return 'pendente';let year=Number(p.opening.slice(0,4));if(!year)return 'pendente';let date=new Date(p.opening+'T12:00:00'),now=new Date();if(isNaN(date.getTime()))return 'pendente';let target=new Date(date);target.setFullYear(target.getFullYear()+2);return p.capital>30000&&target<now?'apto':'fora'}
function selectedRows(){let items=cache||[];let q=needle.toLowerCase();return items.filter(p=>(!city||p.city===city)&&(state==='todos'||(state==='email'?!p.contactedAt:state==='enviado'?!!p.contactedAt:qualify(p)===state))&&(!q||[p.name,p.cnpj,p.city,p.email,p.phone,p.activity].some(x=>String(x||'').toLowerCase().includes(q))))}
function mount(){
 const root=$('massLeadPanel');if(!root)return;
 root.innerHTML='<section style="background:#fff;border:1px solid #d5d5d5;border-top:6px solid #ffcf00;border-radius:12px;margin-top:23px;padding:18px"><h2 style="font-size:20px;margin-bottom:8px">BASE DE EMPRESAS EM MASSA • ATÉ 50 MIL E MAIS</h2><p class="muted">Importe um CSV/JSON de empresas reais. Os registros ficam separados da carteira de prospecção e são salvos no navegador (IndexedDB). Não são publicados no GitHub.</p><div class="prospect-tools"><label>Arquivo CSV ou JSON<input id="massFile" type="file" accept=".csv,.json,text/csv,application/json"></label><button type="button" class="primary" id="massImport">IMPORTAR EMPRESAS</button><button type="button" id="massExportSample">BAIXAR MODELO CSV</button></div><p id="massImportMessage" role="status" class="muted"></p><div class="prospect-grid"><article class="prospect-kpi"><small>EMPRESAS NA BASE</small><strong id="massTotal">0</strong></article><article class="prospect-kpi"><small>COM E-MAIL</small><strong id="massEmail">0</strong></article><article class="prospect-kpi"><small>COM CAPITAL E ABERTURA VALIDÁVEIS</small><strong id="massEligible">0</strong></article><article class="prospect-kpi"><small>MARCADAS COMO CONTATADAS</small><strong id="massContacted">0</strong></article></div><div class="prospect-tools"><label>Buscar<input id="massSearch" placeholder="Empresa, CNPJ, e-mail, atividade..."></label><label>Cidade<select id="massCity"><option value="">Todas as cidades</option></select></label><label>Situação<select id="massStatus"><option value="todos">Todas</option><option value="apto">Aptas pelos critérios</option><option value="pendente">Dados pendentes</option><option value="fora">Fora dos critérios</option><option value="email">Ainda não contatadas</option><option value="enviado">Já contatadas</option></select></label></div><p id="massCount" class="muted"></p><div class="prospect-tablewrap"><table class="prospect-table"><thead><tr><th>Empresa</th><th>Cidade</th><th>CNPJ</th><th>Capital</th><th>Abertura</th><th>Contato comercial</th><th>Critérios</th><th>Ações</th></tr></thead><tbody id="massRows"></tbody></table></div><div class="prospect-tools"><button id="massPrev">← ANTERIOR</button><span id="massPages"></span><button id="massNext">PRÓXIMA →</button></div><p class="prospect-warning">A base precisa ser fornecida por arquivo: o site não possui acesso direto à Receita Federal. Os filtros indicam capital e antiguidade informados, não aprovação de crédito. E-mails da Receita podem estar desatualizados.</p></section>';
 $('massImport').onclick=importCSV;$('massExportSample').onclick=sample;
 $('massSearch').oninput=e=>{needle=e.target.value;page=0;render()};
 $('massCity').onchange=e=>{city=e.target.value;page=0;render()};
 $('massStatus').onchange=e=>{state=e.target.value;page=0;render()};
 $('massPrev').onclick=()=>{page=Math.max(0,page-1);render()};
 $('massNext').onclick=()=>{page++;render()};
 root.onclick=async e=>{
 const btn=e.target.closest('button[data-mass-action]');if(!btn)return;
 const p=cache?.find(x=>x.id===btn.dataset.massId);if(!p)return;
 if(btn.dataset.massAction==='promote'){
   if(typeof prospects==='undefined'){alert('Lista de prospecção indisponível');return}
   const exists=prospects.some(x=>(p.cnpj&&onlyDigits(x.cnpj)===p.cnpj)||(x.name?.toLowerCase()===p.name.toLowerCase()&&x.city===p.city));
   if(exists){alert('Empresa já está na prospecção');return}
   const entry={id:crypto.randomUUID(),name:p.name,cnpj:p.cnpj,city:p.city,region:p.region,capital:p.capital,opening:p.opening,phone:p.phone,email:p.email,source:p.source,stage:'contatar',notes:'Adicionada da base em massa. Atividade: '+p.activity};
   prospects.push(entry);try{saveProspects();drawProspects();message('Empresa '+p.name+' adicionada à carteira de prospecção')}catch(err){prospects.pop();alert('Não foi possível adicionar: '+err.message)}
 }else if(btn.dataset.massAction==='toggle'){p.contactedAt=p.contactedAt?null:new Date().toISOString();await txPut([p]);render()}
 };
}
function render(){
 const root=$('massLeadPanel');if(!root||!cache)return;
 $('massTotal').textContent=cache.length.toLocaleString('pt-BR');
 $('massEmail').textContent=cache.filter(x=>!!x.email).length.toLocaleString('pt-BR');
 $('massEligible').textContent=cache.filter(x=>qualify(x)==='apto').length.toLocaleString('pt-BR');
 $('massContacted').textContent=cache.filter(x=>!!x.contactedAt).length.toLocaleString('pt-BR');
 const cities=[...new Set(cache.map(x=>x.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const el=$('massCity');const old=el.value;const newOpts='<option value="">Todas as cidades</option>'+cities.map(c=>'<option value="'+escapeHTML(c)+'">'+escapeHTML(c)+'</option>').join('');
 if(el.dataset.opts!==newOpts){el.innerHTML=newOpts;el.dataset.opts=newOpts;el.value=city||old}
 let filtered=selectedRows(),pages=Math.max(1,Math.ceil(filtered.length/PAGE));page=Math.min(page,pages-1);
 $('massCount').textContent=filtered.length.toLocaleString('pt-BR')+' registros encontrados';
 $('massPages').textContent='Página '+(page+1)+' de '+pages;
 $('massPrev').disabled=page<=0;$('massNext').disabled=page>=pages-1;
 $('massRows').innerHTML=filtered.slice(page*PAGE,page*PAGE+PAGE).map(p=>'<tr'+(p.contactedAt?' style="background:#e5f6e8"':'')+'><td><strong>'+escapeHTML(p.name)+'</strong></td><td>'+escapeHTML(p.city)+'</td><td>'+escapeHTML(p.cnpj||'—')+'</td><td>'+(p.capital==null?'A confirmar':'R$ '+p.capital.toLocaleString('pt-BR',{minimumFractionDigits:2}))+'</td><td>'+escapeHTML(p.opening||'A confirmar')+'</td><td>'+escapeHTML(p.phone||'')+'<br>'+escapeHTML(p.email||'')+'</td><td>'+({apto:'APTA PELOS CRITÉRIOS',pendente:'PENDENTE',fora:'FORA DOS CRITÉRIOS'}[qualify(p)])+'</td><td><div class="prospect-actions"><button type="button" data-mass-action="promote" data-mass-id="'+escapeHTML(p.id)+'">ADICIONAR À PROSPECÇÃO</button><button type="button" data-mass-action="toggle" data-mass-id="'+escapeHTML(p.id)+'">'+(p.contactedAt?'✓ CONTATADA':'MARCAR CONTATADA')+'</button></div></td></tr>').join('')||'<tr><td colspan="8">Nenhuma empresa encontrada. Importe um arquivo para começar.</td></tr>';
}
function sample(){
 const content='\uFEFFEmpresa;CNPJ;Cidade;Abertura;Capital Social;Telefone;Email;CNAE;Situacao;Fonte\nEMPRESA EXEMPLO LTDA;12345678000190;Blumenau;2020-01-15;50000;4733000000;contato@exemplo.com.br;Comercio;ATIVA;Receita Federal\n';
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));let a=document.createElement('a');a.href=url;a.download='MODELO_MOVAMI_BASE_EMPRESAS.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),20000)
}
async function importCSV(){
 if(busy)return;const file=$('massFile').files[0];if(!file){alert('Selecione um arquivo CSV ou JSON');return}
 busy=true;$('massImport').disabled=true;try{
 message('Lendo arquivo...');const raw=await file.text();let records=[];
 if(file.name.toLowerCase().endsWith('.json')){
 const j=JSON.parse(raw);let rows=Array.isArray(j)?j:(j.prospects||j.empresas||[]);
 records=rows.map(p=>prepare({name:p.name||p.empresa||p.razao_social,cnpj:p.cnpj,city:p.city||p.cidade,region:p.region||p.regiao,opening:p.opening||p.abertura,capital:p.capital,phone:p.phone||p.telefone,email:p.email,activity:p.activity||p.cnae,status:p.status,source:p.source||p.fonte})).filter(Boolean);
 }else{
 const rows=parseDelimited(raw);if(rows.length<2)throw Error('Arquivo CSV sem registros');
 const headers=rows.shift().map(normHeader);if(!headerAliases.name.some(k=>headers.includes(k))&&!headers.includes('cnpj'))throw Error('Cabeçalhos não reconhecidos. Baixe o modelo CSV.');
 records=rows.map(row=>prepare(Object.fromEntries(Object.keys(headerAliases).map(k=>[k,getCell(row,headers,k)])))).filter(Boolean);
 }
 let before=cache?.length||0,valid=records.length,batch=[];
 for(let i=0;i<records.length;i++){batch.push(records[i]);if(batch.length>=700){await txPut(batch);batch=[];if(i%7000===0)message((i+1).toLocaleString('pt-BR')+' registros gravados...')}}
 if(batch.length)await txPut(batch);
 cache=await readAll();page=0;render();
 message('Importação concluída: '+valid.toLocaleString('pt-BR')+' linhas válidas; '+cache.length.toLocaleString('pt-BR')+' empresas únicas na base (anteriormente '+before.toLocaleString('pt-BR')+'). Duplicadas por CNPJ foram atualizadas.');
 }catch(err){message('Erro na importação: '+err.message)}finally{busy=false;$('massImport').disabled=false;$('massFile').value=''}
}
window.drawMassLeadPanel=async function(){
 if(!$('massLeadPanel'))return;mount();
 try{if(cache===null){message('Carregando base local...');cache=await readAll()}render()}catch(err){message('Não foi possível abrir o banco local: '+err.message)}
};
})();