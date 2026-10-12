self.addEventListener("install",event=>{
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate",event=>{
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{}}
  catch(e){data={body:event.data?event.data.text():""}}

  const isSale=data.event==="sold";
  const title=isSale
    ? (data.title&&String(data.title).includes("VENDA FECHADA")?data.title:"🎆🎉 VENDA FECHADA!")
    : (data.title||"Prospecta Real");
  const options={
    body:data.body||(isSale?"🚗 Uma nova venda foi realizada! Parabéns à equipe! 🏆":"Nova atualização comercial."),
    tag:data.tag||("prospecta-real-"+Date.now()),
    renotify:true,
    requireInteraction:isSale,
    vibrate:isSale?[180,90,180,90,360]:[120,70,120],
    actions:isSale?[{action:"view",title:"🎉 Ver venda"}]:[],
    data:{url:data.url||"./",lead_id:data.lead_id||null,event:data.event||null}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  if(event.action&&event.action!=="view")return;
  const noticeData=event.notification.data||{};
  const target=new URL(noticeData.url||"./",self.registration.scope).href;
  event.waitUntil((async()=>{
    const all=await clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of all){
      if("focus" in client){
        if(client.url!==target&&"navigate" in client)await client.navigate(target);
        const focused=await client.focus();
        if(noticeData.event==="sold"&&"postMessage" in focused){
          focused.postMessage({type:"sale-push-opened",leadId:noticeData.lead_id});
        }
        return focused;
      }
    }
    if(clients.openWindow)return clients.openWindow(target);
  })());
});