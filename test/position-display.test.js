import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {analyze,normalize} from '../src/analysis.js';
import {dailyRows,timePairCount,periodTotals} from '../src/presentation.js';
import {workbook,userAlertText} from '../src/export.js';
const params={from:'2025-09-08',to:'2025-09-08',zone:'America/Sao_Paulo',confirmed:true,area:{lat:-23,lon:-46,radius:100},maxAccuracy:100,maxGapMinutes:30,maxSpeed:100};
test('pontos isolados não duplicam horários nem criam novos pares entrada/saída',async()=>{
 const rawSignals=['09:43:05','09:43:40','12:26:00','14:35:00','15:24:00'].map(t=>({position:{LatLng:'-23,-46',timestamp:`2025-09-08T${t}-03:00`}}));
 const report=analyze(normalize({rawSignals}),params),day=dailyRows(report)[0];assert.equal(day.visits.length,0);assert.equal(day.positionTimes.length,4);assert.equal(timePairCount(report),2);assert.equal(day.durationMs,null);assert.equal(periodTotals(report).weeks[0].durationMs,null);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await workbook(report));const sheet=book.getWorksheet('Resumo diário');assert.equal(sheet.getCell('C2').value,'09:43 · 12:26 · 14:35 · 15:24');assert.equal(sheet.getCell('D2').value,null);assert.equal(book.getWorksheet('Totais semanais').getCell('C2').value,null);
});
test('rótulos de alerta são curtos e não excluem o fundamento técnico',()=>{
 assert.equal(userAlertText([{kind:'Possível intervenção manual',reason:'visit.isTimelessVisit: false'},{kind:'Fundamento adicional',reason:'probabilidade zero'}]),'Possível alteração do registro.');
 assert.equal(userAlertText([{kind:'Intervalo sem classificação — possível remoção de registro',reason:'Segmento somente com horários'}]),'Possível remoção do registro.');
});
test('totais diário, semanal e mensal permanecem somando os intervalos apuráveis',async()=>{
 const semanticSegments=[['08:00:00','12:00:00'],['13:00:00','17:00:00']].map(([a,b])=>({startTime:`2025-09-08T${a}-03:00`,endTime:`2025-09-08T${b}-03:00`,visit:{topCandidate:{placeLocation:{latLng:'-23,-46'}}}}));
 const report=analyze(normalize({semanticSegments}),params);assert.equal(dailyRows(report)[0].durationMs,8*3600000);assert.equal(periodTotals(report).weeks[0].durationMs,8*3600000);assert.equal(periodTotals(report).months[0].durationMs,8*3600000);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await workbook(report));assert.equal(book.getWorksheet('Totais semanais').state,'hidden');assert.equal(book.getWorksheet('Totais mensais').state,'visible');assert.equal(book.getWorksheet('Totais semanais').getCell('C2').value.getUTCHours(),8);
});
