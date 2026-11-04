import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,analyze} from '../src/analysis.js';
import {summaryRows} from '../src/presentation.js';
const params={from:'2026-07-14',to:'2026-07-14',zone:'America/Sao_Paulo',confirmed:true,area:{lat:-23,lon:-46,radius:20},maxAccuracy:100,maxGapMinutes:30,maxSpeed:100};
const visit=(a,b)=>({startTime:`2026-07-14T${a}-03:00`,endTime:`2026-07-14T${b}-03:00`,visit:{topCandidate:{placeLocation:{latLng:'-23°, -46°'}}}});
test('trajeto fora do raio durante visita não gera inconsistência por essa razão',()=>{
 const data=normalize({semanticSegments:[visit('08:44:02','11:41:06'),{startTime:'2026-07-14T08:43:00-03:00',endTime:'2026-07-14T08:45:00-03:00',timelinePath:[{point:'-23.0005°, -46°',time:'2026-07-14T08:44:04-03:00'}]}]});
 const result=analyze(data,params);assert.equal(result.days[0].periods.length,1);assert.ok(!result.days[0].alerts.some(a=>/fora da área durante/.test(a.reason)));assert.ok(!result.days[0].alerts.some(a=>a.kind==='Inconsistência'));
 const row=summaryRows(result)[0];assert.equal(row.arrival,Date.parse('2026-07-14T08:44:02-03:00'));assert.equal(row.departure,Date.parse('2026-07-14T11:41:06-03:00'));
});
test('relatório simples preserva retornos e alertas de possível intervenção',()=>{
 const edited=visit('13:00:00','17:00:00');edited.visit.isTimelessVisit=false;
 const rows=summaryRows(analyze(normalize({semanticSegments:[visit('08:00:00','12:00:00'),edited]}),params));assert.equal(rows.length,2);assert.notEqual(rows[0].arrival,rows[1].arrival);assert.ok(rows[1].alerts.some(a=>a.kind==='Possível intervenção manual'));
});
test('posição isolada não vira horário exato de chegada/saída no relatório simples',()=>{
 const rows=summaryRows(analyze(normalize({rawSignals:[{position:{LatLng:'-23°, -46°',timestamp:'2026-07-14T09:00:00-03:00'}}]}),params));assert.equal(rows[0].arrival,null);assert.equal(rows[0].departure,null);assert.match(rows[0].status,/Posições no local/);
});
