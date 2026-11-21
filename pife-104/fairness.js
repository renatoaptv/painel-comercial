/* Caxeta do Gael — verificador independente do baralho publicado após a rodada.
   SHA-256 + Fisher-Yates determinístico; nunca recebe a semente antes da rodada terminar. */
(function(){
"use strict";
const FAIR_LABEL="gael-pife104-fair-v1:";
function fullIds(){
 const ids=[];
 for(let n=0;n<2;n++)for(const suit of ["H","D","C","S"])for(let r=1;r<=13;r++)ids.push(n+"-"+suit+"-"+r);
 return ids;
}
function toHex(buffer){return Array.from(new Uint8Array(buffer),n=>n.toString(16).padStart(2,"0")).join("");}
async function digest(value){
 if(!globalThis.crypto||!globalThis.crypto.subtle)throw Error("Verificação requer conexão segura (HTTPS) e navegador atualizado.");
 return toHex(await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
}
async function reconstructDeck(seed){
 let deck=fullIds(),words=[],counter=0;
 async function next(max){
  const limit=0x100000000-(0x100000000%max);
  for(;;){
   if(!words.length){
    const digestBytes=new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(FAIR_LABEL+seed+":"+(counter++))));
    for(let i=0;i<digestBytes.length;i+=4)words.push(((digestBytes[i]*0x1000000)+(digestBytes[i+1]<<16)+(digestBytes[i+2]<<8)+digestBytes[i+3])>>>0);
   }
   const value=words.shift();
   if(value<limit)return value%max;
  }
 }
 for(let i=deck.length-1;i>0;i--){
  const j=await next(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];
 }
 return deck;
}
async function verify(fairness){
 if(!fairness||fairness.version!==1||typeof fairness.seed!=="string"||!(/^[0-9a-f]{64}$/).test(fairness.seed)||typeof fairness.commitment!=="string"||!Array.isArray(fairness.deckIds))throw Error("Prova de embaralhamento incompleta.");
 const commitment=await digest(FAIR_LABEL+fairness.seed);
 if(commitment!==fairness.commitment)return {ok:false,reason:"O compromisso criptográfico não corresponde à semente."};
 const deck=await reconstructDeck(fairness.seed);
 if(deck.length!==104||fairness.deckIds.length!==104||deck.some((id,i)=>id!==fairness.deckIds[i]))return {ok:false,reason:"A sequência publicada não coincide com o baralho gerado pela semente."};
 return {ok:true,reason:"Semente, compromisso e ordem das 104 cartas conferem."};
}
window.GaelFairness={verify,reconstructDeck,digest};
})();