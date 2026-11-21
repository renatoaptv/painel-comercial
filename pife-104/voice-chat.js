/* Pif-Paf / Caxeta do Gael — conversa por voz privada entre participantes da sala.
 * O microfone é conectado por WebRTC; o servidor só troca SDP e candidatos ICE.
 * Não há gravação, upload de áudio nem transmissão para participantes de outras salas.
 */
(function(){
"use strict";
var API="https://tlzshlerpspgpjaqskdg.supabase.co/functions/v1/pife104-voice";
var ICE={iceServers:[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]}]};
function escapeText(v){return String(v===undefined||v===null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function newGeneration(){
 if(window.crypto&&window.crypto.randomUUID)return window.crypto.randomUUID();
 var a=new Uint8Array(16);window.crypto.getRandomValues(a);a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
 return Array.from(a,function(x){return x.toString(16).padStart(2,"0");}).join("").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,"$1-$2-$3-$4-$5");
}
window.GaelVoiceChat=function(config){
 var v={joined:false,joining:false,muted:false,stream:null,generation:"",since:0,peers:new Map(),presence:[],timer:null,polling:false,epoch:0,error:"",needsTap:false,ctx:null,retryAt:new Map()};
 function notify(){if(config.onChange)config.onChange();}
 function credentials(){return config.getAuth?config.getAuth():null;}
 function isActive(){return v.joined||v.joining;}
 function setAudioSession(){
  try{if(navigator.audioSession)navigator.audioSession.type=isActive()?"play-and-record":"playback";}catch(_){}
  if(config.onAudioMode)config.onAudioMode(isActive());
 }
 async function endpoint(action,args,ctx){
  var session=ctx||credentials();
  if(!session||!session.code||!session.token)throw Error("É necessário estar conectado à sala.");
  var body=Object.assign({action:action,code:session.code,token:session.token,generation:v.generation},args||{});
  var response=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  var data;try{data=await response.json();}catch(_){throw Error("Resposta inválida do servidor de voz.");}
  if(!response.ok||!data.ok)throw Error(data.error||"Não foi possível conectar a conversa.");
  return data;
 }
 function status(){
  if(v.joining)return "Abrindo microfone...";
  if(!v.joined)return v.error||"Fale com quem está na sua sala.";
  var active=v.presence.filter(function(p){return p.seat!==credentials()?.seat;});
  var connected=Array.from(v.peers.values()).filter(function(p){return p.pc.connectionState==="connected";}).length;
  if(v.muted)return "Microfone mudo · você continua ouvindo.";
  if(active.length===0)return "Microfone ativo · aguardando amigos.";
  if(connected===active.length)return "Conectado com "+connected+" "+(connected===1?"jogador":"jogadores")+".";
  return "Conectando áudio...";
 }
 function html(){
  var a=credentials();if(!a||!a.code||!Array.isArray(a.players))return "";
  var people=a.players.filter(function(p){return !p.bot;});
  var roster=people.map(function(p){
   var here=v.presence.find(function(item){return item.seat===p.seat;});
   var self=p.seat===a.seat;
   var label=self?(v.joined?(v.muted?"Mudo":"Você"):"Você"):
    (here?(here.muted?"Mudo":v.peers.get(p.seat)?.pc.connectionState==="connected"?"Conectado":"No áudio"):"Fora");
   return '<span class="voice-person '+(here?"voice-in":"")+'">'+(self?"★ ":"")+escapeText(p.name)+' <small>'+escapeText(label)+'</small></span>';
  }).join("");
  var controls=v.joined?
   '<button class="btn '+(v.muted?"green":"ghost")+'" data-action="voice-mute">'+(v.muted?"🎙 Ativar mic":"🔇 Mudo")+'</button>'+
   '<button class="btn ghost" data-action="voice-leave">Sair</button>':
   '<button class="btn primary" data-action="voice-join" '+(v.joining?"disabled":"")+'>🎙 '+(v.joining?"Conectando...":"Entrar no áudio")+'</button>';
  if(v.needsTap&&v.joined)controls+='<button class="btn green" data-action="voice-hear">🔊 Ouvir amigos</button>';
  return '<section class="panel voice-panel" aria-label="Chat de voz da sala"><div class="voice-heading"><h2>🎧 Áudio da mesa</h2><span class="voice-dot '+(v.joined?"on":"")+'"></span></div>'+
   '<p class="voice-status">'+escapeText(status())+'</p><div class="voice-people">'+roster+'</div>'+
   (v.error&&v.joined?'<p class="voice-error">'+escapeText(v.error)+'</p>':"")+
   '<div class="controls voice-controls">'+controls+'</div>'+
   '<p class="tip voice-note">Sem gravação · Use fones para evitar eco.</p></section>';
 }
 function closePeer(seat){
  var p=v.peers.get(seat);if(!p)return;
  v.peers.delete(seat);
  try{p.pc.onicecandidate=null;p.pc.ontrack=null;p.pc.onconnectionstatechange=null;p.pc.close();}catch(_){}
  if(p.audio){try{p.audio.pause();p.audio.srcObject=null;p.audio.remove();}catch(_){}}
 }
 function sendSignal(p,kind,data){
  if(!v.joined||v.peers.get(p.seat)!==p)return Promise.resolve();
  return endpoint("signal",{toSeat:p.seat,toGeneration:p.generation,kind:kind,data:data}).catch(function(){});
 }
 function remoteAudio(p,event){
  var media=event.streams&&event.streams[0];
  if(!media&&event.track)media=new MediaStream([event.track]);
  if(!media)return;
  var element=p.audio;
  if(!element){
   element=document.createElement("audio");
   element.autoplay=true;element.playsInline=true;element.controls=false;element.volume=1;
   element.style.position="absolute";element.style.width="1px";element.style.height="1px";element.style.left="-10000px";element.style.opacity="0";
   element.setAttribute("aria-hidden","true");
   document.body.appendChild(element);p.audio=element;
  }
  element.srcObject=media;
  var outcome=element.play();
  if(outcome&&outcome.catch)outcome.catch(function(){v.needsTap=true;notify();});
  notify();
 }
 function peerFor(seat,generation){
  var p=v.peers.get(seat);
  if(p&&p.generation===generation)return p;
  if(p)closePeer(seat);
  if(!v.stream||!v.joined||!window.RTCPeerConnection)return null;
  var pc=new RTCPeerConnection(ICE);
  p={seat:seat,generation:generation,pc:pc,audio:null,iceQueue:[],offered:false,created:Date.now()};
  v.peers.set(seat,p);
  v.stream.getAudioTracks().forEach(function(track){pc.addTrack(track,v.stream);});
  pc.ontrack=function(ev){if(v.peers.get(seat)===p)remoteAudio(p,ev);};
  pc.onicecandidate=function(ev){
   if(v.peers.get(seat)!==p||!ev.candidate)return;
   var candidate=ev.candidate.toJSON?ev.candidate.toJSON():{candidate:ev.candidate.candidate,sdpMid:ev.candidate.sdpMid,sdpMLineIndex:ev.candidate.sdpMLineIndex};
   sendSignal(p,"candidate",candidate);
  };
  pc.onconnectionstatechange=function(){
   if(v.peers.get(seat)!==p)return;
   var current=pc.connectionState;
   if(current==="failed"||current==="closed"){
    v.retryAt.set(seat,Date.now()+8000);closePeer(seat);notify();
   }else if(current==="connected")notify();
  };
  return p;
 }
 async function sendOffer(p){
  if(!p||p.offered||!v.joined||v.peers.get(p.seat)!==p)return;
  p.offered=true;
  try{
   var offer=await p.pc.createOffer();
   if(v.peers.get(p.seat)!==p)return;
   await p.pc.setLocalDescription(offer);
   if(v.peers.get(p.seat)!==p)return;
   await sendSignal(p,"offer",{type:offer.type,sdp:offer.sdp});
  }catch(_){p.offered=false;v.retryAt.set(p.seat,Date.now()+7000);closePeer(p.seat);}
 }
 function syncPeers(peers){
  var own=credentials()?.seat;
  var active=new Map();
  peers.forEach(function(p){if(Number.isInteger(p.seat)&&p.seat!==own&&p.generation)active.set(p.seat,p);});
  v.peers.forEach(function(p,seat){if(!active.has(seat)||active.get(seat).generation!==p.generation)closePeer(seat);});
  v.presence=peers.concat([{seat:own,muted:v.muted}]);
  active.forEach(function(p,seat){
   if(v.retryAt.has(seat)&&Date.now()<v.retryAt.get(seat))return;
   var connection=peerFor(seat,p.generation);
   if(connection&&own<seat&&!connection.offered)sendOffer(connection);
  });
 }
 async function acceptSignal(msg){
  var own=credentials()?.seat;
  var seat=msg.from_seat,peer=v.presence.find(function(p){return p.seat===seat;});
  if(!peer||peer.generation!==msg.from_generation||seat===own)return;
  if(msg.kind==="bye"){closePeer(seat);return;}
  var p=peerFor(seat,peer.generation);if(!p)return;
  try{
   if(msg.kind==="offer"){
    if(own<seat)return; // O menor lugar inicia a chamada; evita ofertas simultâneas.
    if(p.pc.signalingState!=="stable"){closePeer(seat);p=peerFor(seat,peer.generation);}
    if(!p)return;
    await p.pc.setRemoteDescription({type:"offer",sdp:msg.payload.sdp});
    await flushIce(p);
    var answer=await p.pc.createAnswer();
    await p.pc.setLocalDescription(answer);
    await sendSignal(p,"answer",{type:answer.type,sdp:answer.sdp});
   }else if(msg.kind==="answer"){
    if(own>seat||p.pc.signalingState!=="have-local-offer")return;
    await p.pc.setRemoteDescription({type:"answer",sdp:msg.payload.sdp});
    await flushIce(p);
   }else if(msg.kind==="candidate"){
    var candidate=msg.payload;
    if(!candidate||!candidate.candidate)return;
    if(p.pc.remoteDescription&&p.pc.remoteDescription.type){
     await p.pc.addIceCandidate(candidate);
    }else p.iceQueue.push(candidate);
   }
  }catch(_){
   // Erros de um candidato não derrubam a partida nem o microfone.
  }
 }
 async function flushIce(p){
  while(p.iceQueue.length&&p.pc.remoteDescription&&p.pc.remoteDescription.type){
   var ice=p.iceQueue.shift();
   try{await p.pc.addIceCandidate(ice);}catch(_){}
  }
 }
 async function poll(){
  if(!v.joined||v.polling)return;
  var epoch=v.epoch;v.polling=true;
  try{
   var data=await endpoint("poll",{since:v.since,muted:v.muted},v.ctx);
   if(epoch!==v.epoch||!v.joined)return;
   v.since=Math.max(v.since,Number(data.cursor)||0);
   var oldRoster=JSON.stringify(v.presence.map(function(p){return [p.seat,p.generation,p.muted];}));
   syncPeers(data.peers||[]);
   var newRoster=JSON.stringify(v.presence.map(function(p){return [p.seat,p.generation,p.muted];}));
   for(var i=0;i<(data.signals||[]).length;i++){
    if(epoch!==v.epoch||!v.joined)return;
    await acceptSignal(data.signals[i]);
   }
   if(oldRoster!==newRoster)notify();
   v.error="";
  }catch(err){
   if(epoch===v.epoch){v.error=String(err.message||err);notify();}
  }finally{if(epoch===v.epoch)v.polling=false;}
 }
 async function join(){
  if(v.joined||v.joining)return;
  var c=credentials();
  if(!c?.code||!c.token||!Number.isInteger(c.seat)){v.error="Entre numa sala antes de ativar o chat.";notify();return;}
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection){v.error="Este navegador não suporta chamadas de voz. Abra no Safari ou Chrome atualizado.";notify();return;}
  v.joining=true;v.error="";v.needsTap=false;
  var epoch=++v.epoch;v.ctx={code:c.code,token:c.token,seat:c.seat};
  v.generation=newGeneration();
  setAudioSession();notify();
  try{
   // Sempre pedir microfone apenas como resposta ao botão do jogador.
   var stream=await navigator.mediaDevices.getUserMedia({video:false,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(epoch!==v.epoch){stream.getTracks().forEach(function(t){t.stop();});return;}
   v.stream=stream;v.muted=false;
   var result=await endpoint("join",{},v.ctx);
   if(epoch!==v.epoch)return;
   v.since=Number(result.cursor)||0;
   v.joining=false;v.joined=true;
   setAudioSession();notify();
   await poll();
   if(epoch===v.epoch&&!v.timer)v.timer=setInterval(poll,1600);
  }catch(err){
   if(epoch!==v.epoch)return;
   v.error=err.name==="NotAllowedError"||err.name==="PermissionDeniedError"?
     "Microfone bloqueado. Autorize o microfone nas configurações do Safari para este site.":
     String(err.message||"Não foi possível abrir o microfone.");
   if(v.stream)v.stream.getTracks().forEach(function(track){track.stop();});
   v.stream=null;v.joining=false;v.joined=false;setAudioSession();notify();
  }
 }
 function mute(){
  if(!v.joined||!v.stream)return;
  v.muted=!v.muted;
  v.stream.getAudioTracks().forEach(function(track){track.enabled=!v.muted;});
  notify();poll();
 }
 function hear(){
  v.needsTap=false;
  v.peers.forEach(function(p){
   if(!p.audio)return;
   var out=p.audio.play();
   if(out&&out.catch)out.catch(function(){v.needsTap=true;notify();});
  });
  notify();
 }
 function leave(){
  var ctx=v.ctx,gen=v.generation;
  ++v.epoch;
  if(v.timer){clearInterval(v.timer);v.timer=null;}
  v.peers.forEach(function(_,seat){closePeer(seat);});
  if(v.stream)v.stream.getTracks().forEach(function(t){try{t.stop();}catch(_){}});
  v.stream=null;v.presence=[];v.retryAt.clear();
  v.joined=false;v.joining=false;v.muted=false;v.polling=false;v.generation="";v.since=0;v.needsTap=false;v.ctx=null;v.error="";
  setAudioSession();notify();
  if(ctx&&gen){
   var payload={action:"leave",code:ctx.code,token:ctx.token,generation:gen};
   // Melhor esforço: fechar áudio não deve bloquear os botões ou a partida.
   fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),keepalive:true}).catch(function(){});
  }
 }
 function handle(action){
  if(action==="voice-join"){join();return true;}
  if(action==="voice-leave"){leave();return true;}
  if(action==="voice-mute"){mute();return true;}
  if(action==="voice-hear"){hear();return true;}
  return false;
 }
 return {html:html,handle:handle,join:join,mute:mute,hear:hear,leave:leave,isListening:isActive,
  debugStatus:function(){return {joined:v.joined,joining:v.joining,muted:v.muted,peers:v.peers.size,error:v.error};}};
};
})();