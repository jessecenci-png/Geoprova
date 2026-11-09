import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {normalize,analyze} from '../src/analysis.js';
import {dailyRows,groupedReportRows,periodTotals,timePairCount,durationText} from '../src/presentation.js';
import {workbook} from '../src/export.js';
const params={from:'2026-11-09',to:'2026-11-09',zone:'America/Sao_Paulo',confirmed:true,area:{lat:-23,lon:-46,radius:50},maxAccuracy:100,maxGapMinutes:30,maxSpeed:100};
const segment=(start,end)=>({startTime:`2026-11-09T${start}-03:00`,endTime:`2026-11-09T${end}-03:00`,visit:{topCandidate:{placeLocation:{latLng:'-23,-46'}}}});
test('dois intervalos: uma linha diária, dia da semana e quatro células de horário',async()=>{
 const report=analyze(normalize({semanticSegments:[segment('08:44:59','11:41:01'),segment('12:20:59','17:00:01')]}),params);
 const days=dailyRows(report);assert.equal(days.length,1);assert.equal(days[0].weekday,'segunda-feira');assert.equal(days[0].intervals.length,2);assert.equal(groupedReportRows(report).filter(r=>r.type==='day').length,1);assert.equal(timePairCount(report),2);
 assert.equal(days[0].durationMs,457*60000);assert.equal(periodTotals(report).weeks[0].durationMs,457*60000);assert.equal(durationText(days[0].durationMs),'7h 37min');
 const book=new ExcelJS.Workbook();await book.xlsx.load(await workbook(report));const s=book.getWorksheet('Resumo diário');assert.equal(s.rowCount,3);assert.deepEqual(s.getRow(1).values.slice(1),['Data / semana','Dia da semana','Entrada 1','Saída 1','Entrada 2','Saída 2','Permanência','Alertas / cobertura']);
 for(const column of ['C','D','E','F']){assert.equal(s.getCell(column+'2').value.getUTCSeconds(),0);assert.equal(s.getCell(column+'2').numFmt,'dd-mm-yyyy hh:mm');}assert.equal(s.getCell('C2').value.getUTCMinutes(),44);assert.equal(s.getCell('F2').value.getUTCHours(),17);assert.equal(s.getCell('G2').numFmt,'[h]:mm');
 assert.equal(report.records[0].original.startTime,'2026-11-09T08:44:59-03:00');
});
test('mais de dois intervalos acrescenta pares sem perder retornos nem alertas',()=>{
 const third=segment('17:30:00','18:00:00');third.visit.isTimelessVisit=false;
 const report=analyze(normalize({semanticSegments:[segment('08:00:00','12:00:00'),segment('13:00:00','17:00:00'),third]}),params);
 assert.equal(dailyRows(report)[0].intervals.length,3);assert.equal(timePairCount(report),3);assert.ok(dailyRows(report)[0].intervals[2].alerts.some(a=>a.kind==='Possível intervenção manual'));
});
test('intervalos de posições continuam identificados e não viram permanência diária',()=>{
 const report=analyze(normalize({rawSignals:['09:00:45','09:10:22','14:00:22'].map(t=>({position:{LatLng:'-23,-46',timestamp:`2026-11-09T${t}-03:00`}}))}),params);
 assert.equal(dailyRows(report).length,1);assert.equal(dailyRows(report)[0].intervals.length,2);assert.equal(dailyRows(report)[0].durationMs,null);assert.ok(dailyRows(report)[0].intervals.every(r=>r.positionOnly));
});
