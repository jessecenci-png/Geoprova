import {displayDate,displayMonth,toMinute} from './dates.js';
import {dailyRows,groupedReportRows,timePairCount,periodTotals,totalNotes} from './presentation.js';
import {sha256,CLEAN,dayAt} from './analysis.js';
export const alertText = alerts=>alerts?.length?'* '+alerts.map(a=>`${a.kind}: ${a.reason}`).join(' | '):CLEAN;
export function userAlertText(alerts){
  return (alerts||[]).map(a=>{
    if(a.kind==='Possível intervenção manual')return 'Possível alteração do registro.';
    if(a.kind==='Fundamento adicional')return '';
    if(a.kind.startsWith('Intervalo sem classificação'))return 'Possível remoção do registro.';
    if(a.reason.startsWith('Fim do último segmento'))return 'Último registro do arquivo: o horário final não confirma uma saída.';
    if(a.reason.includes('se sobrepõem'))return 'Há horários sobrepostos; o total conta o período apenas uma vez.';
    if(a.reason.startsWith('Margem de precisão'))return 'A margem de precisão alcança fora da área selecionada.';
    if(a.reason.startsWith('Precisão espacial informada'))return 'Precisão de localização abaixo do limite definido na análise.';
    if(a.reason.startsWith('Deslocamento entre'))return 'Deslocamento acima do limite definido na análise.';
    return `${a.kind}: ${a.reason}`;
  }).filter(Boolean).filter((text,index,all)=>all.indexOf(text)===index).join(' ');
}
export function download(bytes,name,type='application/octet-stream') { const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
export function portable(result,acquisition) {
  const {days,params}=result;
  const refs=new Set(days.flatMap(d=>d.refs));
  const records=result.records.filter(r=>refs.has(r.ref)||r.type==='Sem classificação'&&r.alerts.length).map(({original,...r})=>r);
  const points=result.points.map(({original,...p})=>p);
  return {...result,records,points,totals:periodTotals(result),acquisition};
}
export async function workbook(report) {
  const {default:ExcelJS}=await import('exceljs');
  const book=new ExcelJS.Workbook();book.creator='Geoprova';
  function sheet(name,cols,rows) {
    const s=book.addWorksheet(name);s.columns=cols.map(([header,key,width=25])=>({header,key,width}));s.addRows(rows);
    s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF163C3A'}};
    s.views=[{state:'frozen',ySplit:1}];s.autoFilter={from:'A1',to:{row:1,column:cols.length}};
    s.eachRow((row,i)=>{if(i>1){row.alignment={vertical:'top',wrapText:true};const index=cols.findIndex(c=>c[1]==='alerts');if(index>=0&&String(row.getCell(index+1).value||'').startsWith('*')) row.font={color:{argb:'FF9C3500'}};}});
    return s;
  }
  const zone=report.params.zone;
  // Spreadsheet serial dates represent wall time in the explicitly recorded presentation zone.
  function wall(t) { if(t==null)return null;t=toMinute(t);const p=new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(t);return new Date(p.replace(' ','T')+'Z'); }
  sheet('Metodologia e integridade',[['Campo','key',35],['Valor','value',130]],Object.entries({identificador:report.id,versao:report.appVersion,regras:report.rulesVersion,periodo:`${displayDate(report.params.from)} a ${displayDate(report.params.to)} (inclusive)`,fuso:zone,parametros:report.params,aquisicao:report.acquisition,cobertura:report.coverage,diagnostico:report.diagnostics,leituraDosHorarios:'Chegada e saída: limites originais das visitas da Linha do Tempo. Cada dia ocupa uma linha, com pares Entrada/Saída numerados para cada retorno. Os segundos são descartados em cada horário antes do cálculo; os originais completos permanecem nos registros de suporte. Posições sem visita são listadas uma vez na coluna Posições registradas; não determinam chegada/saída nem duração contínua. Fim do último segmento não comprova saída. Permanência por linha: parcela do dia/período. Totais semanais (segunda a domingo) e mensais usam união dos intervalos para evitar dupla contagem. Precisão da visita e das posições de apoio são distintas; não usar probabilidade como metros. Dias não apuráveis não se tornam zero.',legenda:'* alerta individual; probabilidade semântica não é precisão espacial; vazio na duração significa não apurável',limitacoes:report.limitations,assinatura:'Documento sem mecanismo de verificação de origem. Manifesto de hashes verifica identidade, não autoria.'}).map(([key,value])=>({key,value:typeof value==='string'?value:JSON.stringify(value)})));
  book.getWorksheet('Metodologia e integridade').state='hidden';
  const pairs=timePairCount(report);
  const days=dailyRows(report),hasVisits=days.some(day=>day.visits.length),hasPositions=days.some(day=>day.positionTimes.length);
  const positionTime=new Intl.DateTimeFormat('pt-BR',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
  const columns=[['Data / semana','day',32],['Dia da semana','weekday',20],...(hasVisits?Array.from({length:pairs},(_,i)=>[[`Entrada ${i+1}`,`arrival${i}`,24],[`Saída ${i+1}`,`departure${i}`,24]]).flat():[]),...(hasPositions?[['Posições registradas','positions',55]]:[]),['Total diário','duration',24],['Alertas / cobertura','alerts',90]];
  const daily=sheet('Resumo diário',columns,groupedReportRows(report).map(row=>{
    if(row.type==='week')return {day:`Total semana ${displayDate(row.from)} a ${displayDate(row.to)}`,duration:row.durationMs==null?null:row.durationMs/86400000,alerts:totalNotes(row)};
    const values={day:new Date(row.day+'T00:00:00Z'),weekday:row.weekday,positions:row.positionTimes.map(t=>positionTime.format(t)).join(' · '),duration:row.durationMs==null?null:row.durationMs/86400000,alerts:row.intervals.length?row.intervals.map((interval,i)=>[interval.positionOnly?'Posições isoladas: permanência não apurável':'',interval.alerts.length?userAlertText(interval.alerts):''].filter(Boolean).join('. ')).filter(Boolean).join(' | '):row.alerts.length?userAlertText(row.alerts):row.status};
    row.visits.forEach((interval,i)=>{values[`arrival${i}`]=wall(interval.arrival);values[`departure${i}`]=wall(interval.departure);});return values;
  }));
  daily.getColumn('day').numFmt='dd-mm-yyyy';if(hasVisits)for(let i=0;i<pairs;i++)daily.getColumn(`arrival${i}`).numFmt=daily.getColumn(`departure${i}`).numFmt='dd-mm-yyyy hh:mm';daily.getColumn('duration').numFmt='[h]:mm';
  const weekly=sheet('Totais semanais',[['Semana inicial','from',18],['Semana final','to',18],['Permanência total','duration',25],['Cobertura','notes',90]],periodTotals(report).weeks.map(week=>({from:new Date(week.from+'T00:00:00Z'),to:new Date(week.to+'T00:00:00Z'),duration:week.durationMs==null?null:week.durationMs/86400000,notes:totalNotes(week)})));weekly.getColumn('from').numFmt=weekly.getColumn('to').numFmt='dd-mm-yyyy';weekly.getColumn('duration').numFmt='[h]:mm';
  const monthly=sheet('Totais mensais',[['Mês','month',18],['Permanência total','duration',25],['Cobertura','notes',90]],periodTotals(report).months.map(month=>({month:displayMonth(month.key),duration:month.durationMs==null?null:month.durationMs/86400000,notes:totalNotes(month)})));monthly.getColumn('duration').numFmt='[h]:mm';
  sheet('Informações do relatório',[['Informação','key',30],['Descrição','value',100]],[{key:'Local',value:report.params.area.label||'Local selecionado'},{key:'Período',value:`${displayDate(report.params.from)} a ${displayDate(report.params.to)}`},{key:'Raio',value:`${report.params.area.radius} m`},{key:'Fuso horário',value:report.params.zone},{key:'Arquivo de origem',value:report.acquisition?.name||'Não informado'},{key:'SHA-256 do arquivo',value:report.acquisition?.sha256||'Não informado'},{key:'Leitura dos horários',value:'Horários sem segundos. Cada dia reúne seus intervalos de entrada e saída. Posições sem visita são identificadas nas notas e não determinam permanência contínua.'},{key:'Totais',value:'União dos intervalos apurados, sem duplicar sobreposições. Dias sem dados não comprovam ausência. Presença no local não equivale a tempo de trabalho.'}]);
  const entries=sheet('Entradas e saídas',[['Fonte','ref',40],['Natureza','kind',48],['Início','start',24],['Fim','end',24],['Duração do intervalo','duration',22],['Início original ISO','originalStart',32],['Fim original ISO','originalEnd',32],['Alertas','alerts',80]],[
    ...report.days.flatMap(d=>d.periods.map(p=>({ref:p.ref,kind:'Visita Google; recortada ao período/dia',durationMs:toMinute(p.end)-toMinute(p.start),start:wall(p.start),end:wall(p.end),originalStart:new Date(p.originalStart).toISOString(),originalEnd:new Date(p.originalEnd).toISOString(),alerts:alertText(p.alerts)}))),
    ...report.observations.flatMap(o=>[{ref:o.ref,kind:'Posição registrada dentro da área',start:wall(o.time),end:null,alerts:alertText(o.alerts)},...['arrival','departure'].filter(k=>o[k]).map(k=>({ref:o.ref,kind:k==='arrival'?'Intervalo estimado de chegada':'Intervalo estimado de saída',durationMs:toMinute(o[k][1])-toMinute(o[k][0]),start:wall(o[k][0]),end:wall(o[k][1]),alerts:alertText(o.alerts)}))]),
    ...report.records.filter(r=>r.type==='Sem classificação').map(r=>({ref:r.ref,kind:r.type,durationMs:r.start!=null&&r.end>=r.start?toMinute(r.end)-toMinute(r.start):null,start:wall(r.start),end:wall(r.end),alerts:alertText(r.alerts)}))].map(row=>({...row,duration:row.durationMs==null?null:row.durationMs/86400000})));
  entries.getColumn('duration').numFmt='[h]:mm';
  entries.getColumn('start').numFmt=entries.getColumn('end').numFmt='dd-mm-yyyy hh:mm';
  entries.state='hidden';
  sheet('Registros de suporte',[['Referência JSON','ref',45],['Dados usados (JSON)','data',120],['Alertas','alerts',90]],[...report.records,...report.points].map(r=>({ref:r.ref,data:JSON.stringify(r),alerts:alertText(r.alerts)})));

  book.getWorksheet('Registros de suporte').state='hidden';
  const order=['Resumo diário','Totais semanais','Totais mensais','Informações do relatório','Entradas e saídas','Metodologia e integridade','Registros de suporte'];
  order.forEach((name,index)=>{book.getWorksheet(name).orderNo=index;});
  book.views=[{activeTab:0}];
  return new Uint8Array(await book.xlsx.writeBuffer());
}
export async function exportBundle(report) {
  const json=new TextEncoder().encode(JSON.stringify(report,null,2));
  const xlsx=await workbook(report);
  const files=[{name:`geoprova-${report.id}.json`,bytes:json,type:'application/json'},{name:`geoprova-${report.id}.xlsx`,bytes:xlsx,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}];
  const manifest={id:report.id,algorithm:'SHA-256',notice:'Hashes não comprovam autoria. Manifesto separado, sem autorreferência.',files:await Promise.all(files.map(async f=>({name:f.name,size:f.bytes.length,sha256:await sha256(f.bytes)})))};
  files.forEach(f=>download(f.bytes,f.name,f.type));download(JSON.stringify(manifest,null,2),`geoprova-${report.id}-manifesto.json`,'application/json');
}
