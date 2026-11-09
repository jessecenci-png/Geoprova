import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {displayDate,displayMonth,parseDateInput,displayTimestamp} from '../src/dates.js';
import {normalize,analyze} from '../src/analysis.js';
import {workbook} from '../src/export.js';
test('DD-MM-AAAA na apresentação e entrada sem inverter dia e mês',()=>{
 assert.equal(displayDate('2026-11-09'),'09-11-2026');assert.equal(parseDateInput('09-11-2026'),'2026-11-09');assert.equal(parseDateInput('29-02-2024'),'2024-02-29');assert.equal(displayMonth('2026-11'),'11-2026');for(const value of ['31-02-2026','29-02-2026','11/09/2026','2026-11-09','09-13-2026'])assert.throws(()=>parseDateInput(value));assert.match(displayTimestamp(Date.parse('2026-11-09T02:00:00Z'),'America/Sao_Paulo'),/^08-11-2026 23:00:00/);
});
test('XLSX preserva posições sem visita em colunas próprias e usa data brasileira',async()=>{
 const report=analyze(normalize({rawSignals:[{position:{LatLng:'-23,-46',timestamp:'2026-11-09T09:00:00-03:00'}},{position:{LatLng:'-23,-46',timestamp:'2026-11-09T09:10:00-03:00'}}]}),{from:'2026-11-09',to:'2026-11-09',zone:'America/Sao_Paulo',confirmed:true,area:{lat:-23,lon:-46,radius:20},maxAccuracy:100,maxGapMinutes:30,maxSpeed:100});
 const book=new ExcelJS.Workbook();await book.xlsx.load(await workbook(report));const sheet=book.getWorksheet('Resumo diário');assert.equal(sheet.getCell('A2').numFmt,'dd-mm-yyyy');assert.equal(sheet.getCell('B2').value,'segunda-feira');assert.equal(sheet.getCell('C2').value,'09:00 · 09:10');assert.equal(sheet.getCell('D2').value,null);assert.match(sheet.getCell('E2').value,/permanência não apurável/);assert.deepEqual(sheet.getRow(1).values.slice(1),['Data / semana','Dia da semana','Posições registradas','Total diário','Alertas / cobertura']);
});
