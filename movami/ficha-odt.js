/* Ficha MOVAMI em OpenDocument Text (.odt), usando o modelo de Writer do cliente. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const utf8=new TextEncoder(), decoder=new TextDecoder();
const templatePath='./modelo-resumo-vendas.odt?v=arquivo-corrigido-20261104';
const termTemplatePath='./modelo-termo-responsabilidade.odt?v=termo-v1';
const U16=(v,p)=>v.getUint16(p,true),U32=(v,p)=>v.getUint32(p,true);
function xmlEscape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function money(x){if(x==null||x==='')return '';const n=Number(x);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):String(x)}
function date(x){return /^\d{4}-\d\d-\d\d$/.test(String(x||''))?x.split('-').reverse().join('/'):String(x||'')}
function sum(f,keys){const vals=keys.map(k=>f[k]).filter(v=>v!==''&&v!=null);return vals.length?money(vals.reduce((a,b)=>a+Number(b||0),0)):''}
function values(d,stock){
 const f=d.ficha||{}, v=(stock||[]).find(x=>x.id===d.vehicleId)||{};
 const map={...f,name:d.name||'',phone:d.phone||'',chassis:v.chassis||'',year:v.year||'',brand:v.brand||'',model:[v.model,v.version].filter(Boolean).join(' '),color:v.color||'',plate:v.plate||'',price:money(d.price),invoiceValue:money(f.invoiceValue==null||f.invoiceValue===''?d.price:f.invoiceValue),receivedTotal:sum(f,['receivedInvoice','tradeInAmount','checkCash','checkAmount','duplicataAmount','deposit','cash','financed','consortiumCredit']),paidTotal:sum(f,['paidInvoice','paidAdm','paidReferral','paidDispatcher','paidInsurance','paidOther','paidParts','paidPayoff']),cashMethod:f.cashMethod||'',transactionDate:date(f.transactionDate||d.saleDate),invoiceDate:date(f.invoiceDate)};
 for(const k of ['birthday','rgIssued'])map[k]=date(f[k]);
 for(const k of ['receivedInvoice','tradeInAmount','checkCash','checkAmount','duplicataAmount','deposit','cash','financed','consortiumCredit','paidInvoice','paidAdm','paidReferral','paidDispatcher','paidInsurance','paidOther','paidParts','paidPayoff','commission'])map[k]=money(f[k]);
 return map;
}
function appendParts(parts){let len=0;for(const p of parts)len+=p.length;const out=new Uint8Array(len);let at=0;for(const p of parts){out.set(p,at);at+=p.length}return out}
async function inflateRaw(bytes){
 if(typeof DecompressionStream==='undefined')throw Error('Este navegador não suporta leitura do modelo ODT. Atualize o Chrome ou Edge.');
 return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
}
async function unzip(buffer){
 const b=new Uint8Array(buffer),v=new DataView(buffer);let end=-1;
 for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--){if(U32(v,p)===0x06054b50){end=p;break}}
 if(end<0)throw Error('Modelo ODT inválido: final do arquivo ZIP não encontrado.');
 const n=U16(v,end+10),off=U32(v,end+16), files=[];let p=off;
 for(let i=0;i<n;i++){
  if(U32(v,p)!==0x02014b50)throw Error('Modelo ODT inválido: índice ZIP.');
  const method=U16(v,p+10),size=U32(v,p+20),nl=U16(v,p+28),el=U16(v,p+30),cl=U16(v,p+32),local=U32(v,p+42);
  const name=decoder.decode(b.subarray(p+46,p+46+nl));p+=46+nl+el+cl;
  if(U32(v,local)!==0x04034b50)throw Error('Modelo ODT inválido: cabeçalho.');
  const start=local+30+U16(v,local+26)+U16(v,local+28);
  const chunk=b.subarray(start,start+size);
  const data=method===0?new Uint8Array(chunk):method===8?await inflateRaw(chunk):null;
  if(!data)throw Error('Compressão do modelo ODT não suportada.');
  files.push({name,data});
 }
 return files;
}
const crcTable=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0}
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function u16(v,p,n){v.setUint16(p,n,true)}function u32(v,p,n){v.setUint32(p,n>>>0,true)}
function zipStored(files){
 const locals=[],central=[];let offset=0;
 for(const {name,data} of files){
  const filename=utf8.encode(name),crc=crc32(data),lh=new Uint8Array(30+filename.length),lv=new DataView(lh.buffer);
  u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,0);u32(lv,14,crc);u32(lv,18,data.length);u32(lv,22,data.length);u16(lv,26,filename.length);lh.set(filename,30);
  locals.push(lh,data);
  const ch=new Uint8Array(46+filename.length),cv=new DataView(ch.buffer);
  u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x0800);u16(cv,10,0);u32(cv,16,crc);u32(cv,20,data.length);u32(cv,24,data.length);u16(cv,28,filename.length);u32(cv,42,offset);ch.set(filename,46);
  central.push(ch);offset+=lh.length+data.length;
 }
 const centralBytes=appendParts(central),end=new Uint8Array(22),e=new DataView(end.buffer);
 u32(e,0,0x06054b50);u16(e,8,files.length);u16(e,10,files.length);u32(e,12,centralBytes.length);u32(e,16,offset);
 return appendParts([...locals,centralBytes,end]);
}
const LOCAL_MODEL_KEY='movami_writer_modelo_original_odt_v1';
let cachedTemplate;
async function verifyODT(buffer){
 const bytes=new Uint8Array(buffer);
 if(bytes.length<1000||bytes[0]!==80||bytes[1]!==75||bytes[2]!==3||bytes[3]!==4)throw Error('O modelo recebido não é um arquivo ODT válido.');
 const files=await unzip(buffer);
 const content=files.find(f=>f.name==='content.xml');
 if(!content||!files.some(f=>f.name==='mimetype'))throw Error('O documento não possui a estrutura ODT completa.');
 const xml=decoder.decode(content.data);
 const tokens=xml.match(/\{\{[a-zA-Z0-9_]+\}\}/g)||[];
 if(tokens.length<35)throw Error('Selecione o modelo original de prévias, com os campos de preenchimento automático.');
 return files;
}
async function chooseOriginalModel(reason){
 return new Promise((resolve,reject)=>{
  const dlg=document.createElement('dialog');
  dlg.style.cssText='width:min(580px,95vw);border:2px solid #ffcf00;border-radius:12px;padding:22px;font-family:Arial,sans-serif';
  dlg.innerHTML='<div style="display:grid;gap:12px"><h2 style="margin:0">CONFIGURAR FICHA ORIGINAL DO LIBREOFFICE</h2>'+
   '<p style="line-height:1.5;margin:0">O arquivo de modelo publicado está com problema. Selecione o <b>modelo original .ODT</b> salvo no seu computador. Esta configuração será guardada neste navegador para as próximas vendas.</p>'+
   '<p style="font-size:12px;color:#a22;margin:0"></p>'+
   '<label style="font-weight:700">SELECIONAR MODELO .ODT<input type="file" accept=".odt,application/vnd.oasis.opendocument.text" style="width:100%;margin-top:8px"></label>'+
   '<div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" data-cancel>Cancelar</button></div></div>';
  const error=dlg.querySelector('p:nth-of-type(2)'),input=dlg.querySelector('input');
  error.textContent=reason?('Detalhe técnico: '+reason):'';
  const done=(result,err)=>{dlg.close();dlg.remove();if(err)reject(err);else resolve(result)};
  dlg.querySelector('[data-cancel]').onclick=()=>done(null,Error('Configuração da ficha cancelada. A venda continua salva.'));
  input.onchange=async()=>{
   const file=input.files?.[0];if(!file)return;
   try{
    const buffer=await file.arrayBuffer();
    const verified=await verifyODT(buffer);
    const bytes=new Uint8Array(buffer);
    let binary='';
    for(let i=0;i<bytes.length;i+=16000)binary+=String.fromCharCode(...bytes.subarray(i,i+16000));
    try{localStorage.setItem(LOCAL_MODEL_KEY,btoa(binary))}catch(err){console.warn('Não foi possível memorizar o modelo:',err)}
    done(verified);
   }catch(err){error.textContent='Arquivo inválido: '+err.message;input.value=''}
  };
  document.body.appendChild(dlg);dlg.showModal();
 });
}
async function loadModel(){
 if(!cachedTemplate)cachedTemplate=(async()=>{
  let cause='';
  try{
   const saved=localStorage.getItem(LOCAL_MODEL_KEY);
   if(saved){
    const raw=atob(saved),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return await verifyODT(bytes.buffer);
   }
  }catch(err){cause=err.message;localStorage.removeItem(LOCAL_MODEL_KEY)}
  try{
   const r=await fetch(templatePath,{cache:'no-store'});
   if(!r.ok)throw Error('Erro HTTP '+r.status+' ao carregar modelo ODT.');
   return await verifyODT(await r.arrayBuffer());
  }catch(err){cause=err.message}
  const selected=await chooseOriginalModel(cause);
  if(!selected)throw Error('Não foi possível configurar o modelo.');
  return selected;
 })().catch(err=>{cachedTemplate=null;throw err});
 return cachedTemplate;
}
function filename(d){return(d.stage==='vendido'?'FICHA_VENDA_':'PREVIA_VENDA_')+String(d.name||'CLIENTE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'_').slice(0,55)+'_'+(d.saleDate||new Date().toISOString().slice(0,10))+'.odt'}

async function makeOriginalSaleODT(d,stock){
 const files=await loadModel(),map=values(d,stock);let replacements=0;
 const filled=files.map(file=>{
  if(file.name!=='content.xml')return file;
  const xml=decoder.decode(file.data).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,(_,key)=>{replacements++;return xmlEscape(map[key]??'')});
  return{name:file.name,data:utf8.encode(xml)};
 });
 if(replacements<35)throw Error('A ficha de vendas não possui os campos esperados.');
 return zipStored(filled);
}
let cachedTermModel;
async function loadTermModel(){
 if(!cachedTermModel)cachedTermModel=(async()=>{
  const r=await fetch(termTemplatePath,{cache:'no-store'});
  if(!r.ok)throw Error('Não foi possível buscar o Termo original (.ODT): HTTP '+r.status);
  const files=await unzip(await r.arrayBuffer());
  const content=files.find(f=>f.name==='content.xml');
  if(!content||!files.some(f=>f.name==='mimetype'))throw Error('O Termo de Responsabilidade não contém os arquivos ODT obrigatórios.');
  const xml=decoder.decode(content.data);
  if((xml.match(/\{\{[a-zA-Z0-9_]+\}\}/g)||[]).length<20||!xml.includes('{{registeredOwner}}')||!xml.includes('{{maritalStatus}}'))
    throw Error('O modelo de Termo publicado está incompleto.');
  return files;
 })().catch(e=>{cachedTermModel=null;throw e});
 return cachedTermModel;
}
function termFields(d,stock){
 const base=values(d,stock),f=d.ficha||{};
 // O termo usa o endereço sem repetir a palavra Rua quando ela já aparece no cadastro.
 const street=String(f.street||'').trim().replace(/^rua\s+/i,'');
 const inputDate=String(d.saleDate||f.transactionDate||'');
 let day='',month='',year='';
 if(/^\d{4}-\d\d-\d\d$/.test(inputDate)){
  const [y,m,dd]=inputDate.split('-');
  day=dd;year=y;
  month=['','JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'][Number(m)]||'';
 }
 const time=String(f.termTime||'');
 const [hour='',minute='']=/^\d\d:\d\d$/.test(time)?time.split(':'):[];
 return {...base,street,maritalStatus:f.maritalStatus||'',addressNumber:f.addressNumber||'',
  dut:f.dut||'',registeredOwner:f.registeredOwner||'',vehicleType:'USADO',
  saleDay:day,saleMonth:month,saleYear:year,saleHour:hour,saleMinute:minute};
}
async function makeTermODT(d,stock){
 const files=await loadTermModel(),map=termFields(d,stock);let replacements=0;
 const filled=files.map(file=>{
  if(file.name!=='content.xml')return file;
  const xml=decoder.decode(file.data).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,(_,key)=>{
   replacements++;
   const v=map[key];
   return xmlEscape(v==null||String(v).trim()===''?'__________':v);
  });
  return{name:file.name,data:utf8.encode(xml)};
 });
 if(replacements<20)throw Error('Termo de Responsabilidade sem campos para preenchimento.');
 return zipStored(filled);
}
function safeName(d){return String(d.name||'CLIENTE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'_').slice(0,52)}
function downloadBytes(bytes,name,mime){
 const u=URL.createObjectURL(new Blob([bytes],{type:mime})),a=document.createElement('a');
 a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(u),90000);
}
async function generatePackage(d,stock){
 // Um único ZIP evita bloqueio de múltiplos downloads automáticos pelo Chrome/Edge.
 const [saleDoc,termDoc]=await Promise.all([makeOriginalSaleODT(d,stock),makeTermODT(d,stock)]);
 const buyer=safeName(d),isSale=d.stage==='vendido',stamp=d.saleDate||new Date().toISOString().slice(0,10);
 const files=[
  {name:(isSale?'01_FICHA_DE_VENDA_':'01_PREVIA_FICHA_DE_VENDA_')+buyer+'.odt',data:saleDoc},
  {name:(isSale?'02_TERMO_RESPONSABILIDADE_COMPRADOR_':'02_PREVIA_TERMO_RESPONSABILIDADE_')+buyer+'.odt',data:termDoc}
 ];
 const bundle=zipStored(files);
 downloadBytes(bundle,(isSale?'DOCUMENTOS_VENDA_':'PREVIA_DOCUMENTOS_')+buyer+'_'+stamp+'.zip','application/zip');
 return bundle.length;
}
function feedback(message){const m=$('usedMsg');if(m){m.hidden=false;m.textContent=message}}
async function issue(d,stock){
 try{
  await generatePackage(d,stock);
  feedback('Pacote gerado! Confira Downloads: o ZIP contém a ficha de venda e o Termo de Responsabilidade em .ODT.');
 }catch(err){
  feedback('Não foi possível gerar os documentos: '+err.message);
  alert('Falha ao preparar o pacote de documentos: '+err.message);
 }
}
function draft(){
 const f=window.usadosFichaCapture?.()||{};
 const api=window.usadosFichaAccess;
 return{name:$('udName').value.trim(),phone:$('udPhone').value.trim(),vehicleId:$('udVehicle').value,price:Number($('udPrice').value||0),saleDate:$('udSaleDate').value,stage:$('udStage').value,ficha:f,stock:api?.getStock()||[]};
}
function install(){
 const pdfButton=$('usedPrintFicha'),area=$('usadosArea');
 if(!pdfButton||!area)return;
 function relabel(){pdfButton.textContent=$('udStage').value==='vendido'?'BAIXAR PACOTE (2 DOCUMENTOS)':'GERAR PRÉVIA (2 DOCUMENTOS)';pdfButton.hidden=false}
 const formerOpen=window.usadosFichaOpen;
 window.usadosFichaOpen=d=>{formerOpen?.(d);relabel()};
 $('udStage').addEventListener('change',relabel);
 pdfButton.onclick=async()=>{const d=draft();if(!d.name){alert('Informe o nome do cliente.');return}if(!d.vehicleId){alert('Selecione um veículo do estoque.');return}await issue(d,d.stock)};
 // Ao salvar uma venda, este método substitui o antigo gerador PDF.
 window.usadosFichaAfterSale=async(d,stock)=>await issue(d,stock);
 const originalButton=$('usedCompleteSale');if(originalButton)originalButton.textContent='EFETIVAR VENDA + GERAR 2 DOCUMENTOS';
 // Intercepta a segunda via antes do antigo listener do PDF.
 area.addEventListener('click',e=>{
  const b=e.target.closest('[data-print-ficha]');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  const api=window.usadosFichaAccess,d=api?.getDeals().find(x=>x.id===b.dataset.printFicha);
  if(d)issue(d,api.getStock());else alert('Cliente não encontrado.');
 },true);
 // Cards são reconstruídos a cada renderização; ajuste o texto após cada renderização.
 const renameCards=()=>area.querySelectorAll('[data-print-ficha]').forEach(b=>{if(b.textContent!=='PACOTE DE DOCUMENTOS')b.textContent='PACOTE DE DOCUMENTOS'});
 renameCards();new MutationObserver(renameCards).observe($('usedContent'),{childList:true,subtree:true});
}
install();
})();