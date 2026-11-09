/* MOVAMI | PDF comercial local para e-mail de prospecção
 * O navegador armazena o PDF no IndexedDB deste dispositivo.
 * Ao abrir Outlook, faz download de uma cópia para anexar manualmente.
 * O Microsoft Outlook não permite anexos automáticos via URL de composição.
 */
(()=>{
 'use strict';
 const DB='movami_demo_pdf_apresentacao_v1';
 const STORE='anexos';
 const KEY='por-que-terceirizar';
 const MAX=20*1024*1024;
 let promise=null;
 function openDB(){
   if(!('indexedDB' in window))return Promise.reject(new Error('Este navegador não disponibiliza armazenamento local'));
   if(!promise){
      promise=new Promise((resolve,reject)=>{
       const req=indexedDB.open(DB,1);
       req.onupgradeneeded=()=>{
         if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});
       };
       req.onsuccess=()=>resolve(req.result);
       req.onerror=()=>reject(req.error||new Error('Não foi possível abrir o armazenamento local'));
      }).catch(err=>{promise=null;throw err});
   }
   return promise;
 }
 async function read(){
   const db=await openDB();
   return new Promise((resolve,reject)=>{
     const req=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);
     req.onsuccess=()=>resolve(req.result||null);
     req.onerror=()=>reject(req.error);
   });
 }
 async function save(file){
   if(!file||!(/\.pdf$/i.test(file.name)||file.type==='application/pdf'))
       throw new Error('Selecione um arquivo PDF válido');
   if(file.size<=0||file.size>MAX)throw new Error('O PDF deve ter até 20 MB');
   const db=await openDB();
   await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).put({
        id:KEY,name:file.name.replace(/[^a-zA-Z0-9. _()\-à-úÀ-Ú]/g,'_'),
        blob:file,date:new Date().toISOString(),size:file.size
      });
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
   });
   return {name:file.name,size:file.size};
 }
 async function download(){
   const row=await read();
   if(!row||!row.blob)throw new Error('Selecione e salve o PDF uma vez antes de abrir o Outlook');
   const url=URL.createObjectURL(row.blob);
   const link=document.createElement('a');
   link.href=url;
   link.download=row.name||'MOVAMI_Por_Que_Terceirizar_Sua_Frota.pdf';
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
   return row;
 }
 window.MovamiProspectPDF={save,read,download};
})();
