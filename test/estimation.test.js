import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {normalize,analyze} from '../src/analysis.js';
import {dailyRows,periodTotals,totalDurationText} from '../src/presentation.js';
import {portable,workbook} from '../src/export.js';
const params={from:'2025-09-08',to:'2025-09-08',zone:'America/Sao_Paulo',confirmed:true,area:{lat:-23,lon:-46,radius:100},maxAccuracy:100,maxGapMinutes:30,maxSpeed:100,positionPairing:'spatial'};
const samples=rows=>({rawSignals:rows.map(([t,inside])=>({position:{LatLng:inside?'-23,-46':'-23.003,-46',timestamp:`2025-09-08T${t}-03:00`}}))});
const at=t=>Date.parse(`2025-09-08T${t}-03:00`);
test('chegada e saída são janelas apoiadas por posições externas; totais são faixas',async()=>{
 const json=samples([['09:15:00',false],['09:00:00',true],['08:55:00',false],['09:10:00',true]]),report=analyze(normalize(json),params),day=dailyRows(report)[0],session=day.visits[0];
 assert.deepEqual(session.arrivalWindow,[at('08:55:00'),at('09:00:00')]);assert.deepEqual(session.departureWindow,[at('09:10:00'),at('09:15:00')]);assert.equal(day.durationMinMs,10*60000);assert.equal(day.durationMaxMs,20*60000);assert.equal(totalDurationText(day),'0h 10min a 0h 20min');assert.equal(periodTotals(report).weeks[0].durationMaxMs,20*60000);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await workbook(portable(report,{})));const sheet=book.getWorksheet('Resumo diário');assert.match(sheet.getCell('C2').value,/08:55.*09:00/);assert.match(sheet.getCell('D2').value,/09:10.*09:15/);assert.match(sheet.getCell('G2').value,/0h 10min a 0h 20min/);assert.equal(book.getWorksheet('Apuração espacial').state,'hidden');assert.equal(sheet.getColumn('I').hidden,true);assert.ok(book.getWorksheet('Apuração espacial').getCell('D2').value instanceof Date);
 assert.deepEqual(portable(report,{}),portable(analyze(normalize(json),params),{}));
});
test('duas posições internas não viram entrada e saída; saída precisa de posição posterior fora',()=>{
 const report=analyze(normalize(samples([['08:55:00',false],['09:00:00',true],['09:10:00',true]])),params),day=dailyRows(report)[0];assert.equal(day.visits.length,1);assert.notEqual(day.visits[0].arrivalWindow,null);assert.equal(day.visits[0].departureWindow,null);assert.equal(day.visits[0].lastPosition,at('09:10:00'));assert.equal(day.durationMinMs,null);assert.equal(periodTotals(report).months[0].durationMinMs,null);
});
test('sem posição externa anterior, chegada fica indeterminada mesmo havendo saída apoiada',()=>{
 const day=dailyRows(analyze(normalize(samples([['09:00:00',true],['09:10:00',true],['09:15:00',false]])),params))[0];assert.equal(day.visits[0].arrivalWindow,null);assert.notEqual(day.visits[0].departureWindow,null);assert.equal(day.durationMinMs,null);
});
test('lacuna de horas não é convertida em permanência contínua',()=>{
 const day=dailyRows(analyze(normalize(samples([['08:55:00',false],['09:00:00',true],['17:00:00',true],['17:05:00',false]])),params))[0];assert.equal(day.visits.length,2);assert.equal(day.visits[0].departureWindow,null);assert.equal(day.visits[1].arrivalWindow,null);assert.equal(day.durationMinMs,null);
});
test('posições contraditórias no mesmo instante não criam transição exata falsa',()=>{
 const day=dailyRows(analyze(normalize(samples([['08:55:00',false],['09:00:00',true],['09:05:00',false],['09:05:00',true],['09:10:00',true],['09:15:00',false]])),params))[0];assert.equal(day.visits.length,2);assert.equal(day.durationMinMs,null);assert.equal(day.visits[0].departureWindow,null);assert.equal(day.visits[1].arrivalWindow,null);
});
test('pareamento por sequência antigo é rejeitado em vez de inventar saídas',()=>{
 assert.throws(()=>analyze(normalize(samples([['09:00:00',true],['12:00:00',true]])),{...params,positionPairing:'consecutive'}),/substituído/);
});
test('visitas Google permanecem no suporte, separadas da apuração espacial',()=>{
 const data=normalize({semanticSegments:[{startTime:'2025-09-08T08:00:00-03:00',endTime:'2025-09-08T17:00:00-03:00',visit:{topCandidate:{placeLocation:{latLng:'-23,-46'}}}}]});const spatial=analyze(data,params);assert.equal(spatial.days[0].semanticPeriods.length,1);assert.equal(spatial.days[0].durationMs,null);assert.equal(spatial.records.length,1);assert.equal(analyze(data,{...params,positionPairing:'none'}).days[0].durationMs,9*3600000);
});
test('posição externa anterior ao período pode apoiar chegada, com duração recortada ao dia',()=>{
 const data=normalize({rawSignals:[['2025-09-07T23:59:00-03:00',false],['2025-09-08T00:03:00-03:00',true],['2025-09-08T00:05:00-03:00',true],['2025-09-08T00:07:00-03:00',false]].map(([timestamp,inside])=>({position:{LatLng:inside?'-23,-46':'-23.003,-46',timestamp}}))});const report=analyze(data,params);assert.equal(report.days[0].durationMinMs,2*60000);assert.equal(report.days[0].durationMaxMs,7*60000);assert.equal(report.diagnostics.positionsInPeriod,3);assert.ok(report.points.some(p=>p.context));
});
test('retorno após ponto externo forma nova sessão e preserva referências de todos os limites',()=>{
 const report=analyze(normalize(samples([['08:55:00',false],['09:00:00',true],['09:10:00',true],['09:15:00',false],['09:20:00',true],['09:25:00',false]])),params),day=dailyRows(report)[0];assert.equal(day.visits.length,2);assert.equal(day.durationMinMs,10*60000);assert.equal(day.durationMaxMs,30*60000);assert.equal(report.days[0].spatialPeriods[0].sourceRefs.length,4);assert.equal(report.days[0].spatialPeriods[1].sourceRefs.length,3);
});
