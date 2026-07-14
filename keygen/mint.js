// LASTCALL license key minter — Cloudflare Worker
// Deploy via CI (commit+push) NEVER wrangler from session
// Env var required: LICENSE_PRIVATE_KEY (PKCS8 base64, from keygen.mjs output)
// Triggered by Stripe webhook: payment_intent.succeeded
// Key format: LC1.<base64url(JSON{p,t,e})>.<base64url(ECDSA-sig)>

const PACK_MAP={
  // Stripe price ID → pack identifier
  // Fill in after Stripe products are created (INTEGRATION-PENDING)
  'price_INTEGRATION_PENDING_MESSY':'lastcall-messy',
  'price_INTEGRATION_PENDING_COUPLES':'lastcall-couples',
};

function b64url(bytes){
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

async function mintKey(packId,email,privateKeyB64){
  const pkcs8=Uint8Array.from(atob(privateKeyB64),c=>c.charCodeAt(0));
  const privKey=await crypto.subtle.importKey(
    'pkcs8',pkcs8,{name:'ECDSA',namedCurve:'P-256'},false,['sign']
  );
  const payload=JSON.stringify({p:packId,t:Math.floor(Date.now()/1000),e:email||''});
  const payloadBytes=new TextEncoder().encode(payload);
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privKey,payloadBytes);
  return`LC1.${b64url(payloadBytes)}.${b64url(new Uint8Array(sig))}`;
}

export default{
  async fetch(req,env){
    if(req.method!=='POST') return new Response('Method not allowed',{status:405});

    // Verify Stripe webhook signature
    const body=await req.text();
    const stripeSignature=req.headers.get('stripe-signature');
    // TODO: verify signature with env.STRIPE_WEBHOOK_SECRET
    // For now, parse event directly (add proper verification before production)

    let event;
    try{event=JSON.parse(body)}catch{return new Response('Bad JSON',{status:400})}

    if(event.type!=='checkout.session.completed'&&event.type!=='payment_intent.succeeded'){
      return new Response('Ignored',{status:200});
    }

    // Get line items / price id to determine pack
    // Stripe checkout session has line_items in metadata or expand
    const session=event.data.object;
    const priceId=session.metadata?.price_id||session.items?.data?.[0]?.price?.id;
    const packId=PACK_MAP[priceId];
    if(!packId) return new Response('Unknown pack',{status:400});

    const email=session.customer_details?.email||session.receipt_email||'';
    const successUrl=session.success_url||session.metadata?.success_url||'';

    const key=await mintKey(packId,email,env.LICENSE_PRIVATE_KEY);

    // Redirect to game with key in URL param
    const redirectBase='https://lastcall.defimagic.io';
    const redirectUrl=`${redirectBase}?key=${encodeURIComponent(key)}`;

    return new Response(JSON.stringify({key,redirect:redirectUrl}),{
      headers:{'Content-Type':'application/json'}
    });
  }
};
