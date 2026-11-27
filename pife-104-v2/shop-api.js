import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
export const sb=createClient('https://tlzshlerpspgpjaqskdg.supabase.co','sb_publishable_LQRp4_juiOoAobJmNqU1rQ_YCt84lEQ',{auth:{storageKey:'gael-v2-auth'}});
// Shared iOS status surface for all account, shop, friends and admin pages.
function setupStatusSurface(){
 const base=document.querySelector('meta[name="theme-color"]')?.content||'#102d23';
 document.documentElement.style.setProperty('--pif-status-color',base);
 if(!document.querySelector('link[data-pif-status]')){
  const link=document.createElement('link');link.rel='stylesheet';link.dataset.pifStatus='';link.href=new URL('./ios-status.css?v=1',import.meta.url).href;document.head.append(link);
 }
 if(!document.querySelector('.pif-status-surface')){
  const surface=document.createElement('div');surface.className='pif-status-surface';surface.setAttribute('aria-hidden','true');document.body.prepend(surface);
 }
}
setupStatusSurface();
export const themes={gold:{name:'Ouro',bg:'#261b0b',light:'#59411d',border:'#e7c179'},ocean:{name:'Oceano',bg:'#061c35',light:'#16466b',border:'#71c7ff'},ruby:{name:'Rubi',bg:'#2b0c1d',light:'#622039',border:'#f99ab0'}};
export async function shop(action,params={}){const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Entre na sua conta primeiro.');const r=await fetch('https://tlzshlerpspgpjaqskdg.supabase.co/functions/v1/gael-cosmetic-pay',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,...params})});const data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível acessar a loja.');return data;}
export function applyTheme(sku){document.getElementById('gael-theme-style')?.remove();const t=themes[sku];document.documentElement.style.setProperty('--pif-status-color',t?.bg||document.querySelector('meta[name="theme-color"]')?.content||'#102d23');if(!t)return;const st=document.createElement('style');st.id='gael-theme-style';st.textContent='html,body{background:radial-gradient(ellipse at 50% 10%,'+t.light+','+t.bg+' 75%) !important} .panel,.table,.topbar,.top{border-color:'+t.border+' !important} .table{box-shadow:inset 0 0 45px #0006,0 0 20px '+t.border+'55 !important}';document.head.append(st);}
export async function restoreTheme(){try{const {data:{session}}=await sb.auth.getSession();if(!session)return;const key='gael-theme-'+session.user.id;const sku=localStorage.getItem(key);if(sku&&(await shop('status')).owned.includes(sku))applyTheme(sku);}catch{}}
export async function selectTheme(sku,owned){const {data:{session}}=await sb.auth.getSession();if(!session||sku&&!owned.includes(sku))throw Error('Tema não desbloqueado.');const key='gael-theme-'+session.user.id;if(sku)localStorage.setItem(key,sku);else localStorage.removeItem(key);applyTheme(sku);}

export async function loadPlayerIdentity(){
try{const {data:{user},error}=await sb.auth.getUser();if(error||!user?.email_confirmed_at)return null;
const name=String(user.user_metadata?.gael_nickname||'').trim().slice(0,24);if(name.length<2)return null;
const {data,error:err}=await sb.rpc('gael_v2_account',{p_nickname:name});if(err||!data?.nickname)return null;
window.pifPafNickname=data.nickname;window.dispatchEvent(new Event('pif-paf-profile'));return data;
}catch{return null;}
}
