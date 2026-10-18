import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createSupabaseLikeDatabase } from './pglite-supabase.mjs';
const db=await createSupabaseLikeDatabase();let checks=0;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1),admin=id(2),editor=id(3),outsider=id(4),ownerB=id(5),assessor=id(6),reviewer=id(7),dual=id(8);
const orgA=id(101),orgB=id(102),placeA=id(201),placeB=id(202),guideA=id(301),guideB=id(302),zoneA=id(401),zoneB=id(402),profileA=id(501);
async function check(name,fn){await fn();checks++;console.log(`PASS ${name}`);}
// Sessions are fully signed in (aal2) unless a check says otherwise, as after a password and an authenticator code.
// Each user has one default session id unless a check names another (remembered devices trust one session at a time).
// iat: when the session was signed in (now, unless a check pretends otherwise; deleting an account needs a fresh sign-in).
async function as(user,role='authenticated',aal='aal2',session=user,iat=Math.floor(Date.now()/1000)){await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${user||''}',false); select set_config('request.jwt.claims','${user?JSON.stringify({sub:user,aal,session_id:session,iat}):''}',false);`);}
async function count(table){return (await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n;}
async function denied(sql){await assert.rejects(()=>db.exec(sql));}
await check('all 31 public tables use RLS',async()=>{const result=await db.query("select tablename from pg_tables where schemaname='public' and not rowsecurity");assert.deepEqual(result.rows,[]);assert.equal((await db.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n,31);});
await db.exec(`insert into auth.users values ${[owner,admin,editor,outsider,ownerB,assessor,reviewer,dual].map(x=>`('${x}')`).join(',')};
insert into public.organizations(id,name,approval_status) values('${orgA}','Demo A','approved'),('${orgB}','Demo B','approved');
insert into public.organization_members(organization_id,user_id,role) values('${orgA}','${owner}','owner'),('${orgA}','${admin}','admin'),('${orgA}','${editor}','editor'),('${orgB}','${ownerB}','owner'),('${orgA}','${assessor}','assessor'),('${orgA}','${reviewer}','reviewer'),('${orgA}','${dual}','owner'),('${orgB}','${dual}','owner');
insert into public.places(id,organization_id,slug,city) values('${placeA}','${orgA}','demo-a','Example A'),('${placeB}','${orgB}','demo-b','Example B');
insert into public.zones(id,place_id,organization_id,type,sort_order) values('${zoneA}','${placeA}','${orgA}','entrance',0),('${zoneB}','${placeB}','${orgB}','entrance',0);
insert into public.sensory_profiles(id,zone_id,place_id,organization_id) values('${profileA}','${zoneA}','${placeA}','${orgA}');
insert into public.guides(id,place_id,organization_id,locale) values('${guideA}','${placeA}','${orgA}','en'),('${guideB}','${placeB}','${orgB}','en');
insert into public.guide_versions(guide_id,place_id,organization_id,version,created_by,content) values('${guideA}','${placeA}','${orgA}',1,'${owner}','{"source_level":"venue_provided","zones":[{"title":"Entrance"},{"title":"Gallery"},{"title":"Quiet room"}]}');
update public.guides set status='published',current_version=1,published_at=now() where id='${guideA}';
insert into public.qr_redirects(public_code,place_id,organization_id,guide_id) values('demo-a','${placeA}','${orgA}','${guideA}');`);
await as(null,'anon');
await check('anonymous visitor sees only published guide and snapshot',async()=>{assert.equal(await count('guides'),1);assert.equal(await count('guide_versions'),1);assert.equal(await count('qr_redirects'),1);});
await check('anonymous visitor cannot read internal data or write',async()=>{for(const table of ['organizations','organization_members','zones','users','audit_log','measurements','assessments'])await denied(`select * from public.${table}`);await denied(`update public.guides set status='archived'`);await denied(`delete from public.guides`);});
await as(editor);
await check('editor reads only their organisation draft data',async()=>{assert.equal(await count('places'),1);assert.equal(await count('zones'),1);assert.equal(await count('organizations'),1);});
await check('editor can edit draft zone without altering public snapshot',async()=>{await db.exec(`insert into public.zone_translations(zone_id,place_id,organization_id,locale,title) values('${zoneA}','${placeA}','${orgA}','en','Edited draft entrance')`);const content=(await db.query('select content from public.guide_versions')).rows[0].content;assert.equal(content.zones[0].title,'Entrance');});
await check('editor cannot publish, forge provenance or escalate membership',async()=>{await denied(`update public.guides set status='archived' where id='${guideA}'`);await denied(`insert into public.guides(place_id,organization_id,locale,status,current_version,published_at) values('${placeA}','${orgA}','ro','published',1,now())`);await denied(`insert into public.organization_members values('${orgA}','${outsider}','owner',now())`);assert.equal((await db.query(`update public.organization_members set role='owner' where user_id='${editor}' returning user_id`)).rows.length,0);await denied(`update public.sensory_profiles set source_level='assessor_verified'`);});
await check('cross-tenant writes are denied',async()=>{await denied(`insert into public.zones(place_id,organization_id,type,sort_order) values('${placeB}','${orgB}','gallery',1)`);const r=await db.query(`update public.zones set type='forged' where id='${zoneB}' returning id`);assert.equal(r.rows.length,0);});
await as(outsider);
await check('a signed-in outsider sees no organisation content',async()=>{assert.equal(await count('places'),0);assert.equal(await count('zones'),0);assert.equal(await count('organizations'),0);assert.equal(await count('organization_members'),0);});
await check('user metadata cannot grant platform administration',async()=>{await db.exec(`select set_config('request.jwt.claims','{"user_metadata":{"role":"superadmin"}}',false)`);assert.equal(await count('places'),0);});
await as(dual);
await check('composite FKs reject cross-place steps, profiles and parent zones',async()=>{await denied(`insert into public.guide_steps(guide_id,place_id,organization_id,zone_id,sort_order) values('${guideA}','${placeA}','${orgA}','${zoneB}',0)`);await denied(`insert into public.sensory_profiles(zone_id,place_id,organization_id) values('${zoneB}','${placeA}','${orgA}')`);await denied(`update public.zones set parent_zone_id='${zoneB}' where id='${zoneA}'`);});
await check('tenant reassignment is blocked for dual-org owners',async()=>{await denied(`update public.places set organization_id='${orgB}' where id='${placeA}'`);});
await as(admin);
await check('only valid snapshots can be created; published versions are immutable',async()=>{await denied(`insert into public.guide_versions(guide_id,place_id,organization_id,version,content) values('${guideA}','${placeA}','${orgA}',2,'{}')`);await denied(`insert into public.guide_versions(guide_id,place_id,organization_id,version,source_level,content) values('${guideA}','${placeA}','${orgA}',2,'independent_audit','{"source_level":"venue_provided","zones":[{},{},{}]}')`);await denied(`update public.guide_versions set content='{}'`);await denied(`delete from public.guide_versions`);});
await check('admin can create and point to a new published snapshot',async()=>{await db.exec(`insert into public.guide_versions(guide_id,place_id,organization_id,version,content) values('${guideA}','${placeA}','${orgA}',2,'{"source_level":"venue_provided","zones":[{"title":"Updated entrance"},{},{}]}');update public.guides set current_version=2 where id='${guideA}';`);assert.equal(await count('guide_versions'),2);});
await check('admin cannot manage owners or forge audit records',async()=>{await denied(`insert into public.organization_members values('${orgA}','${outsider}','owner',now())`);await denied(`insert into public.audit_log(organization_id,entity_type,entity_id,action,after_json) values('${orgA}','guides','forged','UPDATE','{}')`);assert.ok((await count('audit_log'))>0);});
await as(null,'anon');
await check('public reads current version, never older or draft snapshots',async()=>{assert.equal(await count('guide_versions'),1);assert.equal((await db.query('select version from public.guide_versions')).rows[0].version,2);});
await as(owner);
await check('owner can add an editor within their own organisation',async()=>{await db.exec(`insert into public.organization_members(organization_id,user_id,role) values('${orgA}','${outsider}','editor')`);});
await db.exec('reset role');
const assessorId=id(601),assessmentId=id(701);
await db.exec(`insert into public.assessors(id,user_id,training_status) values('${assessorId}','${assessor}','trained');
insert into public.assessments(id,place_id,organization_id,method,protocol_version,assessed_on,valid_until,assessor_id,source_level) values('${assessmentId}','${placeA}','${orgA}','on-site','0.1','2026-10-06','2027-10-06','${assessorId}','assessor_verified');
insert into public.assessment_assignments values('${assessmentId}','${placeA}','${orgA}','${assessor}','assessor');`);
await as(assessor);
await check('assigned assessor reads their assessment; pilot client writes stay closed',async()=>{assert.equal(await count('assessments'),1);await denied(`update public.assessments set status='approved'`);await denied(`insert into public.assessment_assignments values('${assessmentId}','${placeA}','${orgA}','${outsider}','assessor')`);});
await as(reviewer);
await check('unassigned reviewer cannot read an assessment',async()=>{assert.equal(await count('assessments'),0);});
await db.exec('reset role');
await check('measurement units and provenance dates are validated',async()=>{await denied(`insert into public.measurements(profile_id,place_id,organization_id,assessment_id,metric,value,unit,instrument,measured_at,assessor_id) values('${profileA}','${placeA}','${orgA}','${assessmentId}','sound',55,'lux','example meter',now(),'${assessorId}')`);await denied(`insert into public.assessments(place_id,organization_id,method,protocol_version,assessed_on,valid_until,assessor_id,source_level) values('${placeA}','${orgA}','on-site','0.1','2026-10-06','2026-01-01','${assessorId}','assessor_verified')`);});
await check('client roles have no deletion privileges on any public table',async()=>{const result=await db.query("select tablename from pg_tables where schemaname='public' and (has_table_privilege('anon','public.'||tablename,'DELETE') or has_table_privilege('authenticated','public.'||tablename,'DELETE'))");assert.deepEqual(result.rows,[]);});
const newOwner=id(9),unverified=id(10),anonymous=id(11);
await db.exec(`insert into auth.users(id,email_confirmed_at,is_anonymous) values('${newOwner}',now(),false),('${unverified}',null,false),('${anonymous}',now(),true);`);
await as(null,'anon');
await check('anonymous visitors cannot onboard an organisation',async()=>{await denied("select public.create_organisation('New Museum','museum','Demo representative',true,'en')");});
await as(unverified);
await check('unverified accounts cannot onboard an organisation',async()=>{await denied("select public.create_organisation('New Museum','museum','Demo representative',true,'en')");});
await as(anonymous);
await check('anonymous auth accounts cannot onboard an organisation',async()=>{await denied("select public.create_organisation('New Museum','museum','Demo representative',true,'en')");});
await as(newOwner);
const platformAdmin=id(12),legacyOwner=id(13),legacyOrg=id(103),legacyPlace=id(203);
await db.exec('reset role');
await db.exec(`insert into auth.users(id) values('${platformAdmin}'),('${legacyOwner}');insert into private.platform_admins values('${platformAdmin}');
 insert into public.organizations(id,name) values('${legacyOrg}','Legacy Museum');
 insert into public.organization_members(organization_id,user_id,role) values('${legacyOrg}','${legacyOwner}','owner');
 insert into public.places(id,organization_id,slug,city) values('${legacyPlace}','${legacyOrg}','legacy-museum','Legacy City');`);
const application={organisation:'New Museum',type:'museum',representative:'Demo representative',website:'https://museum.example.test',country:'RO',registry:'Museum register fixture 12',representativeRole:'Director',authorization:'Official director; authority confirmed through the registered office.',locale:'en',authority:true,responsibility:true};
const evidenceByUser=new Map();
async function uploadEvidence() {
 const doc=(await db.query("select public.reserve_mandate_document('mandate.pdf','application/pdf',123,repeat('a',64)) id")).rows[0].id;
 const row=(await db.query('select * from public.organization_evidence_documents where id=$1',[doc])).rows[0];
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['vianorae-mandate-evidence',row.storage_key]);await db.query('select public.complete_mandate_document($1)',[doc]);return doc;
}
const submit=async(payload=application,revision=null)=>(await db.query('select public.submit_organization_application($1::jsonb,$2) id',[JSON.stringify({...payload,documents:payload.documents || evidenceByUser.get((await db.query('select auth.uid() id')).rows[0].id) || []}),revision])).rows[0].id;
const review=async(request,revision,decision='approved',entity=true,mandate=true,source='https://registry.example.test/museum',evidence='Confirmed with the independently obtained registered office contact on 2026-10-07',note='Your representation has been verified.')=>(await db.query('select public.review_organization_application($1,$2,$3,$4,$5,$6,$7,$8,$9::uuid[]) id',[request,revision,decision,entity,mandate,source,evidence,note,decision==='approved'?((await db.query('select evidence_document_ids from public.organization_applications where id=$1',[request])).rows[0]?.evidence_document_ids || []):[]])).rows[0].id;
await as(null,'anon');
await check('anonymous visitor cannot submit a verification application',async()=>{await assert.rejects(()=>submit());});
await check('anonymous access to mandate storage and reservations is denied',async()=>{await assert.rejects(()=>uploadEvidence());await denied('select * from public.organization_evidence_documents');});
await as(unverified);
await check('unconfirmed email cannot submit a verification application',async()=>{await assert.rejects(()=>submit());});
await as(anonymous);
await check('anonymous Auth identity cannot submit a verification application',async()=>{await assert.rejects(()=>submit());});
await check('anonymous Auth identities cannot reserve mandate documents',async()=>{await assert.rejects(()=>uploadEvidence());});
await as(newOwner);
await check('the old onboarding RPC and private bypass remain disabled',async()=>{await denied("select public.create_organisation('New Museum','museum','Demo representative',true,'en')");await denied("select private.create_organisation('New Museum','museum','Demo representative',true,'en')");});
await check('invalid identity details or absent acceptance cannot submit',async()=>{for(const patch of [{authority:false},{responsibility:false},{website:'javascript:alert(1)'},{country:'forged'},{representativeRole:''},{authorization:'unverified'}])await assert.rejects(()=>submit({...application,...patch}));});
let applicationId,newOrg;
await check('oversize, unsafe names and unsupported document types are rejected',async()=>{for(const args of [['../file.pdf','application/pdf',123],['mandate.pdf','text/html',123],['mandate.pdf','application/pdf',3145729]])await assert.rejects(()=>db.query("select public.reserve_mandate_document($1,$2,$3,repeat('a',64))",args));});
await check('mandate proof must exist before submission and cannot be fabricated',async()=>{
 await assert.rejects(()=>submit(),/mandate documents/i);
 const doc=(await db.query("select public.reserve_mandate_document('mandate.pdf','application/pdf',123,repeat('a',64)) id")).rows[0].id;
 await assert.rejects(()=>submit({...application,documents:[doc]}),/uploaded by/);
 await denied("insert into public.organization_evidence_documents(applicant_id,storage_key,filename,mime_type,byte_size,sha256) values(auth.uid(),'forged','mandate.pdf','application/pdf',10,repeat('a',64))");
 evidenceByUser.set(newOwner,[await uploadEvidence()]);
});
await check('confirmed email submits a pending request without tenant or membership',async()=>{applicationId=await submit();assert.equal(await count('organizations'),0);assert.equal(await count('organization_members'),0);assert.equal((await db.query('select status from public.organization_applications')).rows[0].status,'pending');assert.equal(await submit({...application,organisation:'Forged replacement'}),applicationId);assert.equal((await db.query('select organization_name from public.organization_applications')).rows[0].organization_name,'New Museum');});
await check('applicant cannot approve, change status, forge evidence or grant platform admin',async()=>{await assert.rejects(()=>review(applicationId,1));await denied("update public.organization_applications set status='approved'");await denied("insert into private.platform_admins values(auth.uid())");await denied("update public.organizations set approval_status='approved'");await denied("insert into public.organization_review_events(application_id,actor_id,decision,application_revision,application_snapshot,entity_confirmed,mandate_confirmed,verified_source,evidence_reference,applicant_note) values(gen_random_uuid(),auth.uid(),'approved',1,'{}',true,true,'forged','forged','forged')");assert.equal(await count('organization_review_events'),0);});
await check('submitted mandate evidence cannot be replaced or changed by the applicant',async()=>{const doc=evidenceByUser.get(newOwner)[0];const row=(await db.query('select * from public.organization_evidence_documents where id=$1',[doc])).rows[0];await denied("update public.organization_evidence_documents set filename='forged.pdf'");assert.equal((await db.query('update storage.objects set name=$1 where name=$1 returning name',[row.storage_key])).rows.length,0);assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[row.storage_key])).rows.length,0);await assert.rejects(()=>uploadEvidence(),/locked/);});
await as(admin);
await check('organisation admins are not platform reviewers and cannot see other applications',async()=>{assert.equal((await db.query('select public.is_platform_admin() ok')).rows[0].ok,false);assert.equal(await count('organization_applications'),0);await assert.rejects(()=>review(applicationId,1));});
await check('unrelated authenticated accounts cannot read or substitute private evidence',async()=>{assert.equal(await count('organization_evidence_documents'),0);assert.equal((await db.query("select name from storage.objects where bucket_id='vianorae-mandate-evidence'")).rows.length,0);});
await as(platformAdmin);
await check('approval requires both independent checks, source and mandate evidence',async()=>{for(const args of [[false,true],[true,false],[true,true,''],[true,true,'https://registry.example.test','']])await assert.rejects(()=>review(applicationId,1,'approved',...args));assert.equal((await db.query('select status from public.organization_applications where id=$1',[applicationId])).rows[0].status,'pending');});
await check('legacy approval bypass and absent document review are denied',async()=>{await assert.rejects(()=>db.query('select public.review_organization_application($1,1,$2,true,true,$3,$4,$5)',[applicationId,'approved','https://registry.example.test','Verified independent mandate contact','Verified account mandate.']));await assert.rejects(()=>db.query('select public.review_organization_application($1,1,$2,true,true,$3,$4,$5,$6::uuid[])',[applicationId,'approved','https://registry.example.test','Verified independent mandate contact','Verified account mandate.',[]]),/must be reviewed/);});
await check('requesting more information is audited and preserves pending access',async()=>{await review(applicationId,1,'needs_information',false,false,'','','Please provide the official authorisation reference.');assert.equal((await db.query('select status from public.organization_applications where id=$1',[applicationId])).rows[0].status,'needs_information');assert.equal(await count('organization_review_events'),1);});
await as(newOwner);
await check('only applicant can resubmit the revised request; stale revisions cannot overwrite',async()=>{await assert.rejects(()=>submit(application,1),/revision changed/);assert.equal(await submit({...application,registry:'Updated register reference'},2),applicationId);assert.equal((await db.query('select revision from public.organization_applications')).rows[0].revision,3);assert.equal(await count('organization_review_events'),0);});
await as(platformAdmin);
await check('changed applicant identity invalidates approval',async()=>{await db.exec('reset role');await db.query('update auth.users set email=$1 where id=$2',['changed@example.test',newOwner]);await as(platformAdmin);await assert.rejects(()=>review(applicationId,3),/identity changed/);await db.exec('reset role');await db.query('update auth.users set email=$1 where id=$2',['fixture@example.test',newOwner]);await as(platformAdmin);});
await check('independent approval creates exactly one tenant and immutable review event',async()=>{await review(applicationId,3);newOrg=(await db.query('select organization_id from public.organization_applications where id=$1',[applicationId])).rows[0].organization_id;assert.equal((await db.query('select approval_status from public.organizations where id=$1',[newOrg])).rows[0].approval_status,'approved');assert.equal(await count('organization_review_events'),2);const event=(await db.query("select * from public.organization_review_events where application_id=$1 and decision='approved'",[applicationId])).rows[0];assert.deepEqual(event.reviewed_document_ids,evidenceByUser.get(newOwner));assert.deepEqual(event.application_snapshot.evidence_document_ids,evidenceByUser.get(newOwner));await assert.rejects(()=>review(applicationId,3),/revision changed/);await denied("update public.organization_review_events set verified_source='forged'");});
await as(newOwner);
await check('approved owner gets fixed tenant membership and recorded responsibility only',async()=>{assert.equal(await count('organizations'),1);assert.equal(await count('organization_members'),1);const membership=(await db.query('select * from public.organization_members')).rows[0];assert.equal(membership.user_id,newOwner);assert.equal(membership.role,'owner');assert.equal(membership.organization_id,newOrg);await denied("update public.organizations set name='City of Munich'");await denied("update public.organizations set approval_status='approved'");await assert.rejects(()=>submit({...application,organisation:'Another tenant'}));const acknowledgement=(await db.query('select * from public.organization_acknowledgements')).rows[0];assert.equal(acknowledgement.statement_version,'2026-10-07-v1');await denied("update public.organization_acknowledgements set representative_name='Forged'");});
await as(legacyOwner);
evidenceByUser.set(legacyOwner,[await uploadEvidence()]);
let legacyRequest;
await check('existing unapproved organisation is locked and cannot choose a different tenant',async()=>{assert.equal(await count('organizations'),0);assert.equal(await count('places'),0);legacyRequest=await submit({...application,organisation:'Legacy Museum',organization_id:orgA});assert.equal((await db.query('select organization_id from public.organization_applications')).rows[0].organization_id,legacyOrg);});
await as(platformAdmin);
await check('platform administrator cannot approve their own application',async()=>{evidenceByUser.set(platformAdmin,[await uploadEvidence()]);const own=await submit({...application,organisation:'Admin application'});await assert.rejects(()=>review(own,1),/different administrator/);});
await check('approval of existing organisation retains its content',async()=>{await review(legacyRequest,1);});
await as(legacyOwner);
await check('existing content becomes available only after identity approval',async()=>{assert.equal(await count('places'),1);assert.equal((await db.query('select id from public.places')).rows[0].id,legacyPlace);});
await as(newOwner);
await as(ownerB);
await check('responsibility records cannot be read across tenants',async()=>{assert.equal(await count('organization_acknowledgements'),0);});
const livePlace=id(801),liveZone=id(901),secondZone=id(902),asset=id(1001);
const draft={name:"A visitor's museum",city:'Demo city',address:'',countryCode:'RO',placeType:'museum',description:'A draft',arrivalInfo:'Use the main entrance',zones:[{id:liveZone,title:'Entrance',description:'A step-free entrance',note:'Ask staff for help',next:'Go to reception',type:'entrance',optional:false,sensory:{sound:'unknown',light:'moderate',crowding:'variable',smell:'unknown',temperature:'unknown',visual:'low'}}]};
const saveDraft=async(org,place,revision,locale,payload)=>(await db.query('select public.save_place_draft($1,$2,$3,$4,$5::jsonb) revision',[org,place,revision,locale,JSON.stringify(payload)])).rows[0].revision;
await as(null,'anon');
await check('anonymous clients cannot save online drafts',async()=>{await assert.rejects(()=>saveDraft(newOrg,livePlace,0,'en',draft));});
await as(unverified);
await check('unverified accounts cannot save online drafts',async()=>{await assert.rejects(()=>saveDraft(newOrg,livePlace,0,'en',draft));});
await as(newOwner);
await check('atomic save creates a complete private place draft',async()=>{assert.equal(await saveDraft(newOrg,livePlace,0,'en',draft),1);assert.equal((await db.query('select revision from public.places where id=$1',[livePlace])).rows[0].revision,1);assert.equal(await count('places'),1);assert.equal(await count('zone_translations'),1);assert.equal((await db.query('select status from public.guides where place_id=$1',[livePlace])).rows[0].status,'draft');});
await check('stale revisions cannot overwrite a newer draft',async()=>{await assert.rejects(()=>saveDraft(newOrg,livePlace,0,'en',{...draft,name:'Overwritten'}),/revision changed/);assert.equal((await db.query('select name from public.place_translations where place_id=$1',[livePlace])).rows[0].name,draft.name);});
await check('invalid zone data leaves the saved revision unchanged',async()=>{await assert.rejects(()=>saveDraft(newOrg,livePlace,1,'en',{...draft,zones:[{...draft.zones[0],sensory:{...draft.zones[0].sensory,sound:'forged'}}]}));assert.equal((await db.query('select revision from public.places where id=$1',[livePlace])).rows[0].revision,1);});
await check('same-tenant foreign zone IDs cannot be reassigned; partial writes roll back',async()=>{const anotherPlace=id(802);await saveDraft(newOrg,anotherPlace,0,'en',{...draft,zones:[{...draft.zones[0],id:secondZone}]});await assert.rejects(()=>saveDraft(newOrg,livePlace,1,'en',{...draft,name:'Should roll back',zones:[{...draft.zones[0],id:secondZone}]}),/Zone is not available/);assert.equal((await db.query('select name from public.place_translations where place_id=$1',[livePlace])).rows[0].name,draft.name);});
await check('draft translations stay separate and direct publication fields are ignored',async()=>{await saveDraft(newOrg,livePlace,1,'ro',{...draft,name:'Muzeu test',status:'published',source_level:'independent_audit',zones:[{...draft.zones[0],title:'Intrare',next:'Mergi la recepție'}]});const names=await db.query('select locale,name from public.place_translations where place_id=$1 order by locale',[livePlace]);assert.deepEqual(names.rows,[{locale:'en',name:draft.name},{locale:'ro',name:'Muzeu test'}]);assert.ok((await db.query('select status from public.guides where place_id=$1',[livePlace])).rows.every(g=>g.status==='draft'));});
const key=`${newOrg}/${livePlace}/${liveZone}/${asset}.webp`;
await check('private photo path enforces known zone and current organisation',async()=>{assert.equal((await db.query('select private.can_access_workspace_photo($1) ok',[key])).rows[0].ok,true);assert.equal((await db.query("select private.can_access_workspace_photo('not/a/valid/path.webp') ok")).rows[0].ok,false);await denied(`insert into storage.objects(bucket_id,name) values('vianorae-private-photos','${orgB}/${placeB}/${zoneB}/${asset}.webp')`);await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['vianorae-private-photos',key]);});
await check('missing photo objects cause no partial metadata or revision writes',async()=>{await assert.rejects(()=>saveDraft(newOrg,livePlace,2,'en',{...draft,zones:[{...draft.zones[0],photo:{id:id(1002),storageKey:`${newOrg}/${livePlace}/${liveZone}/${id(1002)}.webp`,alt:'Entrance',rights:'Team photograph',photographedOn:'2026-10-06'}}]}),/uploaded first/);assert.equal((await db.query('select revision from public.places where id=$1',[livePlace])).rows[0].revision,2);});
await check('uploaded photos attach with locale-specific alt and required rights/date',async()=>{assert.equal(await saveDraft(newOrg,livePlace,2,'en',{...draft,zones:[{...draft.zones[0],photo:{id:asset,storageKey:key,alt:'Entrance',rights:'Team photograph',photographedOn:'2026-10-06'}}]}),3);assert.equal((await db.query('select alt_text from public.media_assets where id=$1',[asset])).rows[0].alt_text.en,'Entrance');});
await check('private photo objects cannot be overwritten or deleted',async()=>{assert.equal((await db.query("update storage.objects set name='forged.webp' returning name")).rows.length,0);assert.equal((await db.query('delete from storage.objects returning name')).rows.length,0);});
await check('reordering and detaching retain history without deleting content',async()=>{const expanded={...draft,zones:[{...draft.zones[0],id:id(903),title:'Second space'},draft.zones[0]]};await saveDraft(newOrg,livePlace,3,'en',expanded);const ordered=await db.query("select s.zone_id from public.guide_steps s join public.guides g on g.id=s.guide_id where g.place_id=$1 and g.locale='en' and s.active order by s.draft_position",[livePlace]);assert.deepEqual(ordered.rows.map(r=>r.zone_id),[id(903),liveZone]);assert.equal((await db.query('select active from public.media_assets where id=$1',[asset])).rows[0].active,false);assert.equal((await db.query('select count(*)::int n from storage.objects where bucket_id=\'vianorae-private-photos\'')).rows[0].n,1);});
const textField=id(1101),questionField=id(1102);
const withFields=(fields,hidden=['note'])=>({...draft,zones:[{...draft.zones[0],hidden,fields}]});
const ownFields=[{id:textField,kind:'text',label:'Opening hours',value:'10-18'},{id:questionField,kind:'yes_no',label:'Seating available?',answer:'yes'}];
await check('removed and own fields save per step; structure and answers are shared, labels per language',async()=>{
 assert.equal((await db.query('select public.step_fields_schema_version() v')).rows[0].v,1);
 assert.equal(await saveDraft(newOrg,livePlace,4,'en',withFields(ownFields)),5);
 assert.deepEqual((await db.query('select hidden_fields from public.zones where id=$1',[liveZone])).rows[0].hidden_fields,['note']);
 assert.equal((await db.query('select useful_note from public.zone_translations where zone_id=$1 and locale=$2',[liveZone,'en'])).rows[0].useful_note,'Ask staff for help');
 assert.equal(await saveDraft(newOrg,livePlace,5,'ro',withFields([{...ownFields[0],label:'Program'},{...ownFields[1],label:'Locuri de stat?',answer:'no'}])),6);
 const rows=(await db.query('select f.kind,f.sort_order,f.answer,t.locale,t.label,t.value from public.zone_fields f join public.zone_field_translations t on t.field_id=f.id where f.zone_id=$1 and f.active order by f.sort_order,t.locale',[liveZone])).rows;
 assert.deepEqual(rows.map(r=>[r.kind,r.sort_order,r.answer,r.locale,r.label,r.value]),[['text',0,'unanswered','en','Opening hours','10-18'],['text',0,'unanswered','ro','Program','10-18'],['yes_no',1,'no','en','Seating available?',''],['yes_no',1,'no','ro','Locuri de stat?','']]);
});
await check('own fields are limited to five valid fields; removed offered fields are a fixed list',async()=>{
 const many=Array.from({length:6},(_,n)=>({id:id(1110+n),kind:'text',label:`Field ${n}`,value:''}));
 await assert.rejects(()=>saveDraft(newOrg,livePlace,6,'en',withFields(many)),/up to five/);
 await assert.rejects(()=>saveDraft(newOrg,livePlace,6,'en',withFields([{id:id(1120),kind:'photo',label:'Extra',value:''}])),/Invalid field kind/);
 await assert.rejects(()=>saveDraft(newOrg,livePlace,6,'en',withFields([{...ownFields[1],answer:'maybe'}])),/Invalid answer/);
 await assert.rejects(()=>saveDraft(newOrg,livePlace,6,'en',withFields([{...ownFields[0],label:''}])),/length/);
 await assert.rejects(()=>saveDraft(newOrg,livePlace,6,'en',withFields([{...ownFields[0],value:'x'.repeat(501)}])),/length/);
 await assert.rejects(()=>saveDraft(newOrg,livePlace,6,'en',withFields(ownFields,['description'])),/hidden fields/);
 await assert.rejects(()=>saveDraft(newOrg,livePlace,6,'en',withFields([{...ownFields[1],kind:'text',value:'Yes'}])),/Field is not available/);
 assert.equal((await db.query('select revision from public.places where id=$1',[livePlace])).rows[0].revision,6);
});
await check('a removed own field is switched off with its text kept; a draft without field keys still saves',async()=>{
 assert.equal(await saveDraft(newOrg,livePlace,6,'en',withFields([ownFields[1]],[])),7);
 assert.equal((await db.query('select active from public.zone_fields where id=$1',[textField])).rows[0].active,false);
 assert.equal((await db.query('select count(*)::int n from public.zone_field_translations where field_id=$1',[textField])).rows[0].n,2);
 assert.deepEqual((await db.query('select hidden_fields from public.zones where id=$1',[liveZone])).rows[0].hidden_fields,[]);
 assert.equal(await saveDraft(newOrg,livePlace,7,'en',draft),8);
 assert.equal((await db.query('select count(*)::int n from public.zone_fields where zone_id=$1 and active',[liveZone])).rows[0].n,0);
});
await as(ownerB);
await check('another tenant cannot read or write own fields',async()=>{
 assert.equal(await count('zone_fields'),0);assert.equal(await count('zone_field_translations'),0);
 assert.equal((await db.query("update public.zone_fields set answer='no' returning id")).rows.length,0);
 await assert.rejects(()=>saveDraft(newOrg,livePlace,8,'en',withFields(ownFields)));
});
await as(ownerB);
await check('another tenant cannot read photos or edit online drafts',async()=>{assert.equal((await db.query('select count(*)::int n from storage.objects where bucket_id=\'vianorae-private-photos\'')).rows[0].n,0);await assert.rejects(()=>saveDraft(newOrg,livePlace,8,'en',draft));});
// Publishing (brief docs/briefs/2026-10-13-publishing.md): live straight away, every complete language at once.
const pubPlace=id(1301),pubZones=[id(1311),id(1312),id(1313)],pubPhoto=id(1321),twinPlace=id(1302),twinZones=[id(1314),id(1315),id(1316)];
const pubKey=`${newOrg}/${pubPlace}/${pubZones[0]}/${pubPhoto}.webp`;
const step=(zoneId,title,extra={})=>({id:zoneId,title,description:`${title}: what to expect`,note:'Ask staff',next:'Then continue',type:'visit-space',optional:false,sensory:{sound:'low',light:'moderate',crowding:'variable',smell:'unknown',temperature:'unknown',visual:'low'},...extra});
const pubDraft=(names,extra={})=>({...draft,zones:pubZones.slice(0,names.length).map((zoneId,i)=>step(zoneId,names[i],i===1?{hidden:['note']}:{})),...extra});
const publish=async(place,revision,org=newOrg)=>(await db.query('select public.publish_place($1,$2,$3,$4) result',[org,place,revision,'2026-10-07-v1'])).rows[0].result;
const unpublish=async(place,org=newOrg)=>(await db.query('select public.unpublish_place($1,$2) ok',[org,place])).rows[0].ok;
const guideFor=async(address,lang)=>(await db.query('select public.published_guide($1,$2) guide',[address,lang])).rows[0].guide;
const qr=async code=>(await db.query('select public.resolve_qr($1) result',[code])).rows[0].result;
// Only this organisation's places: the test data above has a published guide of its own.
const placesList=async lang=>(await db.query('select public.published_places($1) list',[lang])).rows[0].list.filter(p=>p.slug.startsWith('a-visitor'));
const photoVisible=async name=>(await db.query("select count(*)::int n from storage.objects where bucket_id='vianorae-private-photos' and name=$1",[name])).rows[0].n===1;
let published,pubCode,pubRevision;
await db.exec(`reset role;insert into public.organization_members(organization_id,user_id,role) values('${newOrg}','${editor}','editor');`);
await as(newOwner);
await check('a location is saved in three languages: two complete, one with too few steps',async()=>{
 assert.equal(await saveDraft(newOrg,pubPlace,0,'en',pubDraft(['Entrance','Gallery','Quiet room'])),1);
 await db.query("insert into storage.objects(bucket_id,name) values('vianorae-private-photos',$1)",[pubKey]);
 const withPhoto=pubDraft(['Entrance','Gallery','Quiet room']);withPhoto.zones[0].photo={id:pubPhoto,storageKey:pubKey,alt:'Glass doors',rights:'Own photo',photographedOn:'2026-01-02'};
 assert.equal(await saveDraft(newOrg,pubPlace,1,'en',withPhoto),2);
 const ro=pubDraft(['Intrare','Galerie','Camera liniștită'],{name:'Muzeul vizitatorului'});ro.zones[0].photo={...withPhoto.zones[0].photo,alt:'Uși de sticlă'};
 assert.equal(await saveDraft(newOrg,pubPlace,2,'ro',ro),3);
 const de=pubDraft(['Eingang','Galerie'],{name:'Museum der Besucher'});de.zones[0].photo={...withPhoto.zones[0].photo,alt:'Glastüren'};
 assert.equal(await saveDraft(newOrg,pubPlace,3,'de',de),4);
 const checks=Object.fromEntries((await db.query('select public.publication_check($1,$2) c',[newOrg,pubPlace])).rows[0].c.map(c=>[c.locale,c]));
 assert.equal(checks.en.ready,true);assert.equal(checks.ro.ready,true);assert.equal(checks.de.ready,false);assert.equal(checks.de.steps,2);
});
await as(null,'anon');
await check('before publishing a visitor finds nothing: no guide, no photo, no QR code',async()=>{
 assert.equal(await guideFor(`place-${pubPlace}`,'en'),null);assert.deepEqual(await placesList('en'),[]);assert.equal(await photoVisible(pubKey),false);
 await assert.rejects(()=>publish(pubPlace,4));
});
await as(editor);
await check('an editor can check but cannot publish',async()=>{await assert.rejects(()=>publish(pubPlace,4),/Only owners and admins/);});
await as(ownerB);
await check('another organisation cannot publish or check the location',async()=>{await assert.rejects(()=>publish(pubPlace,4));await assert.rejects(()=>db.query('select public.publication_check($1,$2)',[newOrg,pubPlace]));});
await as(newOwner);
await check('publishing needs the saved revision the page showed',async()=>{await assert.rejects(()=>publish(pubPlace,3),e=>e.code==='40001');});
await check('the owner publishes: complete languages go live, the address and the QR code are made once',async()=>{
 published=await publish(pubPlace,4);
 assert.deepEqual(published.live,['en','ro']);assert.deepEqual(published.waiting.map(w=>w.locale),['de']);
 assert.equal(published.slug,'a-visitor-s-museum-demo-city');assert.match(published.code,/^[0-9a-f]{8}$/);pubCode=published.code;
 const place=(await db.query('select status,slug,published_revision from public.places where id=$1',[pubPlace])).rows[0];
 assert.equal(place.status,'published');assert.equal(Number(place.published_revision),4);
 assert.equal((await db.query("select responsibility_version from public.guide_versions where place_id=$1 limit 1",[pubPlace])).rows[0].responsibility_version,'2026-10-07-v1');
});
await as(null,'anon');
await check('a visitor reads the published guide, in their language or a published one, with its photo',async()=>{
 const en=await guideFor(published.slug,'en');
 assert.equal(en.status,'published');assert.deepEqual(en.locales,['en','ro']);
 assert.deepEqual(en.content.zones.map(z=>z.title),['Entrance','Gallery','Quiet room']);
 assert.equal(en.content.zones[0].photo.key,pubKey);assert.equal(en.content.zones[0].photo.alt,'Glass doors');
 // A removed field is left out of what visitors get.
 assert.equal(en.content.zones[1].note,'');assert.equal(en.content.zones[0].note,'Ask staff');
 assert.equal((await guideFor(published.slug,'ro')).content.zones[2].title,'Camera liniștită');
 const de=await guideFor(published.slug,'de');assert.equal(de.locale,'en');
 assert.equal(await photoVisible(pubKey),true);
 assert.deepEqual(await qr(pubCode),{status:'published',slug:published.slug,locales:['en','ro']});
 const list=await placesList('ro');assert.equal(list.length,1);assert.equal(list[0].name,'Muzeul vizitatorului');assert.equal(list[0].slug,published.slug);
 assert.equal(await qr('nosuchcode'),null);assert.equal(await guideFor('no-such-guide','en'),null);
 // Photos of drafts stay private.
 assert.equal(await photoVisible(key),false);
});
await as(newOwner);
await check('editing after publishing changes nothing public until the next publish',async()=>{
 const changed=pubDraft(['Main door','Gallery','Quiet room'],{name:'Renamed museum'});changed.zones[0].photo={id:pubPhoto,storageKey:pubKey,alt:'Glass doors',rights:'Own photo',photographedOn:'2026-01-02'};
 pubRevision=await saveDraft(newOrg,pubPlace,4,'en',changed);assert.equal(pubRevision,5);
 await as(null,'anon');assert.equal((await guideFor(published.slug,'en')).content.zones[0].title,'Entrance');
 await as(newOwner);
 const again=await publish(pubPlace,5);
 assert.equal(again.slug,published.slug);assert.equal(again.code,pubCode);
 await as(null,'anon');const en=await guideFor(published.slug,'en');assert.equal(en.content.zones[0].title,'Main door');assert.equal(en.content.name,'Renamed museum');
});
await as(newOwner);
await check('the address, the publication fields and the QR code cannot be changed directly',async()=>{
 await denied(`update public.places set slug='another-address' where id='${pubPlace}'`);
 await denied(`update public.qr_redirects set public_code='mine' where place_id='${pubPlace}'`);
 await denied(`insert into public.qr_redirects(public_code,place_id,organization_id) values('second','${pubPlace}','${newOrg}')`);
 await as(editor);
 await denied(`update public.places set status='draft' where id='${pubPlace}'`);
 await denied(`update public.places set published_revision=1 where id='${pubPlace}'`);
 await assert.rejects(()=>unpublish(pubPlace),/Only owners and admins/);
});
await as(newOwner);
await check('a second location with the same name gets its own address',async()=>{
 await saveDraft(newOrg,twinPlace,0,'en',{...draft,zones:twinZones.map((zoneId,i)=>step(zoneId,['One','Two','Three'][i]))});
 assert.equal((await publish(twinPlace,1)).slug,'a-visitor-s-museum-demo-city-2');
 assert.equal((await db.query("select private.slug_text('Șapte Țări Ölmühle')")).rows[0].slug_text,'sapte-tari-oelmuehle');
 assert.equal((await db.query('select private.slug_taken($1,$2) taken',['willow-museum',twinPlace])).rows[0].taken,true);
});
await check('the owner unpublishes: address and QR code say unavailable, never the name; photos go private',async()=>{
 assert.equal(await unpublish(pubPlace),true);
 await as(null,'anon');
 assert.deepEqual(await guideFor(published.slug,'en'),{status:'unavailable'});
 assert.deepEqual(await qr(pubCode),{status:'unavailable'});
 assert.deepEqual((await placesList('en')).map(p=>p.slug),['a-visitor-s-museum-demo-city-2']);
 assert.equal(await photoVisible(pubKey),false);
});
await as(newOwner);
await check('publishing again brings back the same address and code',async()=>{
 const back=await publish(pubPlace,5);assert.equal(back.slug,published.slug);assert.equal(back.code,pubCode);
 await as(null,'anon');assert.equal((await qr(pubCode)).status,'published');
});

