/* MOVAMI — MODO DEMONSTRAÇÃO ACADÊMICA
   Todos os nomes, contatos, valores e negócios abaixo são FICTÍCIOS.
   Nenhum cadastro real da MOVAMI é copiado ou publicado.
   Dados alterados persistem somente no navegador, em chaves isoladas.
*/
(function(){
'use strict';
const INIT='movami_demo_seeded_v2';
const KEYS={
  clients:'movami_demo_online_clientes_v1',
  sales:'movami_demo_renato_recorrencia_v1',
  prospects:'movami_demo_prospeccao_v1',
  used:'movami_demo_usados_v1'
};
const isoDay=offset=>{
 const d=new Date();d.setDate(d.getDate()+offset);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
const month=(delta=0)=>{
 const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+delta);
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
};
const note='DADOS FICTÍCIOS — projeto acadêmico, sem vínculo com clientes reais.';
const exampleClients=[
 ['Alfa Serviços Integrados (DEMO)','proposta','Onix Hatch | Locação 24 meses',3450],
 ['Vértice Engenharia (DEMO)','retorno','Saveiro Robust | 36 meses',3700],
 ['Norte Sul Tecnologia (DEMO)','negociacao','Onix Plus | 24 meses',3950],
 ['Aurora Facilities (DEMO)','fechado','Polo Hatch | 36 meses',3200],
 ['Horizonte Logística (DEMO)','fechado','Fiorino | 12 meses',4100],
 ['Vale Azul Comercial (DEMO)','semresposta','HB20 Hatch | Mensal',3300],
 ['Ponte Nova Soluções (DEMO)','proposta','Spin 7 lugares | 24 meses',4850],
 ['Cedro Manutenção (DEMO)','negociacao','Strada | 36 meses',3990],
 ['Colina Serviços (DEMO)','fechado','Onix Hatch | 12 meses',3500],
 ['Granito Projetos (DEMO)','retorno','Tracker | 36 meses',4390],
 ['Estrela do Sul Comércio (DEMO)','perdido','Onix Hatch | 12 meses',3100],
 ['Litoral Construtora (DEMO)','proposta','Saveiro Robust | 24 meses',3650],
 ['Central Administradora (DEMO)','negociacao','Onix Plus | 36 meses',3750],
 ['Solaris Apoio Empresarial (DEMO)','fechado','HB20 | 24 meses',3420]
];
const clients=exampleClients.map((x,i)=>({
 id:'demo-cliente-'+String(i+1).padStart(3,'0'),
 name:x[0],status:x[1],vehicle:x[2],value:x[3],contact:'Contato fictício',
 phone:'',cnpj:'',notes:note,created:new Date().toISOString(),
 files:[],sent:isoDay(-17+i),next:isoDay(3+i),lossReason:x[1]==='perdido'?'Sem interesse':'',
 lossEvidence:'nao_informado',lossDetail:''
}));
const prospectNames=[
 ['Alfa Serviços Integrados (DEMO)',85000,'2019-05-10','contatar'],
 ['Vértice Engenharia (DEMO)',120000,'2017-09-22','contatada'],
 ['Aurora Facilities (DEMO)',250000,'2018-03-12','interessada'],
 ['Rota Clara Logística (DEMO)',50000,'2020-04-04','cotacao'],
 ['Costa Verde Comércio (DEMO)',78000,'2021-05-14','contatar'],
 ['Sigma Projetos (DEMO)',35000,'2020-02-18','pesquisada'],
 ['Estrela Gestão Predial (DEMO)',56000,'2022-06-06','contatar'],
 ['Mosaico Tecnologia (DEMO)',150000,'2015-10-20','proposta'],
 ['Centro Alfa Distribuidora (DEMO)',10000,'2025-09-01','descartada'],
 ['Vale Norte Engenharia (DEMO)',90000,'2019-11-27','contatada'],
 ['Horizonte Logística (DEMO)',130000,'2018-07-04','interessada'],
 ['Catarina Serviços (DEMO)',0,'','pesquisada']
];
const prospects=prospectNames.map((x,i)=>({
 id:'demo-prospect-'+String(i+1).padStart(3,'0'),
 name:x[0],city:'Blumenau',region:'Vale do Itajaí',cnpj:'',
 opening:x[2],capital:x[1]||null,contact:'Departamento Comercial',
 phone:'',email:'contato'+String(i+1)+'@demo.example',
 demand:['Hatch','Sedã','Utilitário','SUV'][i%4],cars:1+(i%5),
 stage:x[3],next:isoDay(i+2),source:'Fonte FICTÍCIA — apresentação acadêmica',
 notes:note,emailSentAt:i%4===0?new Date().toISOString():null
}));
const sales=[
 {id:'demo-contrato-1',client:'Aurora Facilities (DEMO)',count:2,term:36,rent:3200,start:month(-3),active:true,received:[month(-1),month()]},
 {id:'demo-contrato-2',client:'Horizonte Logística (DEMO)',count:1,term:12,rent:4100,start:month(-1),active:true,received:[month()]},
 {id:'demo-contrato-3',client:'Colina Serviços (DEMO)',count:1,term:24,rent:3500,start:month(-2),active:true,received:[month()]},
 {id:'demo-contrato-4',client:'Solaris Apoio Empresarial (DEMO)',count:3,term:36,rent:3420,start:month(),active:true,received:[]},
 {id:'demo-contrato-5',client:'Grupo Fictício Vale Sul (DEMO)',count:2,term:24,rent:3690,start:month(-7),active:true,received:[]}
];
const stock=[
 {id:'demo-carro-01',code:'DEMO-001',brand:'Chevrolet',model:'Onix',version:'LT',year:'2022',plate:'DEMO-001',km:63000,price:57000,status:'disponivel'},
 {id:'demo-carro-02',code:'DEMO-002',brand:'Volkswagen',model:'Polo',version:'Highline',year:'2023',plate:'DEMO-002',km:42000,price:81000,status:'reservado'},
 {id:'demo-carro-03',code:'DEMO-003',brand:'Fiat',model:'Strada',version:'Freedom',year:'2021',plate:'DEMO-003',km:89000,price:73000,status:'disponivel'}
];
const deals=[
 {id:'demo-usado-01',name:'Cliente Exemplo 01 (DEMO)',phone:'',email:'',stage:'novo',vehicleId:'demo-carro-01',price:57000,ref:'DEMO',notes:note,history:[],docs:[],createdAt:new Date().toISOString()},
 {id:'demo-usado-02',name:'Cliente Exemplo 02 (DEMO)',phone:'',email:'',stage:'negociacao',vehicleId:'demo-carro-02',price:81000,ref:'DEMO',notes:note,history:[],docs:[],createdAt:new Date().toISOString()}
];
function initialize(reset){
 if(reset){for(const key of Object.values(KEYS))localStorage.removeItem(key);localStorage.removeItem(INIT)}
 if(localStorage.getItem(INIT))return;
 const contents={clients,sales,prospects,used:{deals,stock}};
 for(const [type,key] of Object.entries(KEYS)){
   if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(contents[type]));
 }
 localStorage.setItem(INIT,'true');
}
try{initialize(false)}catch(err){console.warn('Não foi possível preparar a base de demonstração:',err)}
document.addEventListener('DOMContentLoaded',()=>{
 const button=document.getElementById('demoRestore');
 if(button)button.onclick=()=>{
   if(confirm('Restaurar os clientes e contratos fictícios iniciais? Todas as alterações feitas nesta versão DEMO serão substituídas. O painel real não será afetado.')){
      try{initialize(true);location.reload()}catch(err){alert('Não foi possível restaurar dados fictícios: '+err.message)}
   }
 };
});
})();
