import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {normalize,analyze,sha256,midnight,dayAt,inside,coordinates} from '../src/analysis.js';
import {portable,workbook} from '../src/export.js';
const params={from:'2026-01-02',to:'2026-01-02',zone:'America/Sao_Paulo',confirmed:true,area:{lat:-23,lon:-46,radius:100},maxAccuracy:100,maxGapMinutes:30,maxSpeed:100};
const visit=(start='2026-01-02T08:00:00-03:00',end='2026-01-02T12:00:00-03:00',extra={})=>({startTime:start,endTime:end,visit:{probability:.8,topCandidate:{placeLocation:{latLng:'-23,-46'},probability:.9,semanticType:'WORK'},...extra}});
test('coordenadas Android com graus antes da vírgula não são descartadas',()=>{
  for(const value of ['-23°, -46°','geo:-23,-46',' -23.0000°, -46.0000° ','-23º, -46º'])assert.deepEqual(coordinates(value),{lat:-23,lon:-46});
  assert.deepEqual(coordinates({lat:-23,lng:-46}),{lat:-23,lon:-46});
  for(const value of ['91°, 0°','Rua 23, 46','-23° -46°'])assert.equal(coordinates(value),null);
});
test('exportação com graus produz visita, posições e trajetos dentro de raio de 20 m',()=>{
  const json={semanticSegments:[visit(undefined,undefined,{topCandidate:{placeLocation:{latLng:'-23°, -46°'}}}),{startTime:'2026-01-02T09:00:00-03:00',endTime:'2026-01-02T10:00:00-03:00',timelinePath:[{point:'-23.00001°, -46.00001°',durationMinutesOffsetFromStartTime:10}]}],rawSignals:[{position:{LatLng:'-23.00001°, -46.00001°',timestamp:'2026-01-02T09:00:00-03:00'}}]};
  const data=normalize(json),r=analyze(data,{...params,area:{...params.area,radius:20}});
  assert.equal(data.parsing.visitsWithoutCoordinates,0);assert.equal(r.diagnostics.visitsInArea,1);assert.equal(r.observations.length,2);assert.equal(r.days[0].durationMs,4*3600000);assert.equal(r.diagnostics.nearestVisitMeters,0);
});
test('diagnóstico distingue coordenadas ilegíveis de ponto fora do raio sem ampliar área',()=>{
  const json={semanticSegments:[visit(undefined,undefined,{topCandidate:{placeLocation:{latLng:'formato desconhecido'}}}),visit(undefined,undefined,{topCandidate:{placeLocation:{latLng:'-23.0005°, -46°'}}})]};
  const r=analyze(normalize(json),{...params,area:{...params.area,radius:20}});
  assert.equal(r.diagnostics.parsing.visitsWithoutCoordinates,1);assert.equal(r.diagnostics.visitsWithCoordinatesInPeriod,1);assert.equal(r.diagnostics.visitsInArea,0);assert.ok(r.diagnostics.nearestVisitMeters>50);assert.equal(r.days[0].durationMs,null);assert.equal(r.params.area.radius,20);
});
test('manual experimental: false presente, probabilidade zero opcional, campo ausente distinto',()=>{
  const rows=normalize({semanticSegments:[visit(undefined,undefined,{isTimelessVisit:false}),visit(),visit(undefined,undefined,{isTimelessVisit:true}),visit(undefined,undefined,{isTimelessVisit:false,topCandidate:{probability:0}})]}).records;
  assert.equal(rows[0].alerts.length,1);assert.equal(rows[1].alerts.length,0);assert.equal(rows[2].alerts.length,0);assert.equal(rows[3].alerts.length,2);
});
test('remoção preserva intervalo e aproveita posições brutas e trajetos',()=>{
  const data=normalize({semanticSegments:[{startTime:'2026-01-02T08:00:00-03:00',endTime:'2026-01-02T09:00:00-03:00'},{startTime:'2026-01-02T08:00:00-03:00',endTime:'2026-01-02T09:00:00-03:00',timelinePath:[{point:'geo:-23,-46',durationMinutesOffsetFromStartTime:10}]}],rawSignals:[{position:{LatLng:'-23,-46',timestamp:'2026-01-02T09:00:00-03:00',accuracyMeters:20}}]});
  const r=analyze(data,params);assert.match(r.records[0].alerts[0].kind,/possível remoção/);assert.equal(r.observations.length,2);assert.equal(r.days[0].durationMs,null);assert.equal(r.points[1].accuracy,20);assert.ok(r.days[0].alerts.length);
});
test('meia-noite, recorte inclusivo e sobreposição não duplicam duração',()=>{
  const data=normalize({semanticSegments:[visit('2026-01-01T23:00:00-03:00','2026-01-02T02:00:00-03:00'),visit('2026-01-02T01:00:00-03:00','2026-01-02T03:00:00-03:00')]});
  const d=analyze(data,params).days[0];assert.equal(d.durationMs,3*3600000);assert.equal(d.periods.length,2);assert.equal(d.periods[0].originalStart,Date.parse('2026-01-01T23:00:00-03:00'));assert.ok(d.alerts.some(a=>/sobrepõem/.test(a.reason)));
});
test('sem dados não gera duração zero ou ausência',()=>{
  const d=analyze(normalize({userLocationProfile:{}}),params).days[0];assert.equal(d.durationMs,null);assert.equal(d.status,'Sem registros disponíveis');
});
test('posições isoladas não geram permanência; transições geram intervalos',()=>{
  const rawSignals=[['08:00','-23.01,-46'],['08:10','-23,-46'],['08:20','-23.01,-46']].map(([t,LatLng])=>({position:{LatLng,timestamp:`2026-01-02T${t}:00-03:00`}}));
  const r=analyze(normalize({rawSignals}),params);assert.equal(r.days[0].durationMs,null);assert.equal(r.observations[0].arrival.length,2);assert.equal(r.observations[0].departure.length,2);assert.equal(r.points.find(p=>p.within).accuracy,null);
});
test('fuso de apresentação e horário de verão',()=>{
  assert.equal(new Date(midnight('2026-01-02','America/Sao_Paulo')).toISOString(),'2026-01-02T03:00:00.000Z');
  assert.equal(dayAt(Date.parse('2026-01-02T01:00:00Z'),'America/Sao_Paulo'),'2026-01-01');
  assert.equal(midnight('2026-03-09','America/New_York')-midnight('2026-03-08','America/New_York'),23*3600000);
});
test('hash usa bytes exatos; reformatar JSON muda hash',async()=>{
  assert.notEqual(await sha256(new TextEncoder().encode('{"a":1}')),await sha256(new TextEncoder().encode('{ "a": 1 }')));
});
test('exportação XLSX contém valores de data/duração e alertas; reprodução determinística',async()=>{
  const data=normalize({semanticSegments:[visit(undefined,undefined,{isTimelessVisit:false})]});
  const a=portable(analyze(data,params),{sha256:'test'}),b=portable(analyze(data,params),{sha256:'test'});assert.deepEqual(a,b);
  const bytes=await workbook({...a,id:'test'});const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
  assert.equal(book.worksheets.length,7);assert.equal(book.worksheets[0].name,'Resumo diário');
  const daily=book.getWorksheet('Resumo diário');assert.deepEqual(daily.getRow(1).values.slice(1),['Data / semana','Dia da semana','Entrada 1','Saída 1','Entrada 2','Saída 2','Total do dia','Alertas / cobertura']);assert.ok(daily.getCell('A2').value instanceof Date);assert.equal(daily.getCell('C2').value.getUTCHours(),8);assert.equal(daily.getCell('D2').value.getUTCHours(),12);assert.match(daily.getCell('H2').value,/Possível alteração do registro/);
  const duration=book.getWorksheet('Entradas e saídas').getCell('E2');assert.equal(duration.numFmt,'[h]:mm');assert.equal(duration.value.getUTCHours(),4);
});
test('exportação omite locais pessoais e campos desconhecidos permanecem na fonte',()=>{
  const personal=visit();personal.visit.topCandidate.placeLocation={latLng:'0,0'};personal.privateUnknown='preservado';const json={semanticSegments:[visit(),personal]};const data=normalize(json);const p=portable(analyze(data,params),{});assert.equal(p.records.length,1);assert.equal(data.records[1].original.privateUnknown,'preservado');assert.ok(!JSON.stringify(p).includes('privateUnknown'));
});
test('perímetro e confirmação obrigatória',()=>{
  assert.equal(inside({lat:0,lon:0},{polygon:[{lat:-1,lon:-1},{lat:1,lon:-1},{lat:0,lon:1}]}),true);assert.throws(()=>analyze(normalize({}),{...params,confirmed:false}),/Confirme/);
});