// Edge cases of the address (slug) and of the public lookups. Visitors can type anything into an address or a QR code.
const slugOf=async text=>(await db.query('select private.slug_text($1) s',[text])).rows[0].s;
await as(newOwner);
await check('addresses are plain lowercase words, in the languages we support, whatever is typed',async()=>{
 const cases=[['Muzeul Național de Artă','muzeul-national-de-arta'],['ȘTEFAN CEL MARE','stefan-cel-mare'],['Café Müller & Söhne','cafe-mueller-soehne'],['Groß Gerau','gross-gerau'],
  ['--a--','a'],['a   b','a-b'],["O'Brien; drop table places;--",'o-brien-drop-table-places'],['<script>alert(1)</script>','script-alert-1-script'],['Museum 2026','museum-2026']];
 for(const [name,expected] of cases)assert.equal(await slugOf(name),expected,name);
});
await check('a name with no latin letters or digits still gets a usable address',async()=>{
 for(const name of ['','   ','🏛️🏛️','ΜΟΥΣΕΙΟ','---',null])assert.equal(await slugOf(name),'guide',String(name));
});
await check('an address is never longer than 60 characters and never starts or ends with a hyphen',async()=>{
 const names=['x'.repeat(100),'a'.repeat(59)+' b','a'.repeat(58)+' b c','muzeul '.repeat(20),'ab-'.repeat(30),'a'.repeat(60)+'-b'];
 for(const name of names){const slug=await slugOf(name);assert.ok(slug.length<=60,`${name.slice(0,12)}…: ${slug.length}`);assert.match(slug,/^[a-z0-9]+(-[a-z0-9]+)*$/,`${name.slice(0,12)}…: ${slug}`);}
});
await check('a published address a visitor cannot open does not exist: any name, even one that begins with "place"',async()=>{
 const edges=[[id(1303),[id(1317),id(1318),id(1319)],'Place des Arts','Montreal'],[id(1304),[id(1327),id(1328),id(1329)],'a'.repeat(59)+' b','Cluj']];
 for(const [edgePlace,edgeZones,name,town] of edges){
  await saveDraft(newOrg,edgePlace,0,'en',{...draft,name,city:town,zones:edgeZones.map((zoneId,i)=>step(zoneId,['One','Two','Three'][i]))});
  const result=await publish(edgePlace,1);
  await as(null,'anon');
  assert.equal((await guideFor(result.slug,'en'))?.status,'published',`${name.slice(0,20)}: ${result.slug}`);
  assert.equal((await qr(result.code))?.status,'published');
  assert.ok((await db.query('select public.published_places($1) list',['en'])).rows[0].list.some(entry=>entry.slug===result.slug),`${name.slice(0,20)} is listed in Explore`);
  await as(newOwner);
 }
});
await as(null,'anon');
await check('hostile addresses, codes and languages answer "not found" and never an error',async()=>{
 const hostile=['',' ','A','UPPER-CASE','a b','a--b','-a','a-','../etc/passwd','%00','a'.repeat(10000),"'; drop table public.places;--",'<script>alert(1)</script>','ß','🏛️','a\nb','place-'+pubPlace];
 for(const value of hostile){
  assert.equal(await qr(value),null,`qr ${value.slice(0,20)}`);assert.equal(await guideFor(value,'en'),null,`guide ${value.slice(0,20)}`);
 }
 assert.equal(await qr(null),null);assert.equal(await guideFor(null,'en'),null);
 for(const lang of [null,'','xx','<script>','a'.repeat(5000),"en'--"]){
  assert.equal((await guideFor('a-visitor-s-museum-demo-city-2',lang))?.status,'published',`language ${String(lang).slice(0,10)} falls back to a published one`);
  assert.ok(Array.isArray((await db.query('select public.published_places($1) list',[lang])).rows[0].list));
 }
});
await as(newOwner);
await check('photo names with path tricks, capitals or extra parts are never accepted as a workspace or public photo',async()=>{
 const good=pubKey;
 const bad=[null,'',good.toUpperCase(),'../'+good,good+'/..',good.replace('.webp','.png'),good.replace('.webp','.webp.exe'),good+'x',`${newOrg}/${pubPlace}/${pubZones[0]}.webp`,
  `${newOrg}/../${newOrg}/${pubPlace}/${pubZones[0]}/${pubPhoto}.webp`,`${orgB}/${pubPlace}/${pubZones[0]}/${pubPhoto}.webp`,' '+good,good+'\n'];
 for(const name of bad)assert.equal((await db.query('select private.can_access_workspace_photo($1) ok',[name])).rows[0].ok,false,String(name));
 assert.equal((await db.query('select private.can_access_workspace_photo($1) ok',[good])).rows[0].ok,true);
});

