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
function reserve(){const w=window.open('','_blank');if(w){w.document.write('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Preparando ficha de venda</title><body style="font-family:Arial;padding:30px">Preparando ficha de venda...</body></html>');w.document.close()}return w}
function openPrintable(d,stock,existing,auto){
 const html=template(d,stock,auto);
 if(existing&&!existing.closed){existing.document.open();existing.document.write(html);existing.document.close();existing.focus();return}
 // Abre HTML quando popup estiver bloqueado; o botão FICHA / PDF permanece disponível no sistema.
 const url=URL.createObjectURL(new Blob([html],{type:'text/html'}));
 const w=window.open(url,'_blank');if(!w)alert('O navegador bloqueou a ficha. Autorize pop-ups e clique em FICHA / PDF novamente.');
 setTimeout(()=>URL.revokeObjectURL(url),120000);
}
window.usadosFichaReserve=reserve;
window.usadosFichaAfterSale=(d,stock,popup)=>openPrintable(d,stock,popup,true);
function printSaved(id){const api=window.usadosFichaAccess;const d=api?.getDeals().find(x=>x.id===id);if(!d){alert('Cliente não encontrado');return}openPrintable(d,api.getStock(),reserve(),false)}
printBtn.onclick=()=>{const api=window.usadosFichaAccess;const d=api?.getDeals().find(x=>x.id===window.usadosFichaCurrentId);if(d)printSaved(d.id);else alert('Salve a ficha antes de imprimir.')};
const origOpen=window.usadosFichaOpen;
window.usadosFichaOpen=d=>{window.usadosFichaCurrentId=d?.id||null;origOpen(d)};
$('usadosArea').addEventListener('click',e=>{const btn=e.target.closest('[data-print-ficha]');if(!btn)return;e.preventDefault();e.stopPropagation();printSaved(btn.dataset.printFicha)});
})();