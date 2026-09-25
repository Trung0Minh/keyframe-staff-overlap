import assert from 'node:assert/strict';
import { test } from 'node:test';
import { StructuredKeyframeDataSource } from '../src/data/StructuredKeyframeDataSource.ts';
import { validPerson } from '../src/data/cache.ts';
import { historyPayload } from './fixtures.mjs';

const staff = (overrides = {}) => ({anilist_id:7,en:'Alias Seven',ja:'Alias JA',main_en:'Person 7',main_ja:'Native 7',is_studio:0,jobs:['Animator'],...overrides});

test('global search uses the native endpoint, canonical IDs, aliases and studio filtering without a page',async()=>{
  let request;
  const controller=new AbortController();
  const source=new StructuredKeyframeDataSource(async(url,options)=>{
    request={url:String(url),options};
    return Response.json({staff:[staff(),staff({en:'Another alias'}),staff({anilist_id:8,is_studio:1}),staff({anilist_id:null,en:'HIRO',ja:null,main_en:'HIRO',main_ja:null})]});
  });
  assert.deepEqual(await source.searchPeople('a'),[]);
  assert.equal(request,undefined);
  const results=await source.searchPeople(' Alias & Seven ',controller.signal);
  assert.equal(request.url,'https://keyframe-staff-list.com/api/search/?q=Alias+%26+Seven&type=staff');
  assert.equal(request.options.signal,controller.signal);
  assert.equal(results.length,2);
  assert.equal(results[0].displayName,'Person 7');
  assert.deepEqual(results[0].aliases,['Alias Seven','Alias JA','Another alias']);
  assert.equal(results[0].profileUrl,'https://keyframe-staff-list.com/person/7');
  assert.equal(results[1].personId,'en:HIRO');
  assert.ok(results.every(validPerson));
});

test('search handles empty results, malformed schemas, network failures and cancellation',async()=>{
  assert.deepEqual(await new StructuredKeyframeDataSource(async()=>Response.json({staff:[]})).searchPeople('none'),[]);
  for(const payload of [{},{staff:null},{staff:[staff({anilist_id:'bad'})]},{staff:[staff({jobs:{}})]}]) {
    await assert.rejects(()=>new StructuredKeyframeDataSource(async()=>Response.json(payload)).searchPeople('xx'),e=>e.code==='SCHEMA_CHANGED');
  }
  for(const [status,code] of [[429,'RATE_LIMITED'],[500,'NETWORK']]) {
    await assert.rejects(()=>new StructuredKeyframeDataSource(async()=>new Response('',{status})).searchPeople('xx'),e=>e.code===code);
  }
  await assert.rejects(()=>new StructuredKeyframeDataSource(async()=>new Response('<html>')).searchPeople('xx'),e=>e.code==='PARSE_FAILED');
  const controller=new AbortController();
  const source=new StructuredKeyframeDataSource(async()=>{controller.abort();return Response.json({staff:[]});});
  await assert.rejects(()=>source.searchPeople('xx',controller.signal),e=>e.code==='ABORTED');
});

test('name-based profiles retain identity through search, history and saved selection',async()=>{
  const payload=historyPayload();payload.staff.id=null;payload.staff.en='HIRO';
  let requested;
  const source=new StructuredKeyframeDataSource(async url=>{requested=new URL(url);return Response.json(payload);});
  const history=await source.getPersonHistory('en:HIRO');
  assert.equal(requested.searchParams.get('id'),'en:HIRO');
  assert.equal(history.person.personId,'en:HIRO');
  assert.ok(validPerson(history.person));
  await assert.rejects(()=>source.getPersonHistory('en:Other'),e=>e.code==='SCHEMA_CHANGED');
});

test('fetch is called without a data-source receiver, as required by browser fetch',async()=>{
  const source=new StructuredKeyframeDataSource(function(url){
    assert.equal(this,undefined);
    return Promise.resolve(Response.json(String(url).includes('/api/search/') ? {staff:[]} : historyPayload()));
  });
  await source.searchPeople('xx');
  await source.getPersonHistory('7');
});