// Problem reports: owners and admins of an approved organisation report to NERUMA; only the platform administrator closes.
const stranger=id(77),reportText='The photo upload stops at 90 percent.';
await db.exec(`reset role;insert into auth.users(id,email) values('${stranger}','stranger@example.test');`);
const report=async(org,place=null,message=reportText,locale='en')=>(await db.query('select public.submit_problem_report($1,$2,$3,$4) id',[org,place,message,locale])).rows[0].id;
await as(newOwner);
let firstReport;
await check('an owner reports a problem for their organisation, with or without a location',async()=>{
 firstReport=await report(newOrg,livePlace);await report(newOrg);
 const rows=(await db.query('select status,reporter_id,reporter_email,message from public.problem_reports')).rows;
 await db.exec('reset role');const email=(await db.query('select email from auth.users where id=$1',[newOwner])).rows[0].email;await as(newOwner);
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.status==='open' && r.reporter_id===newOwner && r.reporter_email===email && r.message===reportText));
});
await check('a report rejects bad input, another tenant\'s location and direct writes',async()=>{
 await assert.rejects(()=>report(newOrg,null,'too short'));await assert.rejects(()=>report(newOrg,null,'x'.repeat(2001)));
 await assert.rejects(()=>report(newOrg,null,reportText,'fr'));await assert.rejects(()=>report(newOrg,placeB));
 await assert.rejects(()=>report(orgB));
 await denied(`insert into public.problem_reports(organization_id,reporter_id,reporter_email,locale,message) values('${newOrg}','${newOwner}','x@example.test','en','${reportText}')`);
 await denied("update public.problem_reports set status='closed'");await denied('delete from public.problem_reports');
 await assert.rejects(()=>db.query('select public.close_problem_report($1)',[firstReport]));
});
await check('one person can send five reports an hour',async()=>{
 await report(newOrg);await report(newOrg);await report(newOrg);
 await assert.rejects(()=>report(newOrg),e=>e.code==='54000');assert.equal(await count('problem_reports'),5);
});
await as(ownerB);
await check('another tenant cannot read, file or close an organisation\'s reports',async()=>{assert.equal(await count('problem_reports'),0);await assert.rejects(()=>report(newOrg));await assert.rejects(()=>db.query('select public.close_problem_report($1)',[firstReport]));});
await as(editor);
await check('an editor cannot file a report',async()=>{await assert.rejects(()=>report(orgA));});
await as(stranger);
await check('a signed-in user without an organisation cannot read or file reports',async()=>{assert.equal(await count('problem_reports'),0);await assert.rejects(()=>report(newOrg));});
await as(null,'anon');
await check('an anonymous visitor cannot read or file reports',async()=>{await denied('select * from public.problem_reports');await assert.rejects(()=>report(newOrg));});
await as(platformAdmin);
await check('the platform administrator reads every report and closes one once, but files none',async()=>{
 assert.equal(await count('problem_reports'),5);await assert.rejects(()=>report(newOrg));
 await db.query('select public.close_problem_report($1)',[firstReport]);
 const closed=(await db.query('select status,closed_by from public.problem_reports where id=$1',[firstReport])).rows[0];
 assert.equal(closed.status,'closed');assert.equal(closed.closed_by,platformAdmin);
 await assert.rejects(()=>db.query('select public.close_problem_report($1)',[firstReport]));
});
// Two-factor sign-in: a session that only used the password (aal1) loses organisation and administrator access once
// the account has an authenticator app, or once two-factor is required for it.
const twoFactor=async()=>(await db.query('select public.two_factor_status() s')).rows[0].s;
const deadline=async when=>{await db.exec('reset role');await db.query('update private.two_factor_policy set organisations_from=$1',[when]);};
await as(newOwner,'authenticated','aal1');
await check('before the deadline, an owner without two-factor keeps working with the password only',async()=>{
 const status=await twoFactor();assert.equal(status.enrolled,false);assert.equal(status.required,false);assert.equal(status.passed,true);
 assert.ok(new Date(status.deadline)>new Date());assert.ok(await count('places')>0);
});
await check('nobody signed in can read or move the two-factor deadline',async()=>{
 await denied('select * from private.two_factor_policy');await denied("update private.two_factor_policy set organisations_from=now()+interval '10 years'");
});
await db.exec('reset role');await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[newOwner]);
await as(newOwner,'authenticated','aal1');
await check('an owner with an authenticator app but no code this session cannot read, save, publish, unpublish or report',async()=>{
 assert.equal((await twoFactor()).passed,false);assert.equal(await count('places'),0);assert.equal(await count('organizations'),0);
 await assert.rejects(()=>saveDraft(newOrg,livePlace,1,'en',draft),/editing is not allowed/);
 await assert.rejects(()=>publish(pubPlace,5),/Only owners and admins/);await assert.rejects(()=>unpublish(pubPlace),/Only owners and admins/);
 await assert.rejects(()=>report(newOrg),/Two-factor/);
});
await as(newOwner);
await check('the same owner after entering the code (aal2) has their access back',async()=>{assert.equal((await twoFactor()).passed,true);assert.ok(await count('places')>0);});
await db.exec('reset role');await db.query('delete from auth.mfa_factors where user_id=$1',[newOwner]);
await deadline(new Date(Date.now()-60000).toISOString());
await as(newOwner,'authenticated','aal1');
await check('after the deadline, an owner without two-factor loses access until they set it up',async()=>{
 const status=await twoFactor();assert.equal(status.required,true);assert.equal(status.passed,false);
 assert.equal(await count('places'),0);await assert.rejects(()=>publish(pubPlace,5),/Only owners and admins/);
});
await as(editor,'authenticated','aal1');
await check('the requirement applies to owners and admins, not to other roles',async()=>{
 const status=await twoFactor();assert.equal(status.deadline,null);assert.equal(status.passed,true);assert.ok(await count('places')>0);
});
await deadline(new Date(Date.now()+30*86400000).toISOString());
const openReport=(await db.query("select id from public.problem_reports where status='open' limit 1")).rows[0].id;
await as(platformAdmin,'authenticated','aal1');
await check('a platform administrator needs the second factor from day one',async()=>{
 const status=await twoFactor();assert.equal(status.required,true);assert.equal(status.passed,false);
 assert.equal((await db.query('select public.is_platform_admin() ok')).rows[0].ok,false);
 assert.equal((await db.query('select count(*)::int n from public.organization_applications where applicant_id<>auth.uid()')).rows[0].n,0);
 assert.equal(await count('problem_reports'),0);
 await assert.rejects(()=>review(applicationId,4,'suspended',false,false,'','','Access suspended while the mandate is investigated.'));
 await assert.rejects(()=>db.query('select public.close_problem_report($1)',[openReport]),/Platform administrator required/);
});

