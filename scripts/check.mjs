import assert from 'node:assert/strict';
import './build.mjs';
import { localDatabase } from './local-db.mjs';
const { default: worker } = await import('../dist/server/index.js');
const DB = localDatabase(), origin = 'https://campus.test';
const get = async path => worker.fetch(new Request(origin+path), { DB });
const write = async (path,body,status) => {
  const result = await worker.fetch(new Request(origin+'/api/'+path,{
    method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)
  }), { DB });
  const data=await result.json();
  assert.equal(result.status,status,JSON.stringify(data));
  return data;
};
let state = await (await get('/api/state')).json();
assert.equal(state.slots.length,150);
for (const [location,type,count] of [
  ['Main Gate','Car',30], ['Academic Block','Car',20],
  ['Main Gate','Two-wheeler',60], ['Academic Block','Two-wheeler',40]
]) {
  assert.equal(state.slots.filter(s=>s.location===location&&s.type===type).length,count);
}
assert.equal(state.records.filter(r=>!r.exited).length,12);
assert.equal(state.demo,true);
const history = state.records.filter(record => record.id < -1000);
const dailyTotals = new Map();
for (const visit of history) {
  const localDay = new Date(Date.parse(visit.entered) + 19800000).toISOString().slice(0, 10);
  assert.ok(visit.exited > visit.entered);
  assert.ok(localDay < state.date);
  dailyTotals.set(localDay, (dailyTotals.get(localDay) || 0) + 1);
}
assert.equal(dailyTotals.size, 14);
for (const [day, entries] of dailyTotals) {
  const weekday = new Date(day).getUTCDay();
  assert.ok(weekday === 0 || weekday === 6 ? entries <= 5 : entries >= 8);
}
const refreshed = await (await get('/api/state')).json();
assert.deepEqual(refreshed.records, state.records);
assert.equal(state.vehicles.filter(v => /^HR[0-9]{2}[A-Z]{2}[0-9]{4}$/.test(v.plate)).length,16);
DB.prepare("UPDATE vehicle SET plate = 'DEMO1001' WHERE id = -1").run();
DB.prepare('DELETE FROM demo_history WHERE version = 2').run();
const upgraded = await (await get('/api/state')).json();
assert.equal(upgraded.vehicles.find(v => v.id === -1).plate,'HR51QZ4816');
assert.deepEqual(upgraded.records, state.records);

console.log('Verified', history.length, 'sample visits across', dailyTotals.size, 'days and no duplicate records on refresh.');

assert.match(await (await get('/')).text(),/Parking overview/);
assert.equal((await get('/design.css')).status,200);
assert.equal((await get('/dashboard.js')).status,200);
await write('entry',{plate:'UNKNOWN',slot:'A-12'},404);
await write('entry',{plate:'HR51QZ4816',slot:'A-12'},409);
await write('exit',{plate:'HR 51 QZ 4816'},200);
await write('exit',{plate:'HR51QZ4816'},404);
await write('entry',{plate:'HR51QZ4816',slot:'C-12'},400);
await write('entry',{plate:'HR51QZ4816',slot:'A-01'},201);
await write('entry',{plate:'HR51ZW6752',slot:'C-12'},409);
const vehicle={plate:'HR 51 AB 6688',student:'26MCA99',type:'Car',first:'Test',last:'Student',department:'MCA'};
await write('vehicle',vehicle,201);
await write('vehicle',{...vehicle,plate:'HR51AB6688'},409);
await write('entry',{plate:vehicle.plate,slot:'A-01'},409);
await write('pass',{student:vehicle.student,type:'Semester',expires:state.date},201);
await write('entry',{plate:vehicle.plate,slot:'A-01'},409);
await write('entry',{plate:vehicle.plate,slot:'A-30'},201);
await write('clear-samples',{},200);
state=await (await get('/api/state')).json();
assert.equal(state.demo,false);
assert.equal(state.records.length,1);
assert.equal(state.records.filter(r=>!r.exited).length,1);
assert.equal(state.vehicles[0].plate,'HR51AB6688');
console.log('Passed entry, exit, slot conflict, registration, pass, and demo cleanup checks.');
