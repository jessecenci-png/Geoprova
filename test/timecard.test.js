import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,analyze} from '../src/analysis.js';
import {dailyRows,groupedReportRows} from '../src/presentation.js';
const params={from:'2025-07-31',to:'2025-07-31',zone:'America/Sao_Paulo',confirmed:true,area:{lat:-23,lon:-46,radius:100},maxAccuracy:100,maxGapMinutes:30,maxSpeed:100};
const visit=(start,end)=>({startTime:`2025-07-31T${start}-03:00`,endTime:`2025-07-31T${end}-03:00`,visit:{topCandidate:{placeLocation:{latLng:'-23,-46'}}}});
test('pontos no mesmo minuto ou um minuto ao lado da visita são apoio, não novas marcações',()=>{
 const data=normalize({semanticSegments:[visit('08:26:30','11:42:20')],rawSignals:['08:26:00','11:43:00','12:00:00'].map(t=>({position:{LatLng:'-23,-46',timestamp:`2025-07-31T${t}-03:00`}}))});
 const report=analyze(data,params),day=dailyRows(report)[0];assert.deepEqual(day.positionTimes,[Date.parse('2025-07-31T12:00:00-03:00')]);assert.equal(day.visits.length,1);assert.equal(day.visits[0].arrival,Date.parse('2025-07-31T08:26:30-03:00'));assert.equal(day.durationMs,196*60000);assert.equal(report.observations.length,3);
});
test('intervalos fora da ordem na fonte ficam cronológicos na linha diária; retorno real de um minuto é preservado',()=>{
 const data=normalize({semanticSegments:[visit('13:00:00','17:00:00'),visit('08:00:00','12:59:00')]});
 const day=dailyRows(analyze(data,params))[0];assert.equal(day.visits[0].arrival,Date.parse('2025-07-31T08:00:00-03:00'));assert.equal(day.visits[1].arrival,Date.parse('2025-07-31T13:00:00-03:00'));assert.equal(day.visits.length,2);
});
test('subtotal semanal vem depois dos dias da própria semana, não abre a semana seguinte',()=>{
 const data=normalize({semanticSegments:[visit('08:00:00','12:00:00')]});
 const rows=groupedReportRows(analyze(data,{...params,from:'2025-07-31',to:'2025-08-04'}));
 const footer=rows.findIndex(r=>r.type==='week');assert.equal(rows[footer-1].day,'2025-08-03');assert.equal(rows[footer+1].day,'2025-08-04');assert.equal(rows[footer].from,'2025-07-28');
});
test('visitas sobrepostas são unidas na apresentação sem alterar a fonte ou duplicar o total',()=>{
 const data=normalize({semanticSegments:[visit('08:00:00','12:00:00'),visit('08:01:00','12:01:00'),visit('13:00:00','17:00:00')]});
 const report=analyze(data,params),day=dailyRows(report)[0];assert.equal(day.visits.length,2);assert.equal(day.visits[0].arrival,Date.parse('2025-07-31T08:00:00-03:00'));assert.equal(day.visits[0].departure,Date.parse('2025-07-31T12:01:00-03:00'));assert.equal(day.visits[0].refs.length,2);assert.equal(day.visits[0].durationMs,241*60000);assert.equal(report.days[0].periods.length,3);assert.equal(day.durationMs,481*60000);
});