// Remember this device: a token from an aal2 session lets one later password-only session through, for owners and admins only.
const sessionA=id(1501),sessionB=id(1502),sessionC=id(1503);
const rememberDevice=async()=>(await db.query('select public.remember_device() token')).rows[0].token;
const trust=async token=>(await db.query('select public.trust_this_session($1) ok',[token])).rows[0].ok;
await db.exec('reset role');await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified'),($2,'verified')",[newOwner,platformAdmin]);
await as(newOwner,'authenticated','aal1',sessionA);
await check('a password-only session cannot remember a device',async()=>{await assert.rejects(()=>rememberDevice(),/needs a session that entered the code/);});
let deviceToken;
await as(newOwner,'authenticated','aal2',sessionA);
await check('after the code, an owner remembers a device; only a hash is stored and nobody signed in can read it',async()=>{
 deviceToken=await rememberDevice();assert.match(deviceToken,/^[0-9a-f]{64}$/);
 await denied('select * from private.remembered_devices');await denied('select * from private.trusted_sessions');
 const listed=(await db.query('select public.remembered_devices() list')).rows[0].list;assert.equal(listed.length,1);assert.equal(JSON.stringify(listed).includes(deviceToken),false);
 await db.exec('reset role');const stored=(await db.query('select encode(token_hash,\'hex\') hash from private.remembered_devices where user_id=$1',[newOwner])).rows[0].hash;
 assert.notEqual(stored,deviceToken);await as(newOwner,'authenticated','aal2',sessionA);
});
await as(newOwner,'authenticated','aal1',sessionB);
await check('a later password-only session with the token passes; without it, or with a wrong one, it does not',async()=>{
 assert.equal(await count('places'),0);assert.equal(await trust('0'.repeat(64)),false);assert.equal(await count('places'),0);
 assert.equal(await trust(deviceToken),true);assert.ok(await count('places')>0);assert.equal((await twoFactor()).passed,true);
});
await as(newOwner,'authenticated','aal1',sessionC);
await check('trust belongs to one session: another password-only session is still asked for the code',async()=>{assert.equal(await count('places'),0);});
await as(ownerB,'authenticated','aal1',sessionC);
await check('another account cannot use someone else\'s device token',async()=>{assert.equal(await trust(deviceToken),false);});
await as(platformAdmin,'authenticated','aal2');
await check('a platform administrator cannot remember a device or pass with one',async()=>{
 assert.equal((await twoFactor()).can_remember,false);await assert.rejects(()=>rememberDevice());
 await db.exec('reset role');const adminFactor=(await db.query('select id from auth.mfa_factors where user_id=$1',[platformAdmin])).rows[0].id;
 await db.query("insert into private.remembered_devices(user_id,factor_id,token_hash) values($1,$2,sha256(convert_to('admin-token','UTF8')))",[platformAdmin,adminFactor]);
 await as(platformAdmin,'authenticated','aal1',sessionA);assert.equal(await trust('admin-token'),false);
 assert.equal((await db.query('select public.is_platform_admin() ok')).rows[0].ok,false);
});
await as(newOwner,'authenticated','aal1',sessionB);
await check('an expired device no longer lets the session through',async()=>{
 await db.exec('reset role');await db.query("update private.remembered_devices set expires_at=now()-interval '1 minute' where user_id=$1",[newOwner]);
 await as(newOwner,'authenticated','aal1',sessionB);assert.equal(await count('places'),0);
 await db.exec('reset role');await db.query("update private.remembered_devices set expires_at=now()+interval '30 days' where user_id=$1",[newOwner]);
 await as(newOwner,'authenticated','aal1',sessionB);assert.ok(await count('places')>0);
});
await check('forgetting the device ends the trust at once',async()=>{
 assert.equal((await db.query('select public.forget_devices() n')).rows[0].n,1);assert.equal(await count('places'),0);
});
await check('a new password forgets every remembered device',async()=>{
 await as(newOwner,'authenticated','aal2',sessionA);const token=await rememberDevice();
 await db.exec('reset role');await db.query("update auth.users set encrypted_password='new-hash' where id=$1",[newOwner]);
 await as(newOwner,'authenticated','aal1',sessionC);assert.equal(await trust(token),false);
 assert.equal((await db.query('select public.remembered_devices() list')).rows[0].list.length,0);
});
await check('an administrator\'s reset of the authenticator app forgets every remembered device',async()=>{
 await as(newOwner,'authenticated','aal2',sessionA);const token=await rememberDevice();
 await db.exec('reset role');await db.query("delete from auth.mfa_factors where user_id=$1",[newOwner]);
 assert.equal((await db.query('select count(*)::int n from private.remembered_devices where user_id=$1',[newOwner])).rows[0].n,0);
 await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[newOwner]);
 await as(newOwner,'authenticated','aal1',sessionC);assert.equal(await trust(token),false);
 await db.exec('reset role');await db.query('delete from auth.mfa_factors where user_id=any($1)',[[newOwner,platformAdmin]]);
});

