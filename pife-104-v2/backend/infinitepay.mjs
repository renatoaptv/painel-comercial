// Server-side only. Never import in a browser or publish a real key.
// No handler or checkout is enabled by this module.
const BASE = 'https://api.checkout.infinitepay.io';
const PACKS = new Set([1, 5, 10, 20, 50, 100]);
const ORDER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function buildCheckout({orderId, coins, expiresAt, redirectUrl, webhookUrl}) {
  if (!ORDER.test(orderId) || !PACKS.has(coins)) throw new Error('Invalid order or package');
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) throw new Error('Invalid expiry');
  for (const url of [redirectUrl, webhookUrl]) if (new URL(url).protocol !== 'https:') throw new Error('HTTPS required');
  return {handle:'carbonfinance', order_nsu:orderId, items:[{quantity:1,price:coins*100,description:coins+' G-COIN — Pif-Paf'}], redirect_url:redirectUrl, webhook_url:webhookUrl, options:{single_payment:true,valid_until:expiresAt,require_delivery_address:false}};
}
export function verifiedAmount(order, result) {
  return result?.success === true && result?.paid === true && Number.isSafeInteger(order?.amount_cents) && order.amount_cents > 0 && result.amount === order.amount_cents;
}
export function makeInfinitePay({apiKey, fetcher = fetch, enabled = false}) {
  if (!enabled) throw new Error('Live checkout disabled');
  if (typeof apiKey !== 'string' || !apiKey.startsWith('inchk_')) throw new Error('Missing server secret');
  async function call(path, payload) {
    const r = await fetcher(BASE+path,{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':apiKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
    if (!r.ok) throw new Error('Payment provider HTTP '+r.status);
    return r.json();
  }
  return {
    create: async (order) => {
      const result = await call('/links',buildCheckout(order));
      const url = new URL(result.url);
      if(url.protocol !== 'https:' || url.hostname !== 'buy.infinitepay.io') throw new Error('Unexpected checkout host');
      return url.href;
    },
    verify: async (order,{transactionNsu,slug}) => {
      if(!ORDER.test(order.id) || typeof transactionNsu !== 'string' || !transactionNsu || transactionNsu.length > 200 || typeof slug !== 'string' || !slug || slug.length > 200) throw new Error('Invalid payment reference');
      const result = await call('/payment_check',{handle:'carbonfinance',order_nsu:order.id,transaction_nsu:transactionNsu,slug});
      return verifiedAmount(order,result);
    }
  };
}
// Before enabling: authenticate player, persist order and URL, bind payment to
// order, atomically credit paid wallet exactly once, handle refunds, and verify
// game delivery and merchant eligibility. Never trust a client or webhook alone.
