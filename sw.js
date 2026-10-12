self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch(e){data={body:event.data?event.data.text():""}}
  const title=data.title||"Prospecta Real";
  const options={
    body:data.body||"Nova atualização comercial.",
    tag:data.tag||"prospecta-real",
    renotify:true,
    data:{url:data.url||"./",lead_id:data.lead_id||null,event:data.event||null}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||"./",self.registration.scope).href;
  event.waitUntil((async()=>{
    const all=await clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of all){
      if("focus" in client){
        if(client.url!==target&&"navigate" in client)await client.navigate(target);
        return client.focus();
      }
    }
    if(clients.openWindow)return clients.openWindow(target);
  })());
});