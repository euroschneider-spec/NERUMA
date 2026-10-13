import { writeFile } from 'node:fs/promises';
import { getDemoGuide } from '../src/lib/demo.ts';
const org='a0000000-0000-4000-8000-000000000001',place='a0000000-0000-4000-8000-000000000002';
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const zoneId=i=>`a0000000-0000-4000-8000-${String(10+i).padStart(12,'0')}`;
let sql=`-- FICTIONAL local fixtures. Run only against a disposable or dedicated VIANORAE database.\n-- No auth accounts, passwords, memberships or live published guides are created.\nbegin;\ninsert into public.organizations(id,name,status) values('${org}','Willow Museum — FICTIONAL DEMO','draft');\ninsert into public.places(id,organization_id,slug,city,address,place_type,status,template_id) values('${place}','${org}','place-${place}','Fictional example','Willow Square — fictional address','museum','draft',(select id from public.templates where place_type='museum' and version=1));\n`;
const english=getDemoGuide('en');
for(let i=0;i<5;i++) {
 sql+=`insert into public.zones(id,place_id,organization_id,type,sort_order) values('${zoneId(i)}','${place}','${org}',${quote(english.zones[i].id)},${i});\n`;
 const s=english.zones[i].sensory;
 sql+=`insert into public.sensory_profiles(zone_id,place_id,organization_id,sound_level,light_level,smell_level,crowding_level,temperature_level,visual_complexity_level) values('${zoneId(i)}','${place}','${org}',${[s.sound,s.light,s.smell,s.crowding,s.temperature,s.visual].map(quote).join(',')});\n`;
}
for(const locale of ['en','ro','de']){
 const guide=getDemoGuide(locale);
 sql+=`insert into public.place_translations(place_id,organization_id,locale,name,short_description) values('${place}','${org}',${quote(locale)},${quote(guide.title)},'FICTIONAL DEMO');\n`;
 for(let i=0;i<5;i++){const z=guide.zones[i];sql+=`insert into public.zone_translations(zone_id,place_id,organization_id,locale,title,description,useful_note) values('${zoneId(i)}','${place}','${org}',${quote(locale)},${quote(z.title)},${quote(z.description)},${quote(z.note)});\n`;}
}
await writeFile('supabase/seed.sql',sql+'commit;\n');
