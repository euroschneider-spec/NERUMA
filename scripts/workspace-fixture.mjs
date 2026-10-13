// Loopback-only Supabase API fixture backed by the real migrations and Postgres RLS.
// Auth and Storage HTTP services are simulated; no remote project is contacted.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID, randomBytes, createHmac, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { FIXTURE_ADMIN_TOTP_SECRET, newSecret, totpMatches } from './fixture-totp.mjs';
if (process.env.VIANORAE_TEST_FIXTURE !== '1') throw new Error('Test fixture must be explicitly enabled');
// One shared password for every mock user. Test-only: this fixture is a fake Supabase and never runs in a real environment.
const FIXTURE_PASSWORD='Fixture-only-passphrase-123';
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const users = [1,2,3,4,5].map(n => ({id:id(n),aud:'authenticated',role:'authenticated',email:`owner${n}@example.test`,email_confirmed_at:'2026-10-01T12:00:00Z',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-01T12:00:00Z'}));
let verificationEnabled=true;let evidenceEnabled=true;
const files = new Map(); const tokens = new Map(); const levels = new Map(); const sessionIds = new Map(); const challenges = new Map(); const backupSets = new Map(); let tail = Promise.resolve();
const locked = fn => {const result=tail.then(fn);tail=result.catch(()=>{});return result;};
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz default now(),is_anonymous boolean not null default false,email text default 'fixture@example.test',encrypted_password text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),friendly_name text,factor_type text not null default 'totp',status text not null default 'unverified',secret text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated;
create schema storage;create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,unique(bucket_id,name));
alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated,service_role;grant all on storage.objects to authenticated,service_role;grant select on storage.objects to anon;grant all on storage.buckets to service_role;`);
for (const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
for (let n=1;n<=2;n++) {
  await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),users[n-1].email]);
  await db.query("insert into public.organizations(id,name,approval_status) values($1,$2,'approved')",[id(100+n),`Fixture museum ${n}`]);
  await db.query('insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3)',[id(100+n),id(n),'owner']);
}
for(let n=3;n<=5;n++) await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),users[n-1].email]);
await db.query('insert into private.platform_admins(user_id) values($1)',[id(3)]);
// The platform administrator has an authenticator app from the start (code: node scripts/fixture-totp.mjs).
await db.query("insert into auth.mfa_factors(user_id,friendly_name,status,secret) values($1,'NERUMA','verified',$2)",[id(3),FIXTURE_ADMIN_TOTP_SECRET]);
// Browsing data for npm run dev:mock only; the test suite never sets this, so its starting state is unchanged.
// owner2 owns the fictional Willow Museum (five zones from supabase/seed.sql); owner5 has a request waiting for review.
if (process.env.VIANORAE_FIXTURE_DEMO_DATA === '1') {
  const willow='a0000000-0000-4000-8000-000000000001';
  await db.exec(await readFile('supabase/seed.sql','utf8'));
  await db.query("update public.organizations set approval_status='approved' where id=$1",[willow]);
  await db.query('delete from public.organization_members where user_id=$1',[id(2)]);
  await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')",[willow,id(2)]);
  const application=(await db.query(`insert into public.organization_applications(applicant_id,applicant_email,organization_name,organization_type,country_code,official_website,registry_reference,representative_name,representative_role,authorization_description,statement_version,statement_locale)
    values($1,'owner5@example.test','Linden Gallery (fictional)','museum','RO','https://linden-gallery.example.test','RO-REG-0042','Ana Popescu (fictional)','Director','The city cultural office can confirm the director appointment by phone. A signed authorisation is attached.','2026-10-07-v1','en') returning id`,[id(5)])).rows[0].id;
  const pdf=Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
  const documentId=randomUUID();const key=`${id(5)}/${documentId}.pdf`;
  await db.query(`insert into public.organization_evidence_documents(id,applicant_id,application_id,storage_key,filename,mime_type,byte_size,sha256,uploaded_at)
    values($1,$2,$3,$4,'signed-authorisation.pdf','application/pdf',$5,$6,now())`,[documentId,id(5),application,key,pdf.length,createHash('sha256').update(pdf).digest('hex')]);
  await db.query("insert into storage.objects(bucket_id,name) values('vianorae-mandate-evidence',$1)",[key]);
  await db.query('update public.organization_applications set evidence_document_ids=array[$1::uuid] where id=$2',[documentId,application]);
  files.set(key,pdf);
}
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
  const refresh=randomUUID();tokens.set(access,user);tokens.set(refresh,user);levels.set(access,aal);levels.set(refresh,aal);sessionIds.set(access,sessionId);sessionIds.set(refresh,sessionId);
  return {access_token:access,refresh_token:refresh,token_type:'bearer',expires_in:3600,expires_at:now+3600,user};
}
const send=(res,status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(value));};
const safe=value=>{if(!/^[a-z_]+$/.test(value)) throw new Error('Unsafe identifier');return value;};
const tables=new Set(['organizations','organization_members','places','place_translations','zones','zone_translations','zone_fields','zone_field_translations','sensory_profiles','media_assets','guides','guide_steps','organization_applications','organization_review_events','organization_evidence_documents','problem_reports']);
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:3012');const chunks=[];for await(const chunk of req) chunks.push(chunk);const body=Buffer.concat(chunks);
    if(url.pathname==='/__fixture/verification-mode' && req.method==='POST') {verificationEnabled=JSON.parse(body.toString()).enabled;return send(res,200,{verificationEnabled});}
    if(url.pathname==='/__fixture/evidence-mode' && req.method==='POST') {evidenceEnabled=JSON.parse(body.toString()).enabled;return send(res,200,{evidenceEnabled});}
    if(url.pathname==='/__fixture/two-factor-deadline' && req.method==='POST') {
      const from=JSON.parse(body.toString()).from;
      await locked(()=>db.query('update private.two_factor_policy set organisations_from=$1',[from]));return send(res,200,{from});
    }
    if (url.pathname==='/health') return send(res,200,{ready:true});
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
    const anonymousRpc=['workspace_schema_version','organization_verification_schema_version','mandate_evidence_schema_version','publishing_schema_version','two_factor_schema_version','remember_device_schema_version','published_guide','published_places','resolve_qr'].map(name=>`/rest/v1/rpc/${name}`);
    if (!user && !anonymousRpc.includes(url.pathname) && !(req.method==='GET' && url.pathname.startsWith('/storage/v1/object/'))) return send(res,401,{code:'42501',message:'Sign in required'});
    await locked(async()=>{
      await db.exec('begin');
      try {
        await db.exec(`set local role ${user?'authenticated':'anon'}`);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user?.id || '']);
        await db.query("select set_config('request.jwt.claims',$1,true)",[user?JSON.stringify({sub:user.id,aal:levels.get(token)||'aal1',session_id:sessionIds.get(token)}):'']);
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
          } else throw new Error('Unsupported RPC');
          await db.exec('commit');return send(res,200,result);
        }
        if (url.pathname.startsWith('/rest/v1/')) {
          const table=url.pathname.split('/').at(-1);if(!tables.has(table) || req.method!=='GET') throw new Error('Unsupported REST request');
          const values=[];const filters=[];
          for(const [key,value] of url.searchParams) {
            if(['select','order','limit','offset'].includes(key)) continue;
            const [op,...rest]=value.split('.');if(!['eq','neq'].includes(op)) throw new Error('Unsupported filter');
            const filterValue=rest.join('.');values.push(filterValue==='true'?true:filterValue==='false'?false:filterValue);filters.push(`${safe(key)} ${op==='eq'?'=':'<>'} $${values.length}`);
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
          const rest=url.pathname.slice('/storage/v1/object/'.length).replace(/^authenticated\//,'');const [bucket,...parts]=rest.split('/');const key=decodeURIComponent(parts.join('/'));
          if(!['vianorae-private-photos','vianorae-mandate-evidence'].includes(bucket)) throw new Error('Unsupported bucket');
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