// Deleting an account (brief docs/briefs/2026-10-13-delete-account.md). One person owns organisation D alone and organisation E with
// a colleague, published in both, applied with a document, sent a report and remembered a device. Nothing of them may be left.
const leaver=id(1601),colleague=id(1602),orgD=id(1611),orgE=id(1612),placeD=id(1621),placeE=id(1622),placeE2=id(1623);
const leaverEmail='leaver@example.test',leaverDoc=id(1631),leaverApplication=id(1632),leaverDocKey=`${leaver}/${leaverDoc}.pdf`,photoD=`${orgD}/${placeD}/${id(1641)}/${id(1651)}.webp`;
const threeSteps=(base,name)=>({...draft,name,zones:[step(id(base),'One'),step(id(base+1),'Two'),step(id(base+2),'Three')]});
await db.exec('reset role');
await db.query("insert into auth.users(id,email) values($1,$2),($3,'colleague@example.test')",[leaver,leaverEmail,colleague]);
await db.query("insert into public.organizations(id,name,approval_status) values($1,'Leaver alone museum','approved'),($2,'Shared museum','approved')",[orgD,orgE]);
await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$3,'owner'),($2,$3,'owner'),($2,$4,'owner')",[orgD,orgE,leaver,colleague]);
await db.query("insert into public.users(id,display_name) values($1,'Lea Ver')",[leaver]);
await db.query(`insert into public.organization_applications(id,applicant_id,applicant_email,organization_name,organization_type,country_code,official_website,registry_reference,representative_name,representative_role,authorization_description,statement_version,statement_locale,organization_id,status)
 values($1,$2,$3,'Leaver alone museum','museum','RO','https://leaver.example.test','REG-1','Lea Ver','Director','The registered office can confirm the appointment.','2026-10-07-v1','en',$4,'approved')`,[leaverApplication,leaver,leaverEmail,orgD]);
