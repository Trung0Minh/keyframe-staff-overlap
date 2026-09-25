import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyPayload } from './fixtures.mjs';
import { parseHistory } from '../src/data/StructuredKeyframeDataSource.ts';
import { HistoryCache, CACHE_VERSION, CACHE_TTL } from '../src/data/cache.ts';
import { ComparisonRunner } from '../src/data/compare.ts';

test('cache respects TTL, version, force refresh, corruption and failed writes/refreshes', async()=>{
  const values={}; const storage={get:async k=>({[k]:values[k]}),set:async data=>Object.assign(values,data)};
  let calls=0, now=1000, failure=false;
  const source={getPersonHistory:async id=>{calls++;if(failure)throw Error('offline');return parseHistory(historyPayload(Number(id)));}};
  const cache=new HistoryCache(source,storage,()=>now);
  await cache.getPersonHistory('7'); await cache.getPersonHistory('7'); assert.equal(calls,1);
  await cache.getPersonHistory('8'); assert.equal(calls,2);
  await cache.getPersonHistory('7',{forceRefresh:true}); assert.equal(calls,3);
  now+=CACHE_TTL+1;await cache.getPersonHistory('7');assert.equal(calls,4);
  values['personHistory:7'].schemaVersion=CACHE_VERSION-1;await cache.getPersonHistory('7');assert.equal(calls,5);
  values['personHistory:7'].value.productions[0].credits=null;await cache.getPersonHistory('7');assert.equal(calls,6);
  const valid=structuredClone(values['personHistory:7']); failure=true;
  await assert.rejects(()=>cache.getPersonHistory('7',{forceRefresh:true})); assert.deepEqual(values['personHistory:7'],valid);
  const hits=calls;await cache.getPersonHistory('7');assert.equal(calls,hits);
  failure=false;
  const brokenStorage={get:async()=>{throw Error('storage off')},set:async()=>{throw Error('quota')}};
  assert.equal((await new HistoryCache(source,brokenStorage).getPersonHistory('7')).person.personId,'7');
});

test('pool never exceeds four requests, reports progress and retains selection order',async()=>{
  let active=0,max=0;const people=Array.from({length:9},(_,i)=>parseHistory(historyPayload(i+1)).person);
  const loader={getPersonHistory:async id=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return parseHistory(historyPayload(Number(id)));}};
  const progress=[];const result=await new ComparisonRunner(loader).run(people,false,n=>progress.push(n));
  assert.equal(max,4);assert.deepEqual(progress,[1,2,3,4,5,6,7,8,9]);
  assert.deepEqual(result.map(h=>h.person.personId),people.map(p=>p.personId));
});

test('cancelled runs cannot publish progress/results even when a source ignores abort',async()=>{
  let finish;
  const p=parseHistory(historyPayload(7));
  let calls=0;const runner=new ComparisonRunner({getPersonHistory:async()=>++calls===1 ? new Promise(r=>finish=r) : p});
  const progress=[];const old=runner.run([p.person],false,n=>progress.push(n));
  runner.cancel();
  const current=await runner.run([p.person],false,()=>{});
  finish(p);
  assert.equal(await old,null);assert.deepEqual(progress,[]);assert.equal(current[0].person.personId,'7');
});

test('one failed history fails the comparison and stops scheduling the remaining people',async()=>{
  let calls=0;const people=Array.from({length:10},(_,i)=>parseHistory(historyPayload(i+1)).person);
  const loader={getPersonHistory:async()=>{calls++;throw Error('offline');}};
  await assert.rejects(()=>new ComparisonRunner(loader).run(people,false,()=>{}),/Person 1/);
  assert.ok(calls<=4);
});
