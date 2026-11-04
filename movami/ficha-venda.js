/* MOVAMI — impressão do RESUMO DE VENDAS baseado na ficha fornecida. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>{if(v==null||String(v).trim()==='')return '____________';const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):esc(v)};
const date=v=>v?String(v).split('-').reverse().join('/'):'____________';
const orBlank=v=>v==null||String(v).trim()===''?'________________':esc(v);
const fields=[
 ['cpf','CPF / CNPJ','text'],['birthday','Data de nascimento','date'],
 ['rg','RG','text'],['rgIssued','Data de emissão do RG','date'],
 ['street','Endereço / Rua','text'],['district','Bairro','text'],
 ['city','Cidade','text'],['state','UF','text'],['cep','CEP','text'],
 ['phoneWork','Telefone comercial','text'],['phoneHome','Telefone residencial','text'],
 ['invoiceValue','Valor da Nota Fiscal (R$)','number'],
 ['transactionDate','Data da transação','date'],['invoiceDate','Data de emissão da NF','date'],
 ['receivedInvoice','Nota fiscal de entrada (R$)','number'],
 ['intermediate','Recebimento intermediário?','select'],
 ['tradeIn','Veículo recebido / identificação','text'],['tradeInAmount','Valor do veículo recebido (R$)','number'],
 ['checkCash','Cheque à vista (R$)','number'],['checkNumber','Cheque / identificação','text'],['checkAmount','Valor do cheque (R$)','number'],
 ['duplicataNumber','Duplicata / identificação','text'],['duplicataAmount','Valor da duplicata (R$)','number'],
 ['deposit','Depósito / PIX (R$)','number'],['cash','Dinheiro / dólar (R$)','number'],
 ['financed','Leasing / financiamento (R$)','number'],['financeType','Modalidade','select'],
 ['consortiumAdmin','Administradora de consórcio','text'],['consortiumType','Consórcio','select'],
 ['groupQuota','Grupo / cota','text'],['consortiumCredit','Crédito do consórcio (R$)','number'],
 ['paidInvoice','Nota fiscal — pagamentos (R$)','number'],['paidAdm','Devolução administrativa (R$)','number'],
 ['paidReferral','Indicação de venda (R$)','number'],['paidDispatcher','Devolução despachante (R$)','number'],
 ['paidInsurance','Devolução seguro (R$)','number'],['paidOther','Outras devoluções (R$)','number'],
 ['paidParts','Devolução peças / serviços (R$)','number'],['paidPayoff','Quitação (R$)','number'],
 ['fi','F&I — responsável','text'],['financer','Financiador / condições / arrendatário','text'],
 ['sellerCode','Código do vendedor','text'],['sellerName','Nome do vendedor','text'],
 ['commission','Comissão (R$)','number']
];
const personal=new Set(['cpf','birthday','rg','rgIssued','street','district','city','state','cep','phoneWork','phoneHome']);
const financial=new Set(['receivedInvoice','intermediate','tradeIn','tradeInAmount','checkCash','checkNumber','checkAmount','duplicataNumber','duplicataAmount','deposit','cash','financed','financeType','consortiumAdmin','consortiumType','groupQuota','consortiumCredit','paidInvoice','paidAdm','paidReferral','paidDispatcher','paidInsurance','paidOther','paidParts','paidPayoff']);
const selectOptions={intermediate:[['','Não informado'],['sim','Sim'],['nao','Não']],financeType:[['','Não informado'],['leasing','Leasing'],['financiamento','Financiamento']],consortiumType:[['','Não informado'],['aquisicao','Aquisição'],['alienado','Alienado']]};
function fieldRow(item){
const [k,label,type]=item;
let input;
if(type==='select')input='<select id="uf_'+k+'">'+selectOptions[k].map(a=>'<option value="'+esc(a[0])+'">'+esc(a[1])+'</option>').join('')+'</select>';
else input='<input id="uf_'+k+'" type="'+type+'"'+(type==='number'?' min="0" step=".01"':'')+(k==='state'?' maxlength="2"':'')+'>';
return '<label>'+esc(label)+input+'</label>';
}
const target=$('usedDealForm');
if(!target)return;
const block=document.createElement('details');block.id='usedFichaDetails';
block.innerHTML='<summary>FICHA DE VENDA — PREENCHIMENTO COMPLEMENTAR</summary><p class="muted">O cliente, o veículo, o valor negociado e a data da venda são recuperados automaticamente do CRM. Preencha somente os dados adicionais que constarão no RESUMO DE VENDAS.</p><h3>IDENTIFICAÇÃO DO COMPRADOR</h3><div class="uf-grid">'+fields.filter(f=>personal.has(f[0])).map(fieldRow).join('')+'</div><h3>NOTA FISCAL E TRANSAÇÃO</h3><div class="uf-grid">'+fields.filter(f=>['invoiceValue','transactionDate','invoiceDate'].includes(f[0])).map(fieldRow).join('')+'</div><h3>RECEBIMENTOS E PAGAMENTOS</h3><div class="uf-grid">'+fields.filter(f=>financial.has(f[0])).map(fieldRow).join('')+'</div><h3>VENDEDOR / F&I</h3><div class="uf-grid">'+fields.filter(f=>['fi','financer','sellerCode','sellerName','commission'].includes(f[0])).map(fieldRow).join('')+'</div><p class="muted">Dados não informados aparecerão em branco na impressão. Os valores não são inventados nem somados automaticamente ao preço de venda.</p>';
const docs=target.querySelector('.used-docs');target.insertBefore(block,docs);
const style=document.createElement('style');
style.textContent='#usedFichaDetails{background:#fafafa;border:1px solid #e0c76f;border-left:5px solid #ffcf00;border-radius:10px;padding:12px}#usedFichaDetails summary{font-size:13px;font-weight:900;cursor:pointer}#usedFichaDetails h3{margin:17px 0 10px;font-size:12px;border-bottom:1px solid #ddd;padding-bottom:5px}#usedFichaDetails .uf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#usedFichaDetails label{display:grid;gap:4px;font-weight:700;font-size:12px}#usedFichaDetails input,#usedFichaDetails select{width:100%;padding:9px;border:1px solid #bbb;border-radius:7px;font:inherit}@media(max-width:650px){#usedFichaDetails .uf-grid{grid-template-columns:1fr}}';
document.head.appendChild(style);
const printBtn=document.createElement('button');printBtn.type='button';printBtn.id='usedPrintFicha';printBtn.textContent='FICHA / PDF';printBtn.style.background='#ffcf00';
target.querySelector('.used-actions').insertBefore(printBtn,$('usedCancelDeal'));
function getData(){const x={};for(const [k] of fields)x[k]=$('uf_'+k).value.trim();return x}
function setData(d){const f=d?.ficha||{};for(const [k] of fields)$('uf_'+k).value=f[k]??'';block.open=d?.stage==='vendido';printBtn.hidden=d?.stage!=='vendido'}
window.usadosFichaCapture=getData;
window.usadosFichaOpen=setData;
$('udStage').addEventListener('change',()=>{if($('udStage').value==='vendido')block.open=true;printBtn.hidden=$('udStage').value!=='vendido'});
function line(label,value){return '<div class="f-line"><span>'+label+'</span><b>'+orBlank(value)+'</b></div>'}
function amountLine(label,value){return '<div class="f-amount"><span>'+esc(label)+'</span><strong>'+money(value)+'</strong></div>'}
function sumValues(f,keys){const valid=keys.map(k=>f[k]).filter(v=>v!==''&&v!=null);if(!valid.length)return '';return valid.reduce((s,v)=>s+Number(v||0),0)}
function buildReceipt(f){
 const rows=[
  ['Nota fiscal de entrada',f.receivedInvoice],['Veículo recebido: '+(f.tradeIn||'—'),f.tradeInAmount],
  ['Cheque à vista',f.checkCash],['Cheque: '+(f.checkNumber||'—'),f.checkAmount],
  ['Duplicata: '+(f.duplicataNumber||'—'),f.duplicataAmount],
  ['Depósito / PIX',f.deposit],['Dinheiro / Dólar',f.cash],
  ['Leasing / Financ.: '+({leasing:'Leasing',financiamento:'Financiamento'}[f.financeType]||'—'),f.financed],
  ['Consórcio: '+(f.consortiumAdmin||'—'),f.consortiumCredit]
 ];
 return '<div class="f-fin-head">RECEBIMENTOS</div><div class="f-fin-sub">Nota fiscal de entrada '+orBlank(f.receivedInvoice)+' &nbsp; Interm.: '+(f.intermediate==='sim'?'☑':f.intermediate==='nao'?'☐':'—')+'</div>'+
 rows.slice(1).map(r=>amountLine(r[0],r[1])).join('')+
 '<div class="f-fin-sub">Consórcio: '+orBlank(f.consortiumType)+' &nbsp; Grupo / Cota: '+orBlank(f.groupQuota)+'</div>'+
 '<div class="f-fin-total">'+amountLine('TOTAL RECEBIMENTOS',sumValues(f,['receivedInvoice','tradeInAmount','checkCash','checkAmount','duplicataAmount','deposit','cash','financed','consortiumCredit']))+'</div>';
}
function buildPayments(f){
const rows=[
 ['Nota fiscal',f.paidInvoice],['Devolução administrativa',f.paidAdm],['Indicação de venda',f.paidReferral],
 ['Devolução despachante',f.paidDispatcher],['Devolução seguro',f.paidInsurance],
 ['Outras devoluções',f.paidOther],['Devolução peças / serviços',f.paidParts],['Quitação',f.paidPayoff]
];
return '<div class="f-fin-head">PAGAMENTOS DE:</div>'+rows.map(r=>amountLine(r[0],r[1])).join('')+
'<div class="f-fin-total">'+amountLine('TOTAL PAGAMENTOS',sumValues(f,['paidInvoice','paidAdm','paidReferral','paidDispatcher','paidInsurance','paidOther','paidParts','paidPayoff']))+'</div>';
}
function template(d,stock,auto){
 const f=d.ficha||{};
 const v=stock.find(x=>x.id===d.vehicleId)||{};
 const fullName=[v.brand,v.model,v.version].filter(Boolean).join(' ');
 const dateTransaction=f.transactionDate||d.saleDate||'';
 const nfValue=f.invoiceValue!==''&&f.invoiceValue!=null?f.invoiceValue:d.price;
 const html=[
 '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ficha de Venda — '+esc(d.name)+'</title>',
 '<style>@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#eeeeee;font-family:"Times New Roman",serif;color:#151515} .toolbar{background:#171717;color:white;padding:12px 17px;display:flex;align-items:center;justify-content:space-between;gap:10px;font:13px Arial,sans-serif}.toolbar button{background:#ffcf00;border:0;border-radius:7px;padding:10px 15px;font-weight:700;cursor:pointer}.page{width:190mm;min-height:274mm;margin:15px auto;background:#fff;padding:6mm 6mm 5mm;box-shadow:0 3px 20px #0002;font-size:11.2pt}.f-title{text-align:center;color:green;font-size:17pt;text-decoration:underline;margin:0 0 12px;font-weight:700}.f-subtitle{color:green;text-align:center;font-weight:bold;font-size:12pt;margin:18px 0 12px}.f-row{display:flex;gap:14px;flex-wrap:nowrap;margin:8px 0;align-items:baseline}.f-line{display:flex;gap:5px;align-items:baseline;flex:1;min-width:0}.f-line span{white-space:nowrap;font-size:10.2pt}.f-line b{display:block;border-bottom:1px solid #222;min-width:28px;min-height:15px;flex:1;font-size:10pt;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:4px}.f-line.wide{flex:2}.f-divider{margin-top:12px}.f-fin-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #333;min-height:128mm}.f-fin-col{display:flex;flex-direction:column;min-width:0}.f-fin-col+.f-fin-col{border-left:1px solid #333}.f-fin-head{text-align:center;border-bottom:1px solid #333;font-weight:700;color:green;padding:6px 4px;font-size:11pt}.f-fin-sub{font-size:9pt;padding:7px 6px;min-height:26px}.f-amount{display:flex;gap:5px;align-items:baseline;justify-content:space-between;border-bottom:1px dotted #ddd;margin:2px 6px;padding:5px 0;min-height:26px;font-size:9.4pt}.f-amount span{min-width:0;overflow-wrap:anywhere}.f-amount strong{font-size:9.2pt;text-align:right;white-space:nowrap;font-weight:600}.f-fin-total{border-top:1px solid #333;margin-top:auto;padding:1px;background:#fbfbfb;color:green;font-weight:700}.f-fin-total .f-amount{font-size:10.4pt;margin:0 5px}.f-currency{color:red;font-weight:700}.f-bottom{margin-top:10px}.f-signs{display:flex;gap:12mm;margin-top:23mm;text-align:center;align-items:end}.f-signs div{flex:1;border-top:1px solid #222;padding-top:3px;font-size:9.5pt;font-weight:700}.small{font-size:9.5pt}.f-label{font-weight:700}@media print{body{background:white}.toolbar{display:none!important}.page{width:auto;min-height:0;margin:0;box-shadow:none;padding:0;font-size:10.2pt}.f-title{font-size:15pt}.f-row{margin:6px 0}.f-subtitle{margin:13px 0 9px}.f-fin-grid{min-height:121mm}.f-signs{margin-top:15mm}.f-amount{padding:4px 0;min-height:24px}}</style></head><body>',
 '<div class="toolbar"><span>RESUMO DE VENDAS — '+esc(d.name)+' | Use "Salvar como PDF" na impressão</span><div><button onclick="window.print()">IMPRIMIR / SALVAR PDF</button> <button onclick="window.close()">FECHAR</button></div></div>',
 '<main class="page">',
 '<h1 class="f-title">RESUMO DE VENDAS</h1>',
 '<div class="f-row">'+line('CGC / CPF',f.cpf)+line('Data de Nascimento',date(f.birthday))+'</div>',
 '<div class="f-row">'+line('RG',f.rg)+line('Data emissão da Carteira',date(f.rgIssued))+'</div>',
 '<div class="f-row">'+line('Nome:',d.name)+'</div>',
 '<div class="f-row">'+line('Endereço / RUA:',f.street)+'</div>',
 '<div class="f-row">'+line('Bairro:',f.district)+line('Cidade:',f.city)+line('Estado:',f.state)+line('CEP:',f.cep)+'</div>',
 '<div class="f-row">'+line('Telef. Com.:',f.phoneWork)+line('Residencial:',f.phoneHome)+line('Celular:',d.phone)+'</div>',
 '<h2 class="f-subtitle">VEÍCULO PROPOSTO PARA TRANSAÇÃO</h2>',
 '<div class="f-row">'+line('Nº Chassis:',v.chassis)+line('Ano / Modelo:',v.year)+'</div>',
 '<div class="f-row">'+line('Tipo:', 'Usado')+line('Marca:',v.brand)+line('Modelo:',[v.model,v.version].filter(Boolean).join(' '))+'</div>',
 '<div class="f-row">'+line('Cor:',v.color)+line('PLACA:',v.plate)+'<div class="f-line"><span class="f-currency">VALOR NF R$</span><b>'+money(nfValue)+'</b></div></div>',
 '<div class="f-fin-grid"><section class="f-fin-col">'+buildReceipt(f)+'</section><section class="f-fin-col">'+buildPayments(f)+'</section></div>',
 '<div class="f-bottom"><div class="f-row"><div style="flex:1"></div><div class="f-line"><span class="f-currency">F&amp;I:</span><b>'+orBlank(f.fi)+'</b></div></div>',
 '<div class="f-row">'+line('Financiador / Condições / Arrendatário(a): Nome:',f.financer)+'</div>',
 '<div class="f-row">'+line('Cod. Vendedor:',f.sellerCode)+line('Nome:',f.sellerName)+'</div>',
 '<div class="f-row">'+line('Comissão:',f.commission?money(f.commission):'')+'<div class="f-line"><span class="f-label">VALOR VENDA R$</span><b>'+money(d.price)+'</b></div></div>',
 '<div class="f-row">'+line('Data da Transação:',date(dateTransaction))+line('Data Emissão N.F.:',date(f.invoiceDate))+'</div></div>',
 '<div class="f-signs"><div>Visto Responsável</div><div>Visto F&amp;I</div><div>Assinatura do CLIENTE</div></div>',
 '</main>',
 auto?'<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},500)})<\/script>':'',
 '</body></html>'
 ];
 return html.join('');
}

/* Geração nativa e independente de PDF (A4), sem pop-ups ou bibliotecas externas.
   Fontes padrão PDF, caracteres em Windows-1252. */
