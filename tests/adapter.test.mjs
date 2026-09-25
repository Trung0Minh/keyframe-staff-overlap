import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHistory, StructuredKeyframeDataSource } from '../src/data/StructuredKeyframeDataSource.ts';
import { historyPayload } from './fixtures.mjs';

test('observed history schema preserves identity, roles, aliases, NC, notes and studio attribution', () => {
  const h=parseHistory(historyPayload());
  assert.equal(h.person.personId,'7'); assert.ok(h.person.aliases.includes('Alias A'));
  assert.equal(h.productions[0].production.productionId,'prod');
  assert.equal(h.productions[0].production.canonicalUrl,'https://keyframe-staff-list.com/staff/show');
  const u=h.productions[0].credits[0].units[0];
  assert.equal(u.key,'episode:1'); assert.equal(u.raw,'#001');
  assert.deepEqual(u.flags,['NC']); assert.equal(u.note,'First credit');
  assert.equal(u.studio,'Studio A'); assert.equal(u.alias,'Alias A');
});

test('schema drift fails the entire history rather than returning incomplete matches', () => {
  const mutations=[p=>p.staff.id=null,p=>p.staff.id='',p=>p.credits=null,p=>p.credits[0]=null,
    p=>delete p.credits[0].uuid,p=>delete p.credits[0].names,p=>p.credits[0].names[0].categories={},
    p=>p.credits[0].names[0].categories[0].roles=null,
    p=>p.credits[0].names[0].categories[0].roles[0].credits=null,
    p=>p.credits[0].names[0].categories[0].roles[0].credits[0].episode=null];
  for(const mutate of mutations){const p=historyPayload();mutate(p);assert.throws(()=>parseHistory(p),e=>e.code==='SCHEMA_CHANGED');}
  const p=historyPayload();p.credits=[]; assert.equal(parseHistory(p).productions.length,0);
});

test('history requests use the observed endpoint; ID mismatches and HTTP failures are explicit',async()=>{
  let requested;
  const source=new StructuredKeyframeDataSource(async(url)=>{requested=String(url);return Response.json(historyPayload());});
  await source.getPersonHistory('7');
  assert.equal(requested,'https://keyframe-staff-list.com/api/person/show.php?id=7&type=person');
  await assert.rejects(()=>source.getPersonHistory('8'), e=>e.code==='SCHEMA_CHANGED');
  for(const [status,code] of [[404,'NOT_FOUND'],[429,'RATE_LIMITED'],[500,'NETWORK']]){
    await assert.rejects(()=>new StructuredKeyframeDataSource(async()=>new Response('',{status})).getPersonHistory('7'),e=>e.code===code);
  }
  await assert.rejects(()=>new StructuredKeyframeDataSource(async()=>{throw new DOMException('cancel','AbortError');}).getPersonHistory('7'),e=>e.code==='ABORTED');
});

test('similar role names and Japanese labels survive together with unknown units',()=>{
  const payload=historyPayload();
  const roles=payload.credits[0].names[0].categories[0].roles;
  roles.push({role_en:'Animation Director',role_ja:'AD-JA',credits:[{episode:'OP',is_nc:0}]});
  roles.push({role_en:'Chief Animation Director',role_ja:'CAD-JA',credits:[{episode:'Pilot A',is_nc:0}]});
  const credits=parseHistory(payload).productions[0].credits;
  assert.equal(credits.length,3);assert.equal(credits[1].roleJa,'AD-JA');
  assert.equal(credits[2].units[0].key,'other:pilot a');
});
