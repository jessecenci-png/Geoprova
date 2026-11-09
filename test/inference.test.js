import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {normalize,analyze} from '../src/analysis.js';
import {dailyRows,periodTotals,totalDurationText} from '../src/presentation.js';
import {workbook,portable} from '../src/export.js';
const params={from:'2025-08-13',to:'2025-08-13',zone:'America/Sao_Paulo',confirmed:true,area:{lat:-23,lon:-46,radius:100},maxAccuracy:100,maxGapMinutes:30,maxSpeed:100,positionPairing:'hybrid'};
const at=t=>Date.parse(`2025-08-13T${t}-03:00`);
const positions=times=>times.map(t=>({position:{LatLng:'-23,-46',timestamp:`2025-08-13T${t}-03:00`}}));
const movement={startTime:'2025-08-13T11:34:05-03:00',endTime:'2025-08-13T12:00:00-03:00',activity:{topCandidate:{type:'IN_PASSENGER_VEHICLE'}}};
test('visita 08:56–11:34 prevalece; deslocamento segundos depois e pontos avulsos não estendem nem antecipam visita',async()=>{
 const json={semanticSegments:[{startTime:'2025-08-13T08:56:00-03:00',endTime:'2025-08-13T11:34:00-03:00',visit:{topCandidate:{placeLocation:{latLng:'-23,-46'}}}},movement],rawSignals:positions(['08:36:00','08:56:12','11:35:00'])},original=JSON.stringify(json);
 const report=analyze(normalize(json),params),day=dailyRows(report)[0];assert.equal(day.visits.length,1);assert.equal(day.visits[0].arrival,at('08:56:00'));assert.equal(day.visits[0].departure,at('11:34:00'));assert.equal(day.visits[0].approximate,true);assert.deepEqual(day.visits[0].movementRefs,['semanticSegments[1]']);assert.equal(day.positionTimes.length,0);assert.equal(day.durationMs,158*60000);assert.equal(totalDurationText(day),'2h 38min 00s');assert.equal(JSON.stringify(json),original);assert.ok(portable(report,{}).records.some(r=>r.ref==='semanticSegments[1]'&&r.activityType==='IN_PASSENGER_VEHICLE'));
 const book=new ExcelJS.Workbook();await book.xlsx.load(await workbook(portable(report,{})));const sheet=book.getWorksheet('Resumo diário');assert.equal(sheet.getCell('C2').numFmt,'dd-mm-yyyy hh:mm:ss');assert.equal(sheet.getCell('D2').value.getUTCMinutes(),34);assert.equal(sheet.getCell('G2').numFmt,'[h]:mm:ss');assert.match(sheet.getCell('H2').value,/Horários da visita/);
 assert.deepEqual(portable(report,{}),portable(analyze(normalize(json),params),{}));
});
test('lacuna de muitas horas não separa permanência presumida no mesmo local e dia',()=>{
 const report=analyze(normalize({rawSignals:positions(['08:37:13','11:52:49'])}),params),day=dailyRows(report)[0];assert.equal(day.visits.length,1);assert.equal(day.visits[0].arrival,at('08:37:13'));assert.equal(day.visits[0].departure,at('11:52:49'));assert.equal(day.durationMs,11736000);assert.equal(totalDurationText(day),'3h 15min 36s');assert.equal(report.days[0].inferredPeriods[0].continuityAssumed,true);assert.equal(periodTotals(report).weeks[0].durationMs,11736000);
});
test('ponto externo confirmado separa saída/retorno; não há pareamento cego de pontos internos',()=>{
 const rawSignals=[...positions(['08:00:00','09:00:00']),{position:{LatLng:'-23.003,-46',timestamp:'2025-08-13T10:00:00-03:00'}},...positions(['11:00:00','12:00:00'])];
 const day=dailyRows(analyze(normalize({rawSignals}),params))[0];assert.equal(day.visits.length,2);assert.equal(day.durationMs,2*3600000);assert.equal(day.visits[0].departure,at('09:00:00'));assert.equal(day.visits[1].arrival,at('11:00:00'));
});
test('um único ponto não recebe uma saída inventada nem duração zero',()=>{
 const day=dailyRows(analyze(normalize({rawSignals:positions(['09:00:32'])}),params))[0];assert.equal(day.visits[0].arrival,at('09:00:32'));assert.equal(day.visits[0].departure,null);assert.equal(day.durationMs,null);
});
test('posições durante atividade de direção não prolongam a permanência inferida',()=>{
 const day=dailyRows(analyze(normalize({semanticSegments:[movement],rawSignals:positions(['08:56:00','11:33:50','11:35:00'])}),params))[0];assert.equal(day.visits.length,1);assert.equal(day.visits[0].departure,at('11:33:50'));assert.equal(day.positionTimes.length,0);
});
test('fuga nominal da área dentro da margem de precisão não basta para separar o grupo',()=>{
 const report=analyze(normalize({rawSignals:[...positions(['08:00:00','09:00:00']),{position:{LatLng:'-23.001,-46',timestamp:'2025-08-13T09:30:00-03:00',accuracyMeters:50}},...positions(['10:00:00'])]}),params);
 assert.equal(dailyRows(report)[0].visits.length,1);assert.equal(report.days[0].inferredPeriods[0].sourceRefs.length,4);assert.ok(report.days[0].inferredPeriods[0].alerts.length>0);
});
