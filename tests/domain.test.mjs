import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeUnit } from '../src/domain/normalize-unit.ts';
import { normalizeProductionUrl, productionIdFromUrl } from '../src/domain/normalize-production.ts';
import { findMatches, computePairOverlaps, computeLeaveOneOutOverlaps } from '../src/domain/match.ts';

export const person = (id, works) => ({
  person: { personId: id, displayName: id, nativeNames: [], aliases: [], jobs: [], profileUrl: `https://keyframe-staff-list.com/person/${id}` },
  fetchedAt: 0,
  productions: works.map(([productionId, ...units]) => ({ personId: id,
    production: { productionId, canonicalUrl: `https://keyframe-staff-list.com/staff/${productionId}`, title: productionId, aliases: [], year: 2025, studios: [] },
    credits: [{ category: 'Key Animation', roleEn: 'Key Animation', units: units.map(normalizeUnit) }],
  })),
});

test('normalization preserves raw labels and only removes known NC annotations', () => {
  for (const [raw, key] of Object.entries({ '#01':'episode:1', '#1':'episode:1', '#001':'episode:1', '#1125 [NC]':'episode:1125',
    OP:'op', op:'op', OP1:'op:1', OP01:'op:1', ED:'ed', ED2:'ed:2', Movie:'movie', MV:'mv', PV:'pv', CM:'cm', Special:'special', Overview:'overview',
    'Pilot A':'other:pilot a', '#01 [Part A]':'other:#01 [part a]', '  #01  ':'episode:1', constructor:'other:constructor' })) {
    const unit = normalizeUnit(raw);
    assert.equal(unit.key, key); assert.equal(unit.raw, raw);
  }
  assert.deepEqual(normalizeUnit('#1125 [NC]').flags, ['NC']);
  assert.notEqual(normalizeUnit('OP').key, normalizeUnit('OP1').key);
  assert.notEqual(normalizeUnit('#9007199254740993').key, normalizeUnit('#9007199254740992').key);
});

test('production URLs normalize identity and reject unsafe or unrelated links', () => {
  assert.equal(normalizeProductionUrl('/staff/show/?x=1#03'), 'https://keyframe-staff-list.com/staff/show');
  assert.equal(productionIdFromUrl('/staff/show#03'), 'show');
  for (const url of ['https://evil.test/staff/show', 'javascript:alert(1)', '/person/7', 'https://user:pass@keyframe-staff-list.com/staff/a']) {
    assert.throws(() => normalizeProductionUrl(url));
  }
});

test('same production permits different units; same unit requires all people and preserves all credits', () => {
  const a = person('a', [['x','#01','ED'], ['y','Overview']]);
  const b = person('b', [['x','#02'], ['y','#03']]);
  assert.deepEqual(findMatches([a,b],'production').map(r=>r.production.productionId), ['x','y']);
  assert.deepEqual(findMatches([a,b],'unit'), []);
  b.productions[0].credits[0].units.push(normalizeUnit('#001'));
  const result = findMatches([a,b],'unit')[0];
  assert.deepEqual(result.sharedUnitKeys, ['episode:1']);
  assert.equal(result.people[0].credits[0].units.length, 2);
  assert.deepEqual(findMatches([a,b,person('c',[['x','#02']])],'unit'), []);
  assert.deepEqual(findMatches([person('a',[['x','Overview']]),person('b',[['x','Overview']])],'unit'), []);
});

test('three-way matches, pairs, leave-one-out groups, and duplicate titles use IDs', () => {
  const a=person('a',[['x','#01'],['y','#01']]), b=person('b',[['x','#01'],['z','#01']]), c=person('c',[['x','#01'],['q','#01']]);
  assert.deepEqual(findMatches([a,b,c],'production').map(r=>r.production.productionId), ['x']);
  c.productions.shift();
  assert.equal(findMatches([a,b,c],'production').length, 0);
  assert.equal(computePairOverlaps([a,b,c],'production')[0].productionCount, 1);
  const groups=computeLeaveOneOutOverlaps([a,b,person('c',[['x','#01']]),person('d',[['q','#01']])],'unit');
  assert.deepEqual(groups.map(g=>g.people.map(p=>p.personId)), [['a','b','c']]);
  c.productions[0].production.title='x';
  assert.equal(findMatches([a,c],'production').length, 0);
});

test('repeated production rows preserve credits, sort ties by title, and reject repeated people', () => {
  const a=person('a',[['x','#01'],['x','ED'],['y','#03']]), b=person('b',[['x','#01'],['y','#03']]);
  const result=findMatches([a,b],'unit');
  assert.deepEqual(result.map(r=>r.production.productionId), ['x','y']);
  assert.equal(result[0].people[0].credits.length, 2);
  b.productions[0].production.year=2026; a.productions[0].production.year=undefined;
  a.productions[1].production.year=undefined;
  assert.equal(findMatches([a,b],'production')[0].production.year,2026);
  assert.throws(()=>findMatches([a,a],'production'));
});

test('a production row with no credits is not evidence of collaboration',()=>{
  const a=person('1',[['x','#01']]), b=person('2',[['x','#01']]);
  a.productions[0].credits=[];
  assert.deepEqual(findMatches([a,b],'production'),[]);
});

test('known years sort newest first; unknown years sort last by title',()=>{
  const a=person('1',[['a','#01'],['b','#01'],['c','#01'],['d','#01']]);
  const b=structuredClone(a);b.person.personId='2';
  for(const h of [a,b]){
    h.productions[0].production.year=2020;h.productions[1].production.year=2026;
    h.productions[2].production.year=undefined;h.productions[3].production.year=undefined;
  }
  assert.deepEqual(findMatches([a,b],'production').map(r=>r.production.title),['b','a','c','d']);
});
