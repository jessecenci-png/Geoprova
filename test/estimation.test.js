import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {normalize,analyze} from '../src/analysis.js';
import {dailyRows,periodTotals} from '../src/presentation.js';
import {portable,workbook} from '../src/export.js';
const params={from:'2025-09-08',to:'2025-09-08',zone:'America/Sao_Paulo',confirmed:true,area:{lat:-23,lon:-46,radius:100},maxAccuracy:100,maxGapMinutes:30,maxSpeed:100,positionPairing:'consecutive',positionDuplicateMinutes:1};
const raw=times=>times.map(t=>({position:{LatLng:'-23,-46',timestamp:`2025-09-08T${t}-03:00`}}));
test('pares estimados do exemplo: 09:43–12:26 e 14:35–15:24 totalizam 3h32',async()=>{
 const json={rawSignals:raw(['15:24:00','09:44:00','12:26:00','09:43:00','14:35:00'])},source=normalize(json),report=analyze(source,params),day=dailyRows(report)[0];
 assert.equal(day.visits.length,2);assert.ok(day.visits.every(p=>p.estimated));assert.equal(day.durationMs,212*60000);assert.equal(periodTotals(report).weeks[0].durationMs,212*60000);assert.equal(periodTotals(report).months[0].durationMs,212*60000);assert.equal(day.positionTimes.length,0);assert.equal(report.observations.length,5);assert.equal(report.days[0].estimatedPeriods[0].sourceRefs.length,3);assert.equal(report.days[0].hasEstimates,true);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await workbook(portable(report,{})));const sheet=book.getWorksheet('Resumo diário');assert.equal(sheet.getCell('C2').value.getUTCMinutes(),43);assert.equal(sheet.getCell('D2').value.getUTCMinutes(),26);assert.match(sheet.getCell('C2').note,/estimada/);assert.match(sheet.getCell('H2').value,/Par estimado/);
 assert.deepEqual(portable(report,{}),portable(analyze(normalize(json),params),{}));assert.equal(source.points.length,5);
});
test('horário ímpar fica sem saída e não infla total estimado',()=>{
 const report=analyze(normalize({rawSignals:raw(['08:36:00','08:56:00','11:35:00'])}),params),day=dailyRows(report)[0];assert.equal(day.visits.length,2);assert.equal(day.visits[1].departure,null);assert.equal(day.durationMs,20*60000);assert.equal(day.incompletePresence,true);assert.ok(periodTotals(report).weeks[0].unquantifiableDays>0);
});
test('pontos de apoio a um minuto não criam estimativa ao lado de visita e não alteram seus limites',()=>{
 const report=analyze(normalize({semanticSegments:[{startTime:'2025-09-08T08:26:30-03:00',endTime:'2025-09-08T11:42:20-03:00',visit:{topCandidate:{placeLocation:{latLng:'-23,-46'}}}}],rawSignals:raw(['08:26:00','11:43:00'])}),params);
 const day=dailyRows(report)[0];assert.equal(day.visits.length,1);assert.equal(day.hasEstimates,false);assert.equal(day.positionTimes.length,0);assert.equal(day.durationMs,196*60000);assert.equal(report.observations.length,2);
});
test('modo sem estimativas mantém posições sem converter em entradas e saídas',()=>{
 const report=analyze(normalize({rawSignals:raw(['09:43:00','12:26:00','14:35:00','15:24:00'])}),{...params,positionPairing:'none'});assert.equal(dailyRows(report)[0].visits.length,0);assert.equal(dailyRows(report)[0].durationMs,null);assert.equal(dailyRows(report)[0].positionTimes.length,4);
});
