import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,normalize} from '../src/analysis.js';
import {summaryRows,periodTotals,reportRows,accuracyText,weekStart} from '../src/presentation.js';
import {workbook} from '../src/export.js';
import ExcelJS from 'exceljs';
const params={from:'2026-08-31',to:'2026-09-01',zone:'America/Sao_Paulo',confirmed:true,area:{lat:-23,lon:-46,radius:20},maxAccuracy:100,maxGapMinutes:30,maxSpeed:100};
const visit=(day,a,b,accuracy)=>({startTime:`${day}T${a}-03:00`,endTime:`${day}T${b}-03:00`,visit:{topCandidate:{probability:.99,placeLocation:{latLng:'-23°, -46°',...(accuracy!=null?{accuracyMeters:accuracy}:{})}}}});
test('semanas segunda–domingo; mês e semana não duplicam períodos sobrepostos',()=>{
 const report=analyze(normalize({semanticSegments:[visit('2026-08-31','08:00:00','12:00:00'),visit('2026-08-31','10:00:00','14:00:00'),visit('2026-09-01','08:00:00','10:00:00')]}),params);
 const totals=periodTotals(report);assert.equal(weekStart('2026-08-30'),'2026-08-24');assert.equal(totals.weeks.length,1);assert.equal(totals.weeks[0].durationMs,8*3600000);assert.deepEqual(totals.months.map(m=>m.durationMs),[6*3600000,2*3600000]);assert.equal(summaryRows(report).length,3);assert.equal(reportRows(report).filter(r=>r.type==='week').length,1);assert.equal(totals.weeks[0].partial,true);
});
test('visita atravessando meia-noite e domingo/segunda reparte duração corretamente',()=>{
 const segment=visit('2026-08-30','23:00:00','23:30:00');segment.endTime='2026-08-31T01:00:00-03:00';
 const report=analyze(normalize({semanticSegments:[segment]}),{...params,from:'2026-08-30',to:'2026-08-31'});
 assert.deepEqual(periodTotals(report).weeks.map(w=>w.durationMs),[3600000,3600000]);assert.deepEqual(summaryRows(report).map(r=>r.durationMs),[3600000,3600000]);
 const clipped=analyze(normalize({semanticSegments:[segment]}),{...params,from:'2026-08-31',to:'2026-08-31'});assert.equal(periodTotals(clipped).months[0].durationMs,3600000);
});
test('precisão explícita não é probabilidade; posições de apoio têm identificação própria',()=>{
 const report=analyze(normalize({semanticSegments:[visit('2026-08-31','08:00:00','12:00:00'),visit('2026-09-01','08:00:00','10:00:00',8)],rawSignals:[10,30].map((accuracyMeters,i)=>({position:{LatLng:'-23,-46',timestamp:`2026-08-31T09:0${i}:00-03:00`,accuracyMeters}}))}),params);
 const rows=summaryRows(report);assert.equal(rows[0].accuracy,null);assert.match(accuracyText(rows[0]),/Visita: não informada; posições de apoio: 10–30 m/);assert.equal(rows[1].accuracy,8);assert.equal(rows[1].supportAccuracy,null);assert.equal(rows[0].durationMs,4*3600000);
});
test('semanas sem duração apurável continuam nulas e não viram zero',()=>{
 const report=analyze(normalize({}),params);const totals=periodTotals(report);assert.equal(totals.weeks[0].durationMs,null);assert.equal(totals.weeks[0].unquantifiableDays,2);assert.equal(totals.months[0].durationMs,null);
});
test('total semanal suporta mais de 24 horas',()=>{
 const semanticSegments=Array.from({length:5},(_,i)=>visit(`2026-08-${String(24+i)}`,'08:00:00','16:00:00'));
 const report=analyze(normalize({semanticSegments}),{...params,from:'2026-08-24',to:'2026-08-28'});assert.equal(periodTotals(report).weeks[0].durationMs,40*3600000);
});
test('horário de verão usa duração real de 23h, inclusive no XLSX',async()=>{
 const report=analyze(normalize({semanticSegments:[{startTime:'2026-03-08T00:00:00-05:00',endTime:'2026-03-09T00:00:00-04:00',visit:{topCandidate:{placeLocation:{latLng:'-23,-46'}}}}]}),{...params,from:'2026-03-08',to:'2026-03-08',zone:'America/New_York'});
 assert.equal(periodTotals(report).weeks[0].durationMs,23*3600000);const book=new ExcelJS.Workbook();await book.xlsx.load(await workbook(report));assert.equal(book.getWorksheet('Entradas e saídas').getCell('E2').value.getUTCHours(),23);
});
