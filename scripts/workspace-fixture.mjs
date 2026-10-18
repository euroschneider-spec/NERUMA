// Loopback-only Supabase API fixture backed by the real migrations and Postgres RLS.
// Auth and Storage HTTP services are simulated; no remote project is contacted.
import { createServer } from 'node:http';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { createSupabaseLikeDatabase } from './pglite-supabase.mjs';
import { loadFixtureBase } from './fixture-base.mjs';
import { loadSyntheticData, people } from './synthetic-data.mjs';
import { newSecret, totpMatches } from './fixture-totp.mjs';
if (process.env.VIANORAE_TEST_FIXTURE !== '1') throw new Error('Test fixture must be explicitly enabled');
// One shared password for every mock user. Test-only: this fixture is a fake Supabase and never runs in a real environment.
const FIXTURE_PASSWORD='Fixture-only-passphrase-123';
const db = await createSupabaseLikeDatabase();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const users = [1,2,3,4,5].map(n => ({id:id(n),aud:'authenticated',role:'authenticated',email:`owner${n}@example.test`,email_confirmed_at:'2026-10-01T12:00:00Z',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-01T12:00:00Z'}));
let verificationEnabled=true;let evidenceEnabled=true;
const files = new Map(); const tokens = new Map(); const levels = new Map(); const sessionIds = new Map(); const signedAt = new Map(); const signedLinks = new Map(); const challenges = new Map(); const backupSets = new Map(); let tail = Promise.resolve();
const locked = fn => {const result=tail.then(fn);tail=result.catch(()=>{});return result;};
// Browsing data (Willow Museum, a waiting request, and the synthetic world) is for npm run dev:mock only; the test suite never
// sets it, so its starting state is unchanged.
const demo = process.env.VIANORAE_FIXTURE_DEMO_DATA === '1';
const base = await loadFixtureBase(db, { demo });
for (const [key, bytes] of base.files) files.set(key, bytes);
if (demo) {
  const world = await loadSyntheticData(db, { volume: process.env.VIANORAE_FIXTURE_VOLUME === '1' });
  for (const [key, bytes] of world.photos) files.set(key, bytes);
  for (const entry of people.filter(entry => process.env.VIANORAE_FIXTURE_VOLUME === '1' || !entry.volume)) {
    users.push({...users[0],id:id(entry.n),email:entry.email,email_confirmed_at:entry.confirmed===false?null:'2026-10-01T12:00:00Z'});
  }
  const codes = world.summary.places.filter(place => place.code && !place.key.startsWith('archive-')).map(place => `${place.code} ${place.key}`);
  console.log('QR codes (published places): '+codes.join(', '));
}
// Payments: the webhook's secret, as the owner sets it in the real project (docs/guides/PAYMENTS.md).
if(process.env.VIANORAE_BILLING_SECRET) await db.query("update private.billing_policy set webhook_secret_sha256=sha256(convert_to($1,'UTF8'))",[process.env.VIANORAE_BILLING_SECRET]);
// A fake Stripe API (scripts/workspace-fixture-fetch.mjs sends api.stripe.com here): Checkout and the customer page answer with Stripe's
// addresses, which the browser test intercepts. The last request of each kind can be read back, to check what the app sent.
const stripeRequests=new Map();const stripeSubscriptions=new Map();let stripeCustomers=0;
// Two-factor sign-in as Supabase Auth does it: factors on the user, the assurance level (aal) in the access token.
const factorRows=userId=>locked(async()=>(await db.query('select id,friendly_name,factor_type,status,secret,created_at,updated_at from auth.mfa_factors where user_id=$1 order by created_at',[userId])).rows);
const asFactor=row=>({id:row.id,friendly_name:row.friendly_name,factor_type:row.factor_type,status:row.status,created_at:row.created_at,updated_at:row.updated_at});
const withFactors=async user=>({...user,factors:(await factorRows(user.id)).map(asFactor)});
// One sign-in keeps its session id through refreshes and the code step, as in Supabase Auth.
function session(user,aal='aal1',sessionId=randomUUID()) {
  const now=Math.floor(Date.now()/1000);
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,aud:'authenticated',role:'authenticated',iss:'https://vianorae-fixture.supabase.co/auth/v1',iat:now,exp:now+3600,email:user.email,is_anonymous:false,aal,session_id:sessionId,amr:[{method:'password',timestamp:now},...(aal==='aal2'?[{method:'totp',timestamp:now}]:[])]})}`;
  const access=`${unsigned}.${createHmac('sha256','fixture-only-key').update(unsigned).digest('base64url')}`;
  const refresh=randomUUID();tokens.set(access,user);tokens.set(refresh,user);levels.set(access,aal);levels.set(refresh,aal);sessionIds.set(access,sessionId);sessionIds.set(refresh,sessionId);signedAt.set(access,now);
  return {access_token:access,refresh_token:refresh,token_type:'bearer',expires_in:3600,expires_at:now+3600,user};
}
const send=(res,status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(value));};
const safe=value=>{if(!/^[a-z_]+$/.test(value)) throw new Error('Unsafe identifier');return value;};
// Functions whose JSON body maps straight onto their named parameters.
const simpleRpcs={my_account_deletion:[],request_account_deletion:[],request_account_deletion_for:['p_email'],restore_account:['p_user'],account_deletions:[],organisation_holds:[],
  account_erasure_files:['p_user'],organisation_erasure_files:['p_org'],erase_account:['p_user'],erase_held_organisation:['p_org'],export_my_data:[],
  export_user_data:['p_user'],export_files:['p_user'],delete_problem_report:['p_report'],account_deletion_schema_version:[],
  admin_overview:[],admin_accounts:['p_search','p_limit','p_offset','p_admins_only'],add_platform_admin:['p_email'],remove_platform_admin:['p_user'],superadmin_schema_version:[],admin_account:['p_user'],account_profile_schema_version:[],
  payments_schema_version:[],billing_status:['org'],billing_record_subscription:['p_secret','p_org','p_customer','p_subscription','p_status','p_period_end','p_cancel_at_period_end','p_event_created']};
const tables=new Set(['organizations','organization_members','places','place_translations','zones','zone_translations','zone_fields','zone_field_translations','sensory_profiles','media_assets','guides','guide_steps','organization_applications','organization_review_events','organization_evidence_documents','problem_reports']);
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:3012');const chunks=[];for await(const chunk of req) chunks.push(chunk);const body=Buffer.concat(chunks);
    if(url.pathname==='/__fixture/verification-mode' && req.method==='POST') {verificationEnabled=JSON.parse(body.toString()).enabled;return send(res,200,{verificationEnabled});}
    if(url.pathname==='/__fixture/evidence-mode' && req.method==='POST') {evidenceEnabled=JSON.parse(body.toString()).enabled;return send(res,200,{evidenceEnabled});}
    // Test-only: make every deletion and hold due now, instead of waiting 30 days.
    if(url.pathname==='/__fixture/deletions-due' && req.method==='POST') {
      await locked(async()=>{await db.query("update private.account_deletions set delete_after=now()-interval '1 minute'");await db.query("update private.organisation_holds set delete_after=now()-interval '1 minute' where erased_at is null");});
      return send(res,200,{due:true});
    }
    // A private download link (Storage's signed URL): works without signing in until it expires.
    if(req.method==='GET' && url.pathname.startsWith('/storage/v1/object/sign/')) {
      const link=signedLinks.get(url.searchParams.get('token')||'');
      if(!link || link.expires<Date.now() || !files.has(link.key)) return send(res,400,{message:'Invalid or expired link'});
      res.writeHead(200,{'Content-Type':link.key.endsWith('.zip')?'application/zip':'application/octet-stream'});return res.end(files.get(link.key));
    }
    if(url.pathname==='/__fixture/two-factor-deadline' && req.method==='POST') {
      const from=JSON.parse(body.toString()).from;
      await locked(()=>db.query('update private.two_factor_policy set organisations_from=$1',[from]));return send(res,200,{from});
    }
    if (url.pathname==='/health') return send(res,200,{ready:true});
    if(url.pathname==='/__fixture/payments-required' && req.method==='POST') {
      const from=JSON.parse(body.toString()).from;
      await locked(()=>db.query('update private.billing_policy set required_from=$1',[from]));return send(res,200,{from});
    }
    // Test-only: end every organisation's 30 days of grace now.
    if(url.pathname==='/__fixture/payments-grace-over' && req.method==='POST') {
      await locked(()=>db.query("update public.organization_subscriptions set lapsed_at=now()-interval '31 days' where lapsed_at is not null"));return send(res,200,{over:true});
    }
    if(url.pathname.startsWith('/__fixture/stripe-last/') && req.method==='GET') return send(res,200,stripeRequests.get(url.pathname.split('/').at(-1))||null);
    // Test-only: what Stripe answers about a subscription from now on (the webhook asks for it after each event).
    if(url.pathname==='/__fixture/stripe-subscription' && req.method==='POST') {const subscription=JSON.parse(body.toString());stripeSubscriptions.set(subscription.id,subscription);return send(res,200,subscription);}
    if(url.pathname.startsWith('/__stripe/v1/') && req.headers.authorization!==`Bearer ${process.env.VIANORAE_STRIPE_SECRET_KEY}`) return send(res,401,{error:{message:'Invalid API key'}});
    if(url.pathname.startsWith('/__stripe/v1/subscriptions/') && req.method==='GET') {
      const subscription=stripeSubscriptions.get(url.pathname.split('/').at(-1));
      return subscription?send(res,200,subscription):send(res,404,{error:{message:'No such subscription'}});
    }
    if(url.pathname.startsWith('/__stripe/v1/') && req.method==='POST') {
      const params=Object.fromEntries(new URLSearchParams(body.toString()));const id=randomUUID().replace(/-/g,'');
      if(url.pathname==='/__stripe/v1/checkout/sessions') {
        stripeRequests.set('checkout',{...params,fixture_customer:params.customer||`cus_Fixture${++stripeCustomers}`});
        return send(res,200,{id:`cs_test_${id}`,object:'checkout.session',url:`https://checkout.stripe.com/c/pay/cs_test_${id}`});
      }
      if(url.pathname==='/__stripe/v1/billing_portal/sessions') {
        stripeRequests.set('portal',params);
        return send(res,200,{id:`bps_${id}`,object:'billing_portal.session',url:`https://billing.stripe.com/p/session/test_${id}`});
      }
      return send(res,404,{error:{message:'Unrecognized request URL'}});
    }
    if(url.pathname==='/auth/v1/signup' || url.pathname==='/auth/v1/resend') {
      const payload=JSON.parse(body.toString());
      if(payload.email==='limited@example.test') return send(res,429,{error_code:'over_email_send_rate_limit',msg:'Email rate limit exceeded'});
      if(payload.email==='unauthorized@example.test') return send(res,400,{error_code:'email_address_not_authorized',msg:'Address not authorized'});
      if(url.pathname==='/auth/v1/resend') return send(res,200,{});
      return send(res,200,{id:id(20),aud:'authenticated',role:'authenticated',email:payload.email,email_confirmed_at:null,is_anonymous:false,app_metadata:{provider:'email'},user_metadata:payload.data||{},identities:[],created_at:new Date().toISOString()});
    }
    if (url.pathname==='/auth/v1/token') {
      const payload=JSON.parse(body.toString());const refreshing=url.searchParams.get('grant_type')==='refresh_token';
      const user=refreshing?tokens.get(payload.refresh_token):users.find(u=>u.email===payload.email && payload.password===FIXTURE_PASSWORD);
      if(!user) return send(res,400,{error:'invalid_grant',error_description:'Invalid fixture credentials'});
      // As Supabase Auth: an erased account is unknown, and a banned one (deletion in progress) is refused, also on refresh.
      const account=(await locked(async()=>(await db.query('select banned_until from auth.users where id=$1',[user.id])).rows))[0];
      if(!account) return send(res,400,{error:'invalid_grant',error_description:'Invalid fixture credentials'});
      if(account.banned_until && new Date(account.banned_until)>new Date()) return send(res,400,{error_code:'user_banned',msg:'User is banned'});
      // As Supabase Auth refuses an account whose email was never confirmed.
      if(!refreshing && !user.email_confirmed_at) return send(res,400,{error_code:'email_not_confirmed',msg:'Email not confirmed'});
      const fresh=refreshing?session(await withFactors(user),levels.get(payload.refresh_token),sessionIds.get(payload.refresh_token)):session(await withFactors(user));return send(res,200,fresh);
    }
    const token=(req.headers.authorization || '').replace(/^Bearer /,'');const user=tokens.get(token);
    if (url.pathname==='/auth/v1/user') return user?send(res,200,await withFactors(user)):send(res,401,{msg:'Invalid token'});
    // Backup codes, as Supabase's (experimental) recovery codes: ten single-use codes, a lock after five wrong tries.
    const backupPath=url.pathname.match(/^\/auth\/v1\/factors\/recovery-codes(?:\/(verify|regenerate))?$/);
    if(backupPath) {
      if(!user) return send(res,401,{msg:'Invalid token'});
      const rows=await factorRows(user.id);const row=rows.find(r=>r.factor_type==='recovery_code');const set=backupSets.get(user.id);const step=backupPath[1];
      const fresh=()=>Array.from({length:10},()=>[...randomBytes(16)].map(byte=>'abcdefghijkmnpqrstuvwxyz23456789'[byte%32]).join(''));
      if(req.method==='GET' && !step) return row?send(res,200,{id:row.id,type:'recovery_code',total:set.codes.length,remaining:set.codes.filter(c=>!c.used).length}):send(res,404,{error_code:'mfa_factor_not_found',msg:'Recovery codes not found'});
      if(req.method==='POST' && step==='verify') {
        if(!row) return send(res,422,{error_code:'mfa_verification_failed',msg:'Invalid recovery code'});
        if(set.lockedUntil>Date.now()) return send(res,429,{error_code:'mfa_recovery_codes_locked',msg:'Too many attempts'});
        const typed=String(JSON.parse(body.toString()).code||'').toLowerCase().replace(/[\s-]/g,'');const match=set.codes.find(c=>!c.used && c.code===typed);
        if(!match) {set.failures++;if(set.failures>=5) {set.lockedUntil=Date.now()+300000;set.failures=0;}return send(res,422,{error_code:'mfa_verification_failed',msg:'Invalid recovery code'});}
        match.used=true;set.failures=0;const sessionId=sessionIds.get(token);tokens.delete(token);return send(res,200,session(await withFactors(user),'aal2',sessionId));
      }
      if(req.method==='POST') {
        if(levels.get(token)!=='aal2') return send(res,403,{error_code:'insufficient_aal',msg:'AAL2 required'});
        if(!rows.some(r=>r.factor_type==='totp' && r.status==='verified')) return send(res,422,{error_code:'mfa_recovery_codes_sole_factor',msg:'Another factor is required'});
        if(!step && row) return send(res,422,{error_code:'mfa_verified_factor_exists',msg:'Recovery codes already exist'});
        if(step==='regenerate' && !row) return send(res,404,{error_code:'mfa_factor_not_found',msg:'Recovery codes not found'});
        const id=row?.id || (await locked(async()=>(await db.query("insert into auth.mfa_factors(user_id,friendly_name,factor_type,status) values($1,$2,'recovery_code','verified') returning id",[user.id,'NERUMA backup codes'])).rows[0])).id;
        const codes=fresh();backupSets.set(user.id,{codes:codes.map(code=>({code,used:false})),failures:0,lockedUntil:0});
        return send(res,200,{id,type:'recovery_code',friendly_name:'NERUMA backup codes',total:codes.length,codes});
      }
      return send(res,400,{msg:'Unsupported recovery code request'});
    }
    const factorPath=url.pathname.match(/^\/auth\/v1\/factors(?:\/([0-9a-f-]{36})(?:\/(challenge|verify))?)?$/);
    if(factorPath) {
      if(!user) return send(res,401,{msg:'Invalid token'});
      const [,factorId,step]=factorPath;const rows=await factorRows(user.id);const factor=rows.find(row=>row.id===factorId);
      const payload=body.length?JSON.parse(body.toString()):{};
      if(!factorId && req.method==='POST') {
        if(rows.some(row=>row.status==='verified') && levels.get(token)!=='aal2') return send(res,403,{error_code:'insufficient_aal',msg:'AAL2 required to enroll a new factor'});
        if(rows.some(row=>row.friendly_name===payload.friendly_name)) return send(res,422,{error_code:'mfa_factor_name_conflict',msg:'A factor with this name already exists'});
        const secret=newSecret();
        const created=await locked(async()=>(await db.query("insert into auth.mfa_factors(user_id,friendly_name,status,secret) values($1,$2,'unverified',$3) returning id",[user.id,payload.friendly_name,secret])).rows[0]);
        return send(res,200,{id:created.id,type:'totp',friendly_name:payload.friendly_name,totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><rect width="21" height="21" fill="#fff"/><rect x="1" y="1" width="7" height="7"/></svg>',secret,uri:`otpauth://totp/${payload.issuer}:${user.email}?secret=${secret}&issuer=${payload.issuer}`}});
      }
      if(!factor) return send(res,404,{error_code:'mfa_factor_not_found',msg:'Factor not found'});
      if(!step && req.method==='DELETE') {await locked(()=>db.query('delete from auth.mfa_factors where id=$1',[factor.id]));return send(res,200,{id:factor.id});}
      if(step==='challenge') {const challenge=randomUUID();challenges.set(challenge,factor.id);return send(res,200,{id:challenge,type:'totp',expires_at:Math.floor(Date.now()/1000)+300});}
      if(step==='verify') {
        if(challenges.get(payload.challenge_id)!==factor.id) return send(res,422,{error_code:'mfa_challenge_expired',msg:'Challenge not found'});
        challenges.delete(payload.challenge_id);
        if(!totpMatches(factor.secret,String(payload.code||''))) return send(res,422,{error_code:'mfa_verification_failed',msg:'Invalid TOTP code entered'});
        await locked(()=>db.query("update auth.mfa_factors set status='verified',updated_at=now() where id=$1",[factor.id]));
        const sessionId=sessionIds.get(token);tokens.delete(token);return send(res,200,session(await withFactors(user),'aal2',sessionId));
      }
      return send(res,400,{msg:'Unsupported factor request'});
    }
    if (url.pathname==='/auth/v1/logout') {tokens.delete(token);res.writeHead(204);return res.end();}
    // What a visitor may ask without signing in: schema checks, and the functions that return published data only.
    const anonymousRpc=['workspace_schema_version','organization_verification_schema_version','mandate_evidence_schema_version','publishing_schema_version','two_factor_schema_version','remember_device_schema_version','account_deletion_schema_version','superadmin_schema_version','account_profile_schema_version','payments_schema_version','billing_record_subscription','published_guide','published_places','resolve_qr'].map(name=>`/rest/v1/rpc/${name}`);
    if (!user && !anonymousRpc.includes(url.pathname) && !(req.method==='GET' && url.pathname.startsWith('/storage/v1/object/'))) return send(res,401,{code:'42501',message:'Sign in required'});
    await locked(async()=>{
      await db.exec('begin');
      try {
        await db.exec(`set local role ${user?'authenticated':'anon'}`);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user?.id || '']);
        await db.query("select set_config('request.jwt.claims',$1,true)",[user?JSON.stringify({sub:user.id,aal:levels.get(token)||'aal1',session_id:sessionIds.get(token),iat:signedAt.get(token)}):'']);
        if (url.pathname.startsWith('/rest/v1/rpc/')) {
          const rpc=url.pathname.split('/').at(-1);let result;
          if(rpc==='workspace_schema_version') result=(await db.query('select public.workspace_schema_version() value')).rows[0].value;
          else if(rpc==='publishing_schema_version') result=(await db.query('select public.publishing_schema_version() value')).rows[0].value;
          else if(rpc==='publication_check') {const p=JSON.parse(body.toString());result=(await db.query('select public.publication_check($1,$2) value',[p.org,p.place])).rows[0].value;}
          else if(rpc==='publish_place') {const p=JSON.parse(body.toString());result=(await db.query('select public.publish_place($1,$2,$3,$4) value',[p.org,p.place,p.expected_revision,p.responsibility])).rows[0].value;}
          else if(rpc==='unpublish_place') {const p=JSON.parse(body.toString());result=(await db.query('select public.unpublish_place($1,$2) value',[p.org,p.place])).rows[0].value;}
          else if(rpc==='published_guide') {const p=JSON.parse(body.toString());result=(await db.query('select public.published_guide($1,$2) value',[p.guide_address,p.lang])).rows[0].value;}
          else if(rpc==='published_places') {const p=JSON.parse(body.toString());result=(await db.query('select public.published_places($1) value',[p.lang])).rows[0].value;}
          else if(rpc==='resolve_qr') {const p=JSON.parse(body.toString());result=(await db.query('select public.resolve_qr($1) value',[p.code])).rows[0].value;}
          else if(rpc==='step_fields_schema_version') result=(await db.query('select public.step_fields_schema_version() value')).rows[0].value;
          else if(rpc==='organization_verification_schema_version') {if(!verificationEnabled) throw new Error('Verification migration unavailable');result=(await db.query('select public.organization_verification_schema_version() value')).rows[0].value;}
          else if(rpc==='problem_reports_schema_version') result=(await db.query('select public.problem_reports_schema_version() value')).rows[0].value;
          else if(rpc==='submit_problem_report') {const p=JSON.parse(body.toString());result=(await db.query('select public.submit_problem_report($1,$2,$3,$4) value',[p.org,p.place,p.report_message,p.report_locale])).rows[0].value;}
          else if(rpc==='close_problem_report') {const p=JSON.parse(body.toString());result=(await db.query('select public.close_problem_report($1) value',[p.report])).rows[0].value;}
          else if(rpc==='mandate_evidence_schema_version') {if(!evidenceEnabled) throw new Error('Evidence migration unavailable');result=(await db.query('select public.mandate_evidence_schema_version() value')).rows[0].value;}
          else if(rpc==='reserve_mandate_document') {const p=JSON.parse(body.toString());result=(await db.query('select public.reserve_mandate_document($1,$2,$3,$4) value',[p.original_name,p.content_type,p.bytes,p.digest])).rows[0].value;}
          else if(rpc==='complete_mandate_document') {const p=JSON.parse(body.toString());result=(await db.query('select public.complete_mandate_document($1) value',[p.document_id])).rows[0].value;}
          else if(rpc==='two_factor_schema_version') result=(await db.query('select public.two_factor_schema_version() value')).rows[0].value;
          else if(rpc==='remember_device_schema_version') result=(await db.query('select public.remember_device_schema_version() value')).rows[0].value;
          else if(rpc==='remember_device') result=(await db.query('select public.remember_device() value')).rows[0].value;
          else if(rpc==='trust_this_session') {const p=JSON.parse(body.toString());result=(await db.query('select public.trust_this_session($1) value',[p.device_token])).rows[0].value;}
          else if(rpc==='remembered_devices') result=(await db.query('select public.remembered_devices() value')).rows[0].value;
          else if(rpc==='forget_devices') {const p=JSON.parse(body.toString()||'{}');result=(await db.query('select public.forget_devices($1) value',[p.device??null])).rows[0].value;}
          else if(rpc==='two_factor_status') result=(await db.query('select public.two_factor_status() value')).rows[0].value;
          else if(rpc==='is_platform_admin') result=(await db.query('select public.is_platform_admin() value')).rows[0].value;
          else if(rpc==='submit_organization_application') {const p=JSON.parse(body.toString());result=(await db.query('select public.submit_organization_application($1::jsonb,$2) value',[JSON.stringify(p.application),p.expected_revision??null])).rows[0].value;}
          else if(rpc==='review_organization_application') {const p=JSON.parse(body.toString());result=(await db.query('select public.review_organization_application($1,$2,$3,$4,$5,$6,$7,$8,$9::uuid[]) value',[p.application_id,p.expected_revision,p.decision,p.entity_confirmed,p.mandate_confirmed,p.verified_source,p.evidence_reference,p.applicant_note,p.reviewed_documents])).rows[0].value;}
          else if(rpc==='save_place_draft') {
            const p=JSON.parse(body.toString());
            result=(await db.query('select public.save_place_draft($1,$2,$3,$4,$5::jsonb) value',[p.org,p.place,p.expected_revision,p.content_locale,JSON.stringify(p.draft)])).rows[0].value;
          } else if(simpleRpcs[rpc]) {
            const p=body.length?JSON.parse(body.toString()):{};const names=simpleRpcs[rpc];
            result=(await db.query(`select public.${rpc}(${names.map((_,i)=>`$${i+1}`).join(',')}) value`,names.map(name=>p[name]??null))).rows[0].value;
          } else throw new Error('Unsupported RPC');
          await db.exec('commit');return send(res,200,result);
        }
        if (url.pathname.startsWith('/rest/v1/')) {
          const table=url.pathname.split('/').at(-1);if(!tables.has(table) || req.method!=='GET') throw new Error('Unsupported REST request');
          const values=[];const filters=[];
          for(const [key,value] of url.searchParams) {
            if(['select','order','limit','offset'].includes(key)) continue;
            const [op,...rest]=value.split('.');if(!['eq','neq','in'].includes(op)) throw new Error('Unsupported filter');
            const filterValue=rest.join('.');
            if(op==='in') {values.push(filterValue.replace(/^\(|\)$/g,'').split(','));filters.push(`${safe(key)}::text = any($${values.length})`);continue;}values.push(filterValue==='true'?true:filterValue==='false'?false:filterValue);filters.push(`${safe(key)} ${op==='eq'?'=':'<>'} $${values.length}`);
          }
          const ordering=(url.searchParams.get('order') || '').split(',').filter(Boolean).map(item=>{const [key,dir]=item.split('.');return `${safe(key)} ${dir==='desc'?'desc':'asc'}`;}).join(',');
          const limit=Math.min(100,Number(url.searchParams.get('limit') || 100));
          const offset=Math.max(0,Number(url.searchParams.get('offset')||0));
          const query=`select * from public.${table}${filters.length?' where '+filters.join(' and '):''}${ordering?' order by '+ordering:''} limit ${limit} offset ${offset}`;
          const rows=(await db.query(query,values)).rows;
          // Embedded child rows of a place, as PostgREST returns them: the columns named inside each name(...).
          if(table==='places') for(const [child,columns] of [...(url.searchParams.get('select')||'').matchAll(/\b(place_translations|zones|zone_translations|media_assets|qr_redirects)\(([^)]*)\)/g)].map(m=>[m[1],m[2]])) for(const row of rows) row[child]=(await db.query(`select ${columns.split(',').map(safe).join(',')} from public.${child} where place_id=$1`,[row.id])).rows;
          for(const row of rows) if(row.photographed_on instanceof Date) row.photographed_on=row.photographed_on.toISOString().slice(0,10);
          await db.exec('commit');
          if(req.headers.accept?.includes('vnd.pgrst.object')) return rows.length===1?send(res,200,rows[0]):send(res,406,{code:'PGRST116',details:`The result contains ${rows.length} rows`,message:'JSON object requested, multiple (or no) rows returned'});
          return send(res,200,rows);
        }
        if(url.pathname.startsWith('/storage/v1/object/')) {
          const signing=url.pathname.startsWith('/storage/v1/object/sign/');
          const rest=url.pathname.slice((signing?'/storage/v1/object/sign/':'/storage/v1/object/').length).replace(/^authenticated\//,'');const [bucket,...parts]=rest.split('/');const key=decodeURIComponent(parts.join('/'));
          if(!['vianorae-private-photos','vianorae-mandate-evidence','vianorae-account-exports'].includes(bucket)) throw new Error('Unsupported bucket');
          if(signing && req.method==='POST') {
            const visible=(await db.query('select name from storage.objects where bucket_id=$1 and name=$2',[bucket,key])).rows.length;
            await db.exec('commit');if(!visible) return send(res,400,{message:'Object not found'});
            const linkToken=randomUUID();const expiresIn=Number(JSON.parse(body.toString()||'{}').expiresIn)||60;
            signedLinks.set(linkToken,{key,expires:Date.now()+expiresIn*1000});
            return send(res,200,{signedURL:`/object/sign/${bucket}/${key}?token=${linkToken}`});
          }
          // Removing files: Storage looks them up and deletes them with the caller's rights.
          if(req.method==='DELETE' && !parts.length) {
            const names=JSON.parse(body.toString()||'{}').prefixes||[];
            const removed=(await db.query('delete from storage.objects where bucket_id=$1 and name=any($2::text[]) returning name',[bucket,names])).rows;
            await db.exec('commit');for(const row of removed) files.delete(row.name);
            return send(res,200,removed.map(row=>({name:row.name,bucket_id:bucket})));
          }
          if(req.method==='POST') {
            await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,key]);files.set(key,body);
            await db.exec('commit');return send(res,200,{Key:`${bucket}/${key}`,Id:randomUUID()});
          }
          if(req.method==='GET') {
            const visible=(await db.query('select name from storage.objects where bucket_id=$1 and name=$2',[bucket,key])).rows.length;
            await db.exec('commit');if(!visible || !files.has(key)) return send(res,404,{message:'Object not found'});
            res.writeHead(200,{'Content-Type':bucket==='vianorae-private-photos'?'image/webp':key.endsWith('.pdf')?'application/pdf':key.endsWith('.png')?'image/png':'image/jpeg'});return res.end(files.get(key));
          }
        }
        throw new Error(`Unsupported fixture request ${url.pathname}`);
      } catch(error) {
        await db.exec('rollback');console.error(error.code || '',error.message);
        send(res,error.code==='42501'?403:400,{code:error.code || 'FIXTURE',message:error.message});
      }
    });
  } catch(error) {console.error(error);send(res,500,{message:'Fixture failure'});}
}).listen(3012,'127.0.0.1',()=>console.log('VIANORAE test fixture ready on loopback:3012'));