function bytes1252(s) {
 const specials={8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,8249:139,338:140,381:142,8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,353:154,8250:155,339:156,382:158,376:159};
 const out=[];
 for(const ch of String(s)){
  const code=ch.codePointAt(0);
  out.push(code<=255?code:(specials[code]??63));
 }
 return new Uint8Array(out);
}
function makePDF(d,stock) {
 const f=d.ficha||{},v=(stock||[]).find(x=>x.id===d.vehicleId)||{};
 const moneyStr=x=>x===undefined||x===null||x===''?'________________':money(x);
 const val=x=>x==null||x===''?'________________':String(x);
 const fmt=x=>x?date(x):'________________';
 const trim=(s,n)=>String(s||'').length>n?String(s).slice(0,n-1)+'…':String(s);
 const pdfEscape=s=>String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\r\n]/g,' ');
 const content=[];
 const text=(x,y,s,sz=9,bold=false)=>content.push('BT /'+(bold?'F2':'F1')+' '+sz+' Tf 1 0 0 1 '+x+' '+y+' Tm ('+pdfEscape(s)+') Tj ET');
 const line=(x1,y1,x2,y2,width=.5)=>content.push(width+' w '+x1+' '+y1+' m '+x2+' '+y2+' l S');
 const labeled=(x,y,label,value,max=48)=>text(x,y,trim(label+':  '+val(value),max));
 const brl=(x,y,label,v)=>text(x,y,trim(label,32),8.4);
 const amount=(x,y,v)=>text(x,y,moneyStr(v),8.7,true);
 const company='MOVAMI — CONTROLE DE VENDAS DE USADOS';
 text(174,819,company,9,true);line(38,812,557,812,.6);
 text(202,788,'RESUMO DE VENDAS',16,true);
 labeled(40,765,'CGC / CPF',f.cpf,46);labeled(317,765,'Data de Nascimento',fmt(f.birthday),46);
 labeled(40,744,'RG',f.rg,47);labeled(317,744,'Data emissão RG',fmt(f.rgIssued),46);
 labeled(40,723,'Nome',d.name,97);
 labeled(40,702,'Endereço / Rua',f.street,96);
 labeled(40,681,'Bairro',f.district,46);labeled(317,681,'Cidade',f.city,46);
 labeled(40,660,'Estado',f.state,46);labeled(317,660,'CEP',f.cep,46);
 labeled(40,639,'Telef. Comercial',f.phoneWork,45);labeled(317,639,'Residencial',f.phoneHome,45);
 labeled(40,619,'Celular',d.phone,52);
 line(38,608,557,608,.5);
 text(185,590,'VEÍCULO PROPOSTO PARA TRANSAÇÃO',11,true);
 labeled(40,572,'Nº Chassis',v.chassis,52);labeled(317,572,'Ano / Modelo',v.year,43);
 labeled(40,554,'Tipo','Usado',28);labeled(170,554,'Marca',v.brand,31);labeled(330,554,'Modelo',[v.model,v.version].filter(Boolean).join(' '),42);
 labeled(40,536,'Cor',v.color,27);labeled(170,536,'Placa',v.plate,29);text(330,536,'VALOR NF R$: '+moneyStr(f.invoiceValue),8.9,true);
 // Quadro financeiro fiel à separação da ficha original
 line(38,526,557,526,1);line(38,526,38,301,.7);line(557,526,557,301,.7);line(296,526,296,301,.7);
 text(112,511,'RECEBIMENTOS',11,true);text(379,511,'PAGAMENTOS DE:',11,true);
 line(38,504,557,504,.5);
 const receipts=[
  ['Nota Fiscal de entrada',f.receivedInvoice],
  ['Veículo recebido',f.tradeInAmount],
  ['Cheque à vista',f.checkCash],
  ['Cheque / '+(f.checkNumber||'nº'),f.checkAmount],
  ['Duplicata / '+(f.duplicataNumber||'nº'),f.duplicataAmount],
  ['Depósito / PIX',f.deposit],['Dinheiro / Dólar',f.cash],
  ['Leasing / Financiamento',f.financed],
  ['Consórcio / Crédito',f.consortiumCredit]
 ];
 const payments=[
  ['Nota Fiscal',f.paidInvoice],['Devolução Administrativa',f.paidAdm],
  ['Indicação de Venda',f.paidReferral],['Devolução Despachante',f.paidDispatcher],
  ['Devolução Seguro',f.paidInsurance],['Outras Devoluções',f.paidOther],
  ['Devolução Peças / Serviços',f.paidParts],['Quitação',f.paidPayoff]
 ];
 for(let i=0;i<9;i++) {
  const y=487-i*19;
  if(receipts[i]){text(44,y,trim(receipts[i][0],28),8.2);text(205,y,moneyStr(receipts[i][1]),7.8,true)}
  if(payments[i]){text(301,y,trim(payments[i][0],27),8.2);text(466,y,moneyStr(payments[i][1]),7.8,true)}
  line(42,y-6,292,y-6,.18);line(300,y-6,553,y-6,.18);
 }
 const numericSum=(keys)=>{const items=keys.map(k=>f[k]).filter(v=>v!==undefined&&v!==null&&v!=='');return items.length?items.reduce((a,b)=>a+Number(b||0),0):null};
 const receiptSum=numericSum(['receivedInvoice','tradeInAmount','checkCash','checkAmount','duplicataAmount','deposit','cash','financed','consortiumCredit']);
 const paymentsSum=numericSum(['paidInvoice','paidAdm','paidReferral','paidDispatcher','paidInsurance','paidOther','paidParts','paidPayoff']);
 line(38,320,557,320,.8);
 text(45,307,'TOTAL: '+(receiptSum===null?'____________':money(receiptSum)),9,true);
 text(303,307,'TOTAL: '+(paymentsSum===null?'____________':money(paymentsSum)),9,true);
 line(38,301,557,301,.7);
 labeled(40,283,'Veículo de entrada',f.tradeIn,50);
 labeled(318,283,'Intermediário',f.intermediate==='sim'?'SIM':f.intermediate==='nao'?'NÃO':null,45);
 labeled(40,264,'Consórcio ADM',f.consortiumAdmin,53);
 labeled(318,264,'Grupo / Cota',f.groupQuota,46);
 labeled(40,245,'Consórcio',f.consortiumType,47);
 labeled(318,245,'Modalidade',f.financeType,45);
 labeled(40,225,'F&I',f.fi,93);
 labeled(40,206,'Financiador / Condições / Arrendatário',f.financer,95);
 labeled(40,187,'Código vendedor',f.sellerCode,44);
 labeled(318,187,'Vendedor',f.sellerName,44);
 text(40,168,'Comissão: '+moneyStr(f.commission),9);
 text(318,168,'VALOR VENDA: '+moneyStr(d.price),9.2,true);
 labeled(40,149,'Data da Transação',fmt(f.transactionDate||d.saleDate),48);
 labeled(318,149,'Data emissão N.F.',fmt(f.invoiceDate),46);
 line(39,82,195,82,.75);line(219,82,375,82,.75);line(399,82,556,82,.75);
 text(70,67,'Visto Responsável',9);text(281,67,'Visto F&I',9);text(424,67,'Assinatura do CLIENTE',9);
 text(39,40,'Ficha gerada pelo CRM MOVAMI em '+new Date().toLocaleDateString('pt-BR'),7);
 const stream=content.join('\n')+'\n';
 const parts=[];let count=0;
 const append=s=>{const data=bytes1252(s);parts.push(data);count+=data.length};
 const offsets=[0];
 append('%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n');
 const objects=[
 '<< /Type /Catalog /Pages 2 0 R >>',
 '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
 '<< /Length '+bytes1252(stream).length+' >>\nstream\n'+stream+'endstream'
 ];
 objects.forEach((obj,i)=>{offsets.push(count);append((i+1)+' 0 obj\n'+obj+'\nendobj\n')});
 const xref=count;
 append('xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n');
 for(let i=1;i<offsets.length;i++)append(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 append('trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
 const out=new Uint8Array(count);let at=0;for(const p of parts){out.set(p,at);at+=p.length}
 return new Blob([out],{type:'application/pdf'});
}
function fileName(d){return 'FICHA_VENDA_'+String(d.name||'CLIENTE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'_').slice(0,45)+'_'+(d.saleDate||new Date().toISOString().slice(0,10))+'.pdf'}
function pdfDownload(d,stock){
 const blob=makePDF(d,stock);
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=fileName(d);a.style.display='none';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
 return blob.size;
}
// Disponível no console somente para testes manuais. Não envia informações à rede.
window.usadosGerarPdf=pdfDownload;
window.usadosFichaReserve=()=>null;
window.usadosFichaAfterSale=(d,stock)=>{
 try{
  const size=pdfDownload(d,stock);
  const msg=$('usedMsg');if(msg){msg.hidden=false;msg.textContent='Venda salva! PDF gerado ('+Math.round(size/1024)+' KB). Confira Downloads. Para outra via, clique em FICHA / PDF.'}
 }catch(err){alert('Venda salva, mas o PDF não foi gerado. Clique em FICHA / PDF para tentar novamente. Detalhe: '+err.message)}
};
function printSaved(id){
 const api=window.usadosFichaAccess;
 const d=api?.getDeals().find(x=>x.id===id);
 if(!d){alert('Cliente não encontrado');return}
 try{pdfDownload(d,api.getStock());const msg=$('usedMsg');if(msg){msg.hidden=false;msg.textContent='PDF gerado! Confira a pasta de Downloads.'}}catch(err){alert('Erro ao gerar PDF: '+err.message)}
}
printBtn.textContent='BAIXAR PDF DA VENDA';
printBtn.onclick=()=>{
 const api=window.usadosFichaAccess;
 const d=api?.getDeals().find(x=>x.id===window.usadosFichaCurrentId);
 if(d)printSaved(d.id);
 else alert('Salve a ficha antes de baixar o PDF.');
};
const origOpen=window.usadosFichaOpen;
window.usadosFichaOpen=d=>{window.usadosFichaCurrentId=d?.id||null;origOpen(d)};
$('usadosArea').addEventListener('click',e=>{
 const btn=e.target.closest('[data-print-ficha]');
 if(!btn)return;
 e.preventDefault();e.stopPropagation();printSaved(btn.dataset.printFicha);
});
})();