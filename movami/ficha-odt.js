/* Ficha MOVAMI em OpenDocument Text (.odt), usando o modelo de Writer do cliente. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const utf8=new TextEncoder(), decoder=new TextDecoder();
const templatePath='./modelo-resumo-vendas.odt?v=1';
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
let cachedTemplate;
async function loadModel(){
 if(!cachedTemplate)cachedTemplate=(async()=>{
  const r=await fetch(templatePath,{cache:'no-store'});
  if(!r.ok)throw Error('Não foi possível buscar o modelo original ODT ('+r.status+').');
  const files=await unzip(await r.arrayBuffer());
  if(!files.some(f=>f.name==='content.xml')||!files.some(f=>f.name==='mimetype'))throw Error('O modelo ODT está incompleto.');
  return files;
 })().catch(e=>{cachedTemplate=null;throw e});
 return cachedTemplate;
}
function filename(d){return(d.stage==='vendido'?'FICHA_VENDA_':'PREVIA_VENDA_')+String(d.name||'CLIENTE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'_').slice(0,55)+'_'+(d.saleDate||new Date().toISOString().slice(0,10))+'.odt'}
async function generate(d,stock){
 const files=await loadModel(),map=values(d,stock);let replacements=0;
 const filled=files.map(file=>{
  if(file.name!=='content.xml')return file;
  const xml=decoder.decode(file.data).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,(_,key)=>{replacements++;return xmlEscape(map[key]??'')});
  return{name:file.name,data:utf8.encode(xml)};
 });
 if(replacements<35)throw Error('O modelo ODT não possui os campos esperados.');
 const out=zipStored(filled),url=URL.createObjectURL(new Blob([out],{type:'application/vnd.oasis.opendocument.text'}));
 const a=document.createElement('a');a.href=url;a.download=filename(d);document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),90000);
 return out.length;
}
function feedback(message){const m=$('usedMsg');if(m){m.hidden=false;m.textContent=message}}
async function issue(d,stock){
 try{await generate(d,stock);feedback('Documento do LibreOffice Writer (.ODT) gerado! Confira sua pasta Downloads.')}
 catch(err){feedback('Não foi possível gerar a ficha Writer: '+err.message);alert('Falha ao gerar ODT: '+err.message)}
}
function draft(){
 const f=window.usadosFichaCapture?.()||{};
 const api=window.usadosFichaAccess;
 return{name:$('udName').value.trim(),phone:$('udPhone').value.trim(),vehicleId:$('udVehicle').value,price:Number($('udPrice').value||0),saleDate:$('udSaleDate').value,stage:$('udStage').value,ficha:f,stock:api?.getStock()||[]};
}
function install(){
 const pdfButton=$('usedPrintFicha'),area=$('usadosArea');
 if(!pdfButton||!area)return;
 function relabel(){pdfButton.textContent=$('udStage').value==='vendido'?'BAIXAR FICHA WRITER (.ODT)':'GERAR PRÉVIA WRITER (.ODT)';pdfButton.hidden=false}
 const formerOpen=window.usadosFichaOpen;
 window.usadosFichaOpen=d=>{formerOpen?.(d);relabel()};
 $('udStage').addEventListener('change',relabel);
 pdfButton.onclick=async()=>{const d=draft();if(!d.name){alert('Informe o nome do cliente.');return}if(!d.vehicleId){alert('Selecione um veículo do estoque.');return}await issue(d,d.stock)};
 // Ao salvar uma venda, este método substitui o antigo gerador PDF.
 window.usadosFichaAfterSale=async(d,stock)=>await issue(d,stock);
 const originalButton=$('usedCompleteSale');if(originalButton)originalButton.textContent='EFETIVAR VENDA + GERAR FICHA WRITER';
 // Intercepta a segunda via antes do antigo listener do PDF.
 area.addEventListener('click',e=>{
  const b=e.target.closest('[data-print-ficha]');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  const api=window.usadosFichaAccess,d=api?.getDeals().find(x=>x.id===b.dataset.printFicha);
  if(d)issue(d,api.getStock());else alert('Cliente não encontrado.');
 },true);
 // Cards são reconstruídos a cada renderização; ajuste o texto após cada renderização.
 const renameCards=()=>area.querySelectorAll('[data-print-ficha]').forEach(b=>b.textContent='FICHA WRITER (.ODT)');
 renameCards();new MutationObserver(renameCards).observe($('usedContent'),{childList:true,subtree:true});
}
install();
})();