// Loopback-only Supabase API fixture backed by the real migrations and Postgres RLS.
// Auth and Storage HTTP services are simulated; no remote project is contacted.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID, createHmac, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
if (process.env.VIANORAE_TEST_FIXTURE !== '1') throw new Error('Test fixture must be explicitly enabled');
// One shared password for every mock user. Test-only: this fixture is a fake Supabase and never runs in a real environment.
const FIXTURE_PASSWORD='Fixture-only-passphrase-123';
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const users = [1,2,3,4,5].map(n => ({id:id(n),aud:'authenticated',role:'authenticated',email:`owner${n}@example.test`,email_confirmed_at:'2026-10-01T12:00:00Z',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-01T12:00:00Z'}));
let verificationEnabled=true;let evidenceEnabled=true;
const files = new Map(); const tokens = new Map(); let tail = Promise.resolve();
const locked = fn => {const result=tail.then(fn);tail=result.catch(()=>{});return result;};
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz default now(),is_anonymous boolean not null default false,email text default 'fixture@example.test');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated;
create schema storage;create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,unique(bucket_id,name));
alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated,service_role;grant all on storage.objects to authenticated,service_role;grant all on storage.buckets to service_role;`);
for (const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
for (let n=1;n<=2;n++) {
  await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),users[n-1].email]);
  await db.query("insert into public.organizations(id,name,approval_status) values($1,$2,'approved')",[id(100+n),`Fixture museum ${n}`]);
  await db.query('insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3)',[id(100+n),id(n),'owner']);
}
for(let n=3;n<=5;n++) await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),users[n-1].email]);
await db.query('insert into private.platform_admins(user_id) values($1)',[id(3)]);
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
function session(user) {
  const now=Math.floor(Date.now()/1000);
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,aud:'authenticated',role:'authenticated',iss:'https://vianorae-fixture.supabase.co/auth/v1',iat:now,exp:now+3600,email:user.email,is_anonymous:false})}`;
  const access=`${unsigned}.${createHmac('sha256','fixture-only-key').update(unsigned).digest('base64url')}`;
  const refresh=randomUUID();tokens.set(access,user);tokens.set(refresh,user);
  return {access_token:access,refresh_token:refresh,token_type:'bearer',expires_in:3600,expires_at:now+3600,user};
}
const send=(res,status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(value));};
const safe=value=>{if(!/^[a-z_]+$/.test(value)) throw new Error('Unsafe identifier');return value;};
const tables=new Set(['organizations','organization_members','places','place_translations','zones','zone_translations','zone_fields','zone_field_translations','sensory_profiles','media_assets','guides','guide_steps','organization_applications','organization_review_events','organization_evidence_documents']);
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:3012');const chunks=[];for await(const chunk of req) chunks.push(chunk);const body=Buffer.concat(chunks);
    if(url.pathname==='/__fixture/verification-mode' && req.method==='POST') {verificationEnabled=JSON.parse(body.toString()).enabled;return send(res,200,{verificationEnabled});}
    if(url.pathname==='/__fixture/evidence-mode' && req.method==='POST') {evidenceEnabled=JSON.parse(body.toString()).enabled;return send(res,200,{evidenceEnabled});}
    if (url.pathname==='/health') return send(res,200,{ready:true});
    if(url.pathname==='/auth/v1/signup' || url.pathname==='/auth/v1/resend') {
      const payload=JSON.parse(body.toString());
      if(payload.email==='limited@example.test') return send(res,429,{error_code:'over_email_send_rate_limit',msg:'Email rate limit exceeded'});
      if(payload.email==='unauthorized@example.test') return send(res,400,{error_code:'email_address_not_authorized',msg:'Address not authorized'});
      if(url.pathname==='/auth/v1/resend') return send(res,200,{});
      return send(res,200,{id:id(20),aud:'authenticated',role:'authenticated',email:payload.email,email_confirmed_at:null,is_anonymous:false,app_metadata:{provider:'email'},user_metadata:payload.data||{},identities:[],created_at:new Date().toISOString()});
    }
    if (url.pathname==='/auth/v1/token') {
      const payload=JSON.parse(body.toString());const user=url.searchParams.get('grant_type')==='refresh_token'?tokens.get(payload.refresh_token):users.find(u=>u.email===payload.email && payload.password===FIXTURE_PASSWORD);
      return send(res,user?200:400,user?session(user):{error:'invalid_grant',error_description:'Invalid fixture credentials'});
    }
    const token=(req.headers.authorization || '').replace(/^Bearer /,'');const user=tokens.get(token);
    if (url.pathname==='/auth/v1/user') return send(res,user?200:401,user || {msg:'Invalid token'});
    if (url.pathname==='/auth/v1/logout') {tokens.delete(token);res.writeHead(204);return res.end();}
    if (!user && !['/rest/v1/rpc/workspace_schema_version','/rest/v1/rpc/organization_verification_schema_version','/rest/v1/rpc/mandate_evidence_schema_version'].includes(url.pathname)) return send(res,401,{code:'42501',message:'Sign in required'});
    await locked(async()=>{
      await db.exec('begin');
      try {
        await db.exec(`set local role ${user?'authenticated':'anon'}`);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user?.id || '']);
        if (url.pathname.startsWith('/rest/v1/rpc/')) {
          const rpc=url.pathname.split('/').at(-1);let result;
          if(rpc==='workspace_schema_version') result=(await db.query('select public.workspace_schema_version() value')).rows[0].value;
          else if(rpc==='step_fields_schema_version') result=(await db.query('select public.step_fields_schema_version() value')).rows[0].value;
          else if(rpc==='organization_verification_schema_version') {if(!verificationEnabled) throw new Error('Verification migration unavailable');result=(await db.query('select public.organization_verification_schema_version() value')).rows[0].value;}
          else if(rpc==='mandate_evidence_schema_version') {if(!evidenceEnabled) throw new Error('Evidence migration unavailable');result=(await db.query('select public.mandate_evidence_schema_version() value')).rows[0].value;}
          else if(rpc==='reserve_mandate_document') {const p=JSON.parse(body.toString());result=(await db.query('select public.reserve_mandate_document($1,$2,$3,$4) value',[p.original_name,p.content_type,p.bytes,p.digest])).rows[0].value;}
          else if(rpc==='complete_mandate_document') {const p=JSON.parse(body.toString());result=(await db.query('select public.complete_mandate_document($1) value',[p.document_id])).rows[0].value;}
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
          if(table==='places') for(const [child,columns] of [...(url.searchParams.get('select')||'').matchAll(/\b(place_translations|zones|zone_translations|media_assets)\(([^)]*)\)/g)].map(m=>[m[1],m[2]])) for(const row of rows) row[child]=(await db.query(`select ${columns.split(',').map(safe).join(',')} from public.${child} where place_id=$1`,[row.id])).rows;
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
