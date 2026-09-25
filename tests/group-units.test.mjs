import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupUnits } from '../src/domain/group-units.ts';
import { normalizeUnit } from '../src/domain/normalize-unit.ts';

test('episodes form aligned rows, merge roles and retain attribution without changing source credits',()=>{
  const credit=(role,labels)=>({roleEn:role,units:labels.map(normalizeUnit)});
  const people=[
    {credits:[credit('Key Animation',['#19','#2','Overview']),credit('Key Animation',['#19 [NC]']),credit('Animation Director',['#19']),credit('Unspecified',[])]},
    {credits:[credit('Storyboard',['#019','#2']),credit('Layout',['#19','ED','Overview'])]},
    {credits:[credit('Direction',['#19','Overview'])]},
  ];
  people[0].credits[1].units[0].note='Uncredited source note';
  const original=structuredClone(people);
  const rows=groupUnits(people);
  assert.deepEqual(rows.map(row=>row.unit?.key),['episode:19','episode:2','ed','overview',undefined]);
  assert.equal(rows[0].shared,true);
  assert.deepEqual(rows[0].cells.map(cell=>cell.map(c=>c.roleEn)),[['Key Animation','Animation Director'],['Storyboard','Layout'],['Direction']]);
  assert.equal(rows[0].cells[0][0].units.length,2);
  assert.equal(rows[0].cells[0][0].units[1].note,'Uncredited source note');
  assert.deepEqual(rows[0].cells[0][0].units[1].flags,['NC']);
  assert.equal(rows[1].shared,false);
  assert.equal(rows[1].count,2);
  assert.deepEqual(rows[1].cells[2],[]);
  assert.equal(rows[3].shared,false,'Overview is never an episode match');
  assert.equal(rows[4].cells[0][0].roleEn,'Unspecified');
  assert.deepEqual(people,original);
  const numeric=groupUnits([{credits:[credit('Role',['#10','#2','#1'])]},{credits:[credit('Role',['#10','#2','#1'])]}]);
  assert.deepEqual(numeric.map(row=>row.unit.number),[1,2,10]);
});