await db.query("insert into public.organization_evidence_documents(id,applicant_id,application_id,storage_key,filename,mime_type,byte_size,sha256,uploaded_at) values($1,$2,$3,$4,'mandate.pdf','application/pdf',10,repeat('b',64),now())",[leaverDoc,leaver,leaverApplication,leaverDocKey]);
await db.query("insert into storage.objects(bucket_id,name) values('vianorae-mandate-evidence',$1),('vianorae-private-photos',$2)",[leaverDocKey,photoD]);
await db.query("insert into public.organization_review_events(application_id,actor_id,decision,application_revision,application_snapshot,entity_confirmed,mandate_confirmed,verified_source,evidence_reference,applicant_note) values($1,$2,'approved',1,jsonb_build_object('representative','Lea Ver','email',$3::text),true,true,'Registry checked','Called the office','Welcome')",[leaverApplication,platformAdmin,leaverEmail]);
await db.query("insert into public.organization_acknowledgements(organization_id,user_id,representative_name,statement_version,statement_locale) values($1,$2,'Lea Ver','2026-10-07-v1','en')",[orgD,leaver]);
await db.query("insert into auth.mfa_factors(user_id,factor_type,status) values($1,'totp','verified')",[leaver]);
await as(leaver);
const leaverRevD=await saveDraft(orgD,placeD,0,'en',threeSteps(1661,'Leaver museum'));
const leaverPublishedD=await publish(placeD,leaverRevD,orgD);
const leaverRevE=await saveDraft(orgE,placeE,0,'en',threeSteps(1671,'Shared first museum'));
const leaverPublishedE=await publish(placeE,leaverRevE,orgE);
const leaverReport=await report(orgE,null,'The map on the second step is upside down.','en');
const leaverDevice=(await db.query('select public.remember_device() token')).rows[0].token;
await as(colleague);
const colleagueRevE=await saveDraft(orgE,placeE2,0,'en',threeSteps(1681,'Shared second museum'));
const colleaguePublishedE=await publish(placeE2,colleagueRevE,orgE);
const guideStatus=async slug=>{await as(null,'anon');const result=(await db.query('select public.published_guide($1,$2) g',[slug,'en'])).rows[0].g?.status;return result;};
const startDeletion=async()=>(await db.query('select public.request_account_deletion() r')).rows[0].r;

await as(leaver,'authenticated','aal2',leaver,Math.floor(Date.now()/1000)-3600);
await check('a deletion needs a fresh sign-in: an hour-old session cannot start one',async()=>{await assert.rejects(()=>startDeletion(),/password again/);});
await as(leaver,'authenticated','aal1');
await check('with two-factor set up, a deletion needs the code too',async()=>{await assert.rejects(()=>startDeletion(),/two-factor code/);});
let deletion;
await as(leaver);
await check('the person starts it: the account is locked at once, with the date it will be deleted',async()=>{
 deletion=await startDeletion();
 const days=(new Date(deletion.delete_after)-Date.now())/86400000;assert.ok(days>29.9 && days<30.1,String(days));
 assert.deepEqual(deletion.held_organisations,[orgD]);assert.equal(deletion.guides_taken_down,2);
 await assert.rejects(()=>startDeletion(),e=>e.code==='40001');
 await db.exec('reset role');assert.ok((await db.query('select banned_until from auth.users where id=$1',[leaver])).rows[0].banned_until>new Date(Date.now()+86400000*365*50),'sign-in refused');
});
await as(leaver);
await check('a locked account can read and change nothing, even with a session still in hand',async()=>{
 assert.equal(await count('places'),0);assert.equal(await count('organizations'),0);assert.equal(await count('organization_applications'),0);
 assert.equal(await count('organization_evidence_documents'),0);
 await assert.rejects(()=>saveDraft(orgE,placeE,leaverRevE,'en',threeSteps(1671,'Changed')));
 await assert.rejects(()=>report(orgE,null,'Another message that is long enough.','en'));
 await assert.rejects(()=>db.query('select public.remember_device()'));
 assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='vianorae-mandate-evidence'")).rows[0].n,0);
});
await check('their guides go down at once: everything of the organisation they own alone, and what they published in the shared one',async()=>{
 assert.equal(await guideStatus(leaverPublishedD.slug),'unavailable');assert.deepEqual((await db.query('select public.resolve_qr($1) r',[leaverPublishedD.code])).rows[0].r,{status:'unavailable'});
 assert.equal(await guideStatus(leaverPublishedE.slug),'unavailable');
 assert.equal(await guideStatus(colleaguePublishedE.slug),'published','the colleague\'s guide stays');
 await as(colleague);assert.ok(await count('places')>=2,'the colleague keeps the shared organisation');
});
await as(colleague);
await check('only an administrator restores, and only within the 30 days',async()=>{
 await assert.rejects(()=>db.query('select public.restore_account($1)',[leaver]),/Platform administrator required/);
 await as(leaver);await assert.rejects(()=>db.query('select public.restore_account($1)',[leaver]));
});
await as(platformAdmin);
await check('restoring brings everything back: sign-in, rights, guides and the organisation',async()=>{
 const list=(await db.query('select public.account_deletions() l')).rows[0].l;const entry=list.find(row=>row.user_id===leaver);
 assert.equal(entry.email,leaverEmail);assert.equal(entry.due,false);assert.equal(entry.by_administrator,false);assert.deepEqual(entry.organisations.map(o=>o.id),[orgD]);
 assert.equal((await db.query('select public.restore_account($1) ok',[leaver])).rows[0].ok,true);
 assert.equal(await guideStatus(leaverPublishedD.slug),'published');assert.equal(await guideStatus(leaverPublishedE.slug),'published');
 await db.exec('reset role');assert.equal((await db.query('select banned_until from auth.users where id=$1',[leaver])).rows[0].banned_until,null);
 await as(leaver);assert.ok(await count('places')>=3);
});
await as(platformAdmin);
await check('an administrator can start a deletion for someone who wrote in, but not for themselves; clients can\'t touch the records',async()=>{
 const started=(await db.query('select public.request_account_deletion_for($1) r',[leaverEmail.toUpperCase()])).rows[0].r;assert.equal(started.user_id,leaver);
 assert.equal((await db.query('select public.account_deletions() l')).rows[0].l.find(row=>row.user_id===leaver).by_administrator,true);
 await assert.rejects(()=>db.query('select public.request_account_deletion_for($1)',['nobody@example.test']),/No account/);
 // Emails are unique in Supabase; the shared default email of the test users isn't.
 await db.exec('reset role');await db.query("update auth.users set email='platform.admin@example.test' where id=$1",[platformAdmin]);const adminEmail='platform.admin@example.test';
 await as(platformAdmin);await assert.rejects(()=>db.query('select public.request_account_deletion_for($1)',[adminEmail]),/your account page/);
 await as(colleague);
 await denied('select * from private.account_deletions');await denied('select * from private.organisation_holds');
 await assert.rejects(()=>db.query('select private.begin_account_deletion($1,null)',[colleague]));
 await assert.rejects(()=>db.query('select public.account_deletions()'),/Platform administrator required/);
 await assert.rejects(()=>db.query('select public.request_account_deletion_for($1)',[leaverEmail]),/Platform administrator required/);
});
await as(leaver,'authenticated','aal2');
await check('the export holds everything about the person, and nothing about anyone else',async()=>{
 const own=(await db.query('select public.export_my_data() d')).rows[0].d;
 assert.equal(own.account.email,leaverEmail);assert.equal(own.organisation_requests.length,1);assert.equal(own.organisation_requests[0].decisions[0].note_to_you,'Welcome');
 assert.equal(own.documents[0].file_name,'mandate.pdf');assert.deepEqual(own.memberships.map(m=>m.organisation).sort(),['Leaver alone museum','Shared museum']);
 assert.equal(own.problem_reports_sent.length,1);assert.equal(own.guide_versions_published.length,2);assert.equal(own.statements_accepted.length,1);
 assert.equal(own.two_factor.authenticator_app,true);assert.equal(own.two_factor.remembered_devices.length,1);assert.ok(own.deletion.delete_after);
 assert.deepEqual(own.organisations_you_own_alone.map(o=>o.organisation),['Leaver alone museum'],'not the shared one');
 assert.equal(own.organisations_you_own_alone[0].places[0].steps.length,3);
 const text=JSON.stringify(own);assert.ok(!text.includes('colleague@example.test') && !text.includes(colleague),'nothing about the colleague');
 assert.ok(!text.includes(leaverDevice),'not the device token');assert.ok(!/encrypted_password|recovery_token|confirmation_token/.test(text));
 const files=(await db.query('select public.export_files() f')).rows[0].f;assert.deepEqual(files.map(f=>f.name).sort().slice(0,1),['documents/mandate.pdf']);
 await assert.rejects(()=>db.query('select public.export_user_data($1)',[colleague]),/Platform administrator required/);
 await assert.rejects(()=>db.query('select public.export_files($1)',[colleague]),/Not allowed/);
 await as(platformAdmin);assert.equal((await db.query('select public.export_user_data($1) d',[leaver])).rows[0].d.account.email,leaverEmail);
 // After the lock, the photos of the hidden organisation stay readable for the administrator's export, and only for them.
 assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='vianorae-private-photos' and name=$1",[photoD])).rows[0].n,1);
 await as(colleague);assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='vianorae-private-photos' and name=$1",[photoD])).rows[0].n,0);
});
await as(platformAdmin);
await check('nothing is erased before the 30 days, by anyone but an administrator, or while files remain',async()=>{
 await assert.rejects(()=>db.query('select public.erase_account($1)',[leaver]),/Not due/);
 assert.equal((await db.query("delete from storage.objects where bucket_id='vianorae-mandate-evidence' and name=$1 returning name",[leaverDocKey])).rows.length,0,'no early file removal');
 await db.exec('reset role');await db.query("update private.account_deletions set delete_after=now()-interval '1 minute' where user_id=$1",[leaver]);
 await as(colleague);await assert.rejects(()=>db.query('select public.erase_account($1)',[leaver]),/Platform administrator required/);
 assert.equal((await db.query("delete from storage.objects where bucket_id='vianorae-mandate-evidence' and name=$1 returning name",[leaverDocKey])).rows.length,0,'not by a colleague');
 await as(platformAdmin);await assert.rejects(()=>db.query('select public.erase_account($1)',[leaver]),/Remove the files first/);
 assert.equal((await db.query('select public.restore_account($1)',[leaver]).catch(e=>e)).message,'The 30 days have passed');
});
await as(platformAdmin);
await check('an administrator removes exactly the files of a due erasure, and no one else\'s',async()=>{
 const files=(await db.query('select public.account_erasure_files($1) f',[leaver])).rows[0].f;assert.deepEqual(files,[{bucket:'vianorae-mandate-evidence',key:leaverDocKey}]);
 assert.equal((await db.query("delete from storage.objects where bucket_id='vianorae-private-photos' and name=$1 returning name",[photoD])).rows.length,0,'the held organisation is not due yet');
 assert.equal((await db.query("delete from storage.objects where bucket_id='vianorae-private-photos' and name=$1 returning name",[pubKey])).rows.length,0,'another organisation\'s photo');
 assert.equal((await db.query("delete from storage.objects where bucket_id='vianorae-mandate-evidence' and name=$1 returning name",[leaverDocKey])).rows.length,1);
});
await check('after the erase nothing anywhere holds their id or email; their reports stay without them; the colleague\'s guide is untouched',async()=>{
 const result=(await db.query('select public.erase_account($1) r',[leaver])).rows[0].r;assert.equal(result.guide_versions_deleted,2);assert.equal(result.problem_reports_anonymised,1);
 await db.exec('reset role');
 const columns=(await db.query("select table_schema s,table_name t,column_name c from information_schema.columns c join information_schema.tables t using(table_schema,table_name) where table_schema in ('public','private','auth','storage') and t.table_type='BASE TABLE'")).rows;
 const found=[];
 for(const {s:schema,t:table,c:column} of columns){
  const n=(await db.query(`select count(*)::int n from "${schema}"."${table}" where "${column}"::text ilike $1 or "${column}"::text ilike $2`,[`%${leaver}%`,`%${leaverEmail}%`])).rows[0].n;
  if(n)found.push(`${schema}.${table}.${column} (${n})`);
 }
 assert.deepEqual(found,[],'something still names the person');
 const kept=(await db.query('select reporter_id,reporter_email,message from public.problem_reports where id=$1',[leaverReport])).rows[0];
 assert.equal(kept.reporter_id,null);assert.equal(kept.reporter_email,null);assert.equal(kept.message,'The map on the second step is upside down.');
 assert.equal(await guideStatus(colleaguePublishedE.slug),'published');assert.equal(await guideStatus(leaverPublishedE.slug),'unavailable','the guide waits for a colleague to publish again');
 assert.equal(await guideStatus(leaverPublishedD.slug),'unavailable','the organisation they owned alone stays hidden');
});
await as(platformAdmin);
await check('the organisation they owned alone is erased after its own 30 days: content and photos gone, QR code kept, no name',async()=>{
 await assert.rejects(()=>db.query('select public.erase_held_organisation($1)',[orgD]),/Not due/);
 await db.exec('reset role');await db.query("update private.organisation_holds set delete_after=now()-interval '1 minute' where organization_id=$1",[orgD]);
 await as(platformAdmin);
 const holds=(await db.query('select public.organisation_holds() h')).rows[0].h.find(h=>h.id===orgD);assert.equal(holds.due,true);assert.equal(holds.former_owner_email,null,'the former owner is gone');
 await assert.rejects(()=>db.query('select public.erase_held_organisation($1)',[orgD]),/Remove the files first/);
 assert.deepEqual((await db.query('select public.organisation_erasure_files($1) f',[orgD])).rows[0].f,[{bucket:'vianorae-private-photos',key:photoD}]);
 assert.equal((await db.query("delete from storage.objects where bucket_id='vianorae-private-photos' and name=$1 returning name",[photoD])).rows.length,1);
 assert.equal((await db.query('select public.erase_held_organisation($1) r',[orgD])).rows[0].r.places_kept_for_qr_codes,1);
 await assert.rejects(()=>db.query('select public.erase_held_organisation($1)',[orgD]),/Already erased/);
 await db.exec('reset role');
 for(const table of ['place_translations','zones','zone_translations','guides','guide_versions','media_assets','organization_members','audit_log','sensory_profiles'])
  assert.equal((await db.query(`select count(*)::int n from public.${table} where organization_id=$1`,[orgD])).rows[0].n,0,table);
 assert.equal((await db.query('select name from public.organizations where id=$1',[orgD])).rows[0].name,'Deleted organisation');
 await as(null,'anon');assert.deepEqual((await db.query('select public.resolve_qr($1) r',[leaverPublishedD.code])).rows[0].r,{status:'unavailable'});
 assert.deepEqual((await db.query('select public.published_guide($1,$2) g',[leaverPublishedD.slug,'en'])).rows[0].g,{status:'unavailable'});
});
await as(platformAdmin);
await check('an administrator deletes a kept report by hand, with its history; nobody else can',async()=>{
 await as(colleague);await assert.rejects(()=>db.query('select public.delete_problem_report($1)',[leaverReport]),/Platform administrator required/);
 await as(platformAdmin);assert.equal((await db.query('select public.delete_problem_report($1) ok',[leaverReport])).rows[0].ok,true);
 await db.exec('reset role');assert.equal((await db.query("select count(*)::int n from public.audit_log where entity_type='problem_reports' and entity_id=$1",[leaverReport])).rows[0].n,0);
});
// Leave the world as the checks below expect it: no published guide outside the organisations they suspend.
await as(colleague);await unpublish(placeE2,orgE);

await as(platformAdmin);
await check('suspension immediately blocks member data and private storage with existing identity',async()=>{await review(applicationId,4,'suspended',false,false,'','','Access suspended while the mandate is investigated.');});
await as(newOwner);
await check('suspended tenant cannot read or write drafts/photos or reactivate itself',async()=>{assert.equal(await count('places'),0);assert.equal((await db.query('select count(*)::int n from storage.objects where bucket_id=\'vianorae-private-photos\'')).rows[0].n,0);await assert.rejects(()=>saveDraft(newOrg,livePlace,4,'en',draft));await denied("update public.organizations set approval_status='approved'");await assert.rejects(()=>submit());});
await check('a suspended organisation cannot read or file reports; the platform administrator still reads them',async()=>{assert.equal(await count('problem_reports'),0);await assert.rejects(()=>report(newOrg));await as(platformAdmin);assert.equal(await count('problem_reports'),5);});
await db.exec('reset role');
await db.query("update public.organizations set approval_status='suspended' where id=$1",[orgA]);
await as(assessor);
await check('suspension also blocks assigned assessor and reviewer data',async()=>{assert.equal(await count('assessments'),0);assert.equal(await count('assessment_assignments'),0);assert.equal((await db.query('select private.is_assigned($1) ok',[assessmentId])).rows[0].ok,false);});
await as(null,'anon');
await check('suspended tenant public snapshots and QR codes also disappear',async()=>{assert.equal(await count('guides'),0);assert.equal(await count('guide_versions'),0);assert.equal(await count('qr_redirects'),0);});
await as(null,'anon');
await check('online draft content remains private and never enters public snapshots',async()=>{assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from public.guides where place_id=$1',[livePlace])).rows[0].n,0);});
await db.exec('reset role');
await db.exec("select set_config('request.jwt.claim.sub','',false)");
// The superadmin area (brief 2026-10-17): what waits, who has an account, who administers. Only a platform administrator may call any of it.
const candidate=id(1701),unconfirmedPerson=id(1702);
await db.exec('reset role');
await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'candidate@example.test',now()),($2,'unconfirmed.person@example.test',null)",[candidate,unconfirmedPerson]);
const adminRows=async(...args)=>(await db.query('select public.admin_accounts($1,$2,$3,$4) a',args)).rows[0].a;
await as(platformAdmin);
await check('the overview counts what waits and refuses everyone who is not a platform administrator',async()=>{
 const overview=(await db.query('select public.admin_overview() o')).rows[0].o;
 for(const key of ['pending_requests','open_reports','deletions_in_progress','deletions_due','accounts','administrators']) assert.equal(typeof overview[key],'number',key);
 assert.equal(overview.administrators,1);
 await as(colleague);await assert.rejects(()=>db.query('select public.admin_overview()'),/Platform administrator required/);
 await assert.rejects(()=>adminRows(null,25,0,false),/Platform administrator required/);
 await as(null,'anon');await denied('select public.admin_overview()');await denied("select public.admin_accounts(null,25,0,false)");await denied("select public.add_platform_admin('candidate@example.test')");
 await as(platformAdmin);
});
await check('the account list searches by email, treats wildcards as text, pages, and leaves out anonymous visitors',async()=>{
 const found=await adminRows('CANDIDATE@',25,0,false);
 assert.equal(found.total,1);assert.equal(found.rows[0].user_id,candidate);
 assert.deepEqual([found.rows[0].is_admin,found.rows[0].two_factor,found.rows[0].deletion_pending,found.rows[0].confirmed],[false,false,false,true]);
 assert.equal((await adminRows('unconfirmed.person',25,0,false)).rows[0].confirmed,false);
 assert.equal((await adminRows('%',25,0,false)).total,0);assert.equal((await adminRows('candidate_example',25,0,false)).total,0);
 await assert.rejects(()=>adminRows('x'.repeat(255),25,0,false),/too long/);
 const everyone=await adminRows(null,100,0,false);assert.ok(everyone.total>=3);assert.ok(!everyone.rows.some(row=>row.user_id===anonymous));
 const first=await adminRows(null,1,0,false);assert.equal(first.rows.length,1);assert.equal(first.total,everyone.total);
 assert.deepEqual((await adminRows(null,25,0,true)).rows.map(row=>row.user_id),[platformAdmin]);
});
await check('an administrator is added by a confirmed email only, and removed by someone else only',async()=>{
 await assert.rejects(()=>db.query("select public.add_platform_admin('unconfirmed.person@example.test')"),/No confirmed account/);
 await assert.rejects(()=>db.query("select public.add_platform_admin('nobody@example.test')"),/No confirmed account/);
 assert.equal((await db.query("select public.add_platform_admin(' Candidate@Example.test ') r")).rows[0].r,true);
 assert.equal((await db.query("select public.add_platform_admin('candidate@example.test') r")).rows[0].r,false);
 assert.equal((await db.query('select public.admin_overview() o')).rows[0].o.administrators,2);
 await as(colleague);await assert.rejects(()=>db.query("select public.add_platform_admin('candidate@example.test')"),/Platform administrator required/);
 await assert.rejects(()=>db.query('select public.remove_platform_admin($1)',[platformAdmin]),/Platform administrator required/);
 await as(candidate);
 assert.equal((await db.query('select public.admin_overview() o')).rows[0].o.administrators,2);
 await assert.rejects(()=>db.query('select public.remove_platform_admin($1)',[candidate]),/cannot remove yourself/);
 await as(platformAdmin);
 await assert.rejects(()=>db.query('select public.remove_platform_admin($1)',[platformAdmin]),/cannot remove yourself/);
 assert.equal((await db.query('select public.remove_platform_admin($1) r',[colleague])).rows[0].r,false);
 assert.equal((await db.query('select public.remove_platform_admin($1) r',[candidate])).rows[0].r,true);
 assert.equal((await db.query('select public.admin_overview() o')).rows[0].o.administrators,1);
 await as(candidate);await assert.rejects(()=>db.query('select public.admin_overview()'),/Platform administrator required/);
 await as(platformAdmin);
});
await db.exec('reset role');

// The account profile (brief 2026-10-17-account-profile): one account in full, for a platform administrator only.
await db.exec('reset role');
await db.query(`insert into public.organization_applications(applicant_id,applicant_email,organization_name,organization_type,country_code,official_website,representative_name,representative_role,authorization_description,statement_version,statement_locale)
 values($1,'unconfirmed.person@example.test','Profile test museum','museum','RO','https://profile.example.test','Una Confirmed','Director','The registered office can confirm the appointment.','2026-10-07-v1','en')`,[unconfirmedPerson]);
await db.query("insert into private.account_deletions(user_id,delete_after,requested_by) values($1,now()+interval '30 days',$2)",[unconfirmedPerson,platformAdmin]);
await as(platformAdmin);
const profile=async user=>(await db.query('select public.admin_account($1) p',[user])).rows[0].p;
await check('an account profile shows the organisations, the request and the deletion, and nothing for an unknown or anonymous id',async()=>{
 const shared=await profile(colleague);
 assert.equal(shared.email,'colleague@example.test');assert.equal(shared.confirmed,true);assert.equal(shared.is_admin,false);assert.equal(shared.deletion,null);assert.equal(shared.application,null);
 assert.deepEqual(shared.organisations.map(org=>[org.name,org.role,org.status]),[['Shared museum','owner','approved']]);
 const pending=await profile(unconfirmedPerson);
 assert.equal(pending.confirmed,false);assert.equal(pending.application.status,'pending');assert.equal(pending.application.organisation,'Profile test museum');
 assert.equal(pending.deletion.by_administrator,true);assert.ok(pending.deletion.delete_after);
 assert.equal((await profile(platformAdmin)).is_admin,true);
 assert.equal(await profile(id(9999)),null);assert.equal(await profile(anonymous),null);
});
await check('only a platform administrator can open a profile',async()=>{
 await as(colleague);await assert.rejects(()=>db.query('select public.admin_account($1)',[colleague]),/Platform administrator required/);
 await as(null,'anon');await denied(`select public.admin_account('${colleague}')`);
 await as(platformAdmin);
});
await db.exec('reset role');

// Payments (supabase/migrations/20261018090000_payments.sql): only the webhook's secret records a plan; without one, after the start
// date, an organisation can't publish and visitors see "unavailable"; a failed payment leaves 30 days.
const billOwner=id(70),billAdmin=id(71),billOrg=id(170),billPlace=id(270),billGuide=id(370);
const billingSecret='fixture-only-billing-secret-0123456789abcdef';
await db.exec('reset role');
await db.query('insert into auth.users(id) values($1),($2)',[billOwner,billAdmin]);
await db.query("insert into public.organizations(id,name,approval_status) values($1,'Paying museum','approved')",[billOrg]);
await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner'),($1,$3,'admin')",[billOrg,billOwner,billAdmin]);
await db.query("insert into public.places(id,organization_id,slug,city) values($1,$2,'paying-museum','Example C')",[billPlace,billOrg]);
await db.query("insert into public.guides(id,place_id,organization_id,locale) values($1,$2,$3,'en')",[billGuide,billPlace,billOrg]);
await db.query(`insert into public.guide_versions(guide_id,place_id,organization_id,version,content) values($1,$2,$3,1,'{"source_level":"venue_provided","zones":[{"title":"Entrance"},{},{}]}')`,[billGuide,billPlace,billOrg]);
await db.query("update public.guides set status='published',current_version=1,published_at=now() where id=$1",[billGuide]);
await db.query("update public.places set status='published',published_revision=0 where id=$1",[billPlace]);
await db.query("insert into public.qr_redirects(public_code,place_id,organization_id) values('paying-a',$1,$2)",[billPlace,billOrg]);
await db.query("update private.billing_policy set webhook_secret_sha256=sha256(convert_to($1,'UTF8'))",[billingSecret]);
const record=(status,{secret=billingSecret,subscription='sub_Paying1',created=new Date().toISOString(),periodEnd=null,cancel=false}={})=>
 db.query('select public.billing_record_subscription($1,$2,$3,$4,$5,$6,$7,$8) r',[secret,billOrg,'cus_Paying1',subscription,status,periodEnd,cancel,created]).then(result=>result.rows[0].r);
const paidGuide=async()=>(await db.query("select public.published_guide('paying-museum','en') g")).rows[0].g.status;
const paidQr=async()=>(await db.query("select public.resolve_qr('paying-a') q")).rows[0].q.status;
const billing=async()=>(await db.query('select public.billing_status($1) b',[billOrg])).rows[0].b;
const ago=days=>new Date(Date.now()-days*86400000).toISOString();
await check('before payments start, an organisation without a plan stays visible and may publish',async()=>{
 await as(null,'anon');assert.equal(await paidGuide(),'published');assert.equal(await paidQr(),'published');
 await as(billOwner);const status=await billing();assert.equal(status.required,false);assert.equal(status.allowed,true);assert.equal(status.status,null);
 await db.query('update public.places set published_revision=1 where id=$1',[billPlace]);
});
await check('only the webhook secret records a plan, and nobody reads or writes the plans table directly',async()=>{
 await as(null,'anon');
 await assert.rejects(()=>record('active',{secret:'wrong-secret-of-the-right-length-0123456789'}),/Not allowed/);
 await assert.rejects(()=>record('active',{secret:'short'}),/Not allowed/);
 await assert.rejects(()=>record('active',{secret:null}),/Not allowed/);
 await denied('select * from public.organization_subscriptions');
 await as(billOwner);
 await denied('select * from public.organization_subscriptions');
 await denied(`insert into public.organization_subscriptions(organization_id,stripe_customer_id,stripe_subscription_id,status,event_created) values('${billOrg}','cus_Forged','sub_Forged','active',now())`);
 await denied('select * from private.billing_policy');
 await as(null,'anon');await assert.rejects(()=>record('active',{subscription:'not-a-stripe-id'}));
 await assert.rejects(()=>db.query('select public.billing_record_subscription($1,$2,$3,$4,$5,null,false,now())',[billingSecret,id(9998),'cus_Paying1','sub_Paying1','active']),/Unknown organisation/);
});
await check('after the start date, without a plan: publishing is refused and visitors and the QR code see "unavailable"',async()=>{
 await db.exec('reset role');await db.exec("update private.billing_policy set required_from=now()-interval '1 minute'");
 await as(null,'anon');assert.equal(await paidGuide(),'unavailable');assert.equal(await paidQr(),'unavailable');
 assert.equal((await db.query('select count(*)::int n from public.guides where organization_id=$1',[billOrg])).rows[0].n,0,'not through the table either');
 assert.equal((await db.query('select count(*)::int n from public.qr_redirects where organization_id=$1',[billOrg])).rows[0].n,0);
 await as(billOwner);
 await assert.rejects(()=>db.query('update public.places set published_revision=2 where id=$1',[billPlace]),error=>error.code==='P0402');
 assert.equal((await db.query('select count(*)::int n from public.guides where organization_id=$1',[billOrg])).rows[0].n,1,'the organisation still reads its own guide');
 const status=await billing();assert.equal(status.required,true);assert.equal(status.allowed,false);
});
await check('a paid plan brings the guide back at the same address; an older event changes nothing',async()=>{
 await as(null,'anon');
 assert.equal(await record('active',{periodEnd:new Date(Date.now()+30*86400000).toISOString()}),'recorded');
 assert.equal(await paidGuide(),'published');assert.equal(await paidQr(),'published');
 assert.equal(await record('past_due',{created:ago(1)}),'stale');
 await as(billOwner);const status=await billing();assert.equal(status.status,'active');assert.equal(status.allowed,true);assert.equal(status.graceUntil,null);
 await db.query('update public.places set published_revision=2 where id=$1',[billPlace]);
});
await check('a failed payment keeps the guides online for 30 days, then hides them; paying again brings them back',async()=>{
 await as(null,'anon');assert.equal(await record('past_due'),'recorded');assert.equal(await paidGuide(),'published');
 await as(billOwner);const status=await billing();assert.equal(status.allowed,true);
 const days=(new Date(status.graceUntil)-Date.now())/86400000;assert.ok(days>29.9 && days<=30,`grace ends in 30 days, not ${days}`);
 await as(null,'anon');assert.equal(await record('unpaid'),'recorded');
 await as(billOwner);assert.equal((await billing()).graceUntil,status.graceUntil,'the grace keeps its start');
 await db.exec('reset role');await db.query("update public.organization_subscriptions set lapsed_at=now()-interval '31 days' where organization_id=$1",[billOrg]);
 await as(null,'anon');assert.equal(await paidGuide(),'unavailable');
 assert.equal(await record('active'),'recorded');assert.equal(await paidGuide(),'published');
 await as(billOwner);assert.equal((await billing()).graceUntil,null);
});
await check('a second subscription that ends does not end the paid one; a plan that was never paid gets no grace',async()=>{
 await as(null,'anon');assert.equal(await record('incomplete_expired',{subscription:'sub_Paying2'}),'ignored');
 await as(billOwner);assert.equal((await billing()).status,'active');
 await db.exec('reset role');await db.query('delete from public.organization_subscriptions where organization_id=$1',[billOrg]);
 await as(null,'anon');assert.equal(await record('incomplete'),'recorded');assert.equal(await paidGuide(),'unavailable');
 assert.equal(await record('canceled',{cancel:true}),'recorded');assert.equal(await paidGuide(),'unavailable');
});
await check('the plan is shown to owners and admins only, and the Stripe customer to owners only',async()=>{
 await as(billOwner);assert.equal((await billing()).customer,'cus_Paying1');
 await as(billAdmin);const status=await billing();assert.equal(status.customer,null);assert.equal(status.status,'canceled');
 await as(outsider);await assert.rejects(()=>billing(),/Owner or admin required/);
 await as(null,'anon');await denied(`select public.billing_status('${billOrg}')`);
});
await db.exec('reset role');await db.exec('update private.billing_policy set required_from=null');

// The test fixture fakes the REST layer, so it can't tell when the app asks PostgREST to embed a table that has no direct link to the one
// being read (it fails at run time, and the whole dashboard shows its error page). Every table embedded in the dashboard's place query
// must reference `places` directly.
await check('every table the dashboard embeds under a place has a foreign key to places',async()=>{
 await db.exec('reset role');
 const source=await readFile('src/lib/workspace-server.ts','utf8');
 const selects=[...source.matchAll(/const (?:base|withPublishing) = '([^']+)'/g)].map(match=>match[1]);
 assert.equal(selects.length,2);
 for(const select of selects) {
  let depth=0,part='';const parts=[];
  for(const char of select) {if(char==='(') depth++;if(char===')') depth--;if(char===','&&depth===0){parts.push(part);part='';} else part+=char;}
  parts.push(part);
  const embeds=parts.filter(item=>item.includes('(')).map(item=>item.slice(0,item.indexOf('(')));
  assert.ok(embeds.length>=3,'the place query embeds its children');
  for(const child of embeds) {
   const linked=(await db.query("select count(*)::int n from pg_constraint where contype='f' and conrelid=$1::regclass and confrelid='public.places'::regclass",[`public.${child}`])).rows[0].n;
   assert.ok(linked>0,`${child} is embedded under places but has no foreign key to it: PostgREST would refuse the query`);
  }
 }
});
// Personal data is written down (docs/guides/PERSONAL-DATA.md). A column that points at a user, or looks like an email, a name,
// a note, a file name, a free-text message or a snapshot, can't be added without being listed there; and nothing listed may be stale.
await check('every column that can hold personal data is listed in docs/guides/PERSONAL-DATA.md, and nothing listed is stale',async()=>{
 await db.exec('reset role');
 const doc=await readFile('docs/guides/PERSONAL-DATA.md','utf8');
 const listed=new Set(doc.split('<!-- personal-data-columns:start -->')[1].split('<!-- personal-data-columns:end -->')[0].split('\n').map(line=>line.trim()).filter(Boolean));
 const existing=new Set((await db.query("select table_schema||'.'||table_name||'.'||column_name c from information_schema.columns where table_schema in ('public','private')")).rows.map(row=>row.c));
 const pointsAtUsers=(await db.query("select c.conrelid::regclass::text t, a.attname col from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) where c.contype='f' and c.confrelid='auth.users'::regclass and c.conrelid::regclass::text not like 'auth.%'")).rows.map(row=>`${row.t.includes('.')?row.t:'public.'+row.t}.${row.col}`);
 const lookPersonal=(await db.query("select table_schema||'.'||table_name||'.'||column_name c from information_schema.columns where table_schema in ('public','private') and column_name ~ '(^|_)(email|display_name|representative_name|representative_role|applicant_note|authorization_description|official_website|registry_reference|filename|message|token_hash|rights|notes|before_json|after_json|application_snapshot|verified_source|evidence_reference|instruments|alt_text|content)$'")).rows.map(row=>row.c);
 const missing=[...new Set([...pointsAtUsers,...lookPersonal])].filter(column=>!listed.has(column)).sort();
 assert.deepEqual(missing,[],'add these to docs/guides/PERSONAL-DATA.md (the column list, and section 1)');
 assert.deepEqual([...listed].filter(column=>!existing.has(column)).sort(),[],'these listed columns no longer exist: remove them from docs/guides/PERSONAL-DATA.md');
});
await db.exec(await readFile('supabase/seed.sql','utf8'));
await check('fictional seed creates five draft zones and fifteen zone translations',async()=>{assert.equal((await db.query("select count(*)::int n from public.zones where place_id='a0000000-0000-4000-8000-000000000002'")).rows[0].n,5);assert.equal((await db.query("select count(*)::int n from public.zone_translations where place_id='a0000000-0000-4000-8000-000000000002'")).rows[0].n,15);});
console.log(`\n${checks} database security checks passed. All migrations executed in isolated PostgreSQL (PGlite). No live database touched.`);
await db.close();
