import {displayDate,displayMonth,displayTimestamp,toMinute,ceilMinute} from './dates.js';
import {dailyRows,groupedReportRows,timePairCount,periodTotals,totalNotes,totalDurationText} from './presentation.js';
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
  sheet('Metodologia e integridade',[['Campo','key',35],['Valor','value',130]],Object.entries({identificador:report.id,versao:report.appVersion,regras:report.rulesVersion,periodo:`${displayDate(report.params.from)} a ${displayDate(report.params.to)} (inclusive)`,fuso:zone,parametros:report.params,aquisicao:report.acquisition,cobertura:report.coverage,diagnostico:report.diagnostics,leituraDosHorarios:'Chegada e saída: limites originais das visitas da Linha do Tempo. Cada dia ocupa uma linha, com pares Entrada/Saída numerados para cada retorno. Os segundos são descartados em cada horário antes do cálculo; os originais completos permanecem nos registros de suporte. No modo espacial, chegada entre posição externa anterior e primeira interna, saída entre última interna e externa seguinte. Sem ponto de apoio o limite é indeterminado. Totais são faixas estimadas, sob continuidade entre amostras com lacunas limitadas pelo parâmetro; não comprovam permanência ininterrupta. Lacunas maiores interrompem sessões. Fim do último segmento não comprova saída. Permanência por linha: parcela do dia/período. Totais semanais (segunda a domingo) e mensais usam união dos intervalos para evitar dupla contagem. Precisão da visita e das posições de apoio são distintas; não usar probabilidade como metros. Dias não apuráveis não se tornam zero.',legenda:'* alerta individual; probabilidade semântica não é precisão espacial; vazio na duração significa não apurável',limitacoes:report.limitations,assinatura:'Documento sem mecanismo de verificação de origem. Manifesto de hashes verifica identidade, não autoria.'}).map(([key,value])=>({key,value:typeof value==='string'?value:JSON.stringify(value)})));
  book.getWorksheet('Metodologia e integridade').state='hidden';
  const spatialMode=report.params.positionPairing==='spatial';
  const valueOfDuration=total=>total.spatialMode?(total.durationMinMs==null?null:total.durationMinMs===total.durationMaxMs?total.durationMinMs/86400000:totalDurationText(total)):(total.durationMs==null?null:total.durationMs/86400000);
  const timeText=(t,day)=>dayAt(t,zone)===day?new Intl.DateTimeFormat('pt-BR',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(t):displayTimestamp(t,zone).replace(/(\d{2}:\d{2}):\d{2}/,'$1');
  const spatialBoundary=(interval,kind,day)=>{const window=kind==='arrival'?interval.arrivalWindow:interval.departureWindow;if(window)return timeText(toMinute(window[0]),day)+'–'+timeText(ceilMinute(window[1]),day)+' †';return 'Não determinada ('+(kind==='arrival'?'primeira':'última')+' presença: '+timeText(kind==='arrival'?interval.firstPosition:interval.lastPosition,day)+')';};
  const pairs=timePairCount(report);
  const days=dailyRows(report),hasVisits=spatialMode||days.some(day=>day.visits.length),hasPositions=days.some(day=>day.positionTimes.length);
  const positionTime=new Intl.DateTimeFormat('pt-BR',{timeZone:zone,hour:'2-digit',minute:'2-digit'});
  const columns=[['Data / semana','day',32],['Dia da semana','weekday',20],...(hasVisits?Array.from({length:pairs},(_,i)=>[[`Entrada ${i+1}`,`arrival${i}`,24],[`Saída ${i+1}`,`departure${i}`,24]]).flat():[]),...(hasPositions?[['Posições registradas','positions',55]]:[]),['Total do dia','duration',24],['Alertas / cobertura','alerts',90],...(spatialMode?[['Duração mínima (estimada)','durationMin',25],['Duração máxima (estimada)','durationMax',25]]:[])];
  const daily=sheet('Resumo diário',columns,groupedReportRows(report).map(row=>{
    if(row.type==='week')return {day:`Total semana ${displayDate(row.from)} a ${displayDate(row.to)}`,duration:valueOfDuration(row),durationMin:row.durationMinMs==null?null:row.durationMinMs/86400000,durationMax:row.durationMaxMs==null?null:row.durationMaxMs/86400000,alerts:totalNotes(row)};
    const values={day:new Date(row.day+'T00:00:00Z'),weekday:row.weekday,positions:row.positionTimes.map(t=>positionTime.format(t)).join(' · '),duration:valueOfDuration(row),durationMin:row.durationMinMs==null?null:row.durationMinMs/86400000,durationMax:row.durationMaxMs==null?null:row.durationMaxMs/86400000,alerts:row.intervals.length?row.intervals.map((interval,i)=>[interval.spatial?'† Limites estimados por transições espaciais':interval.estimated?'† Par estimado a partir de posições':interval.positionOnly?'Posições isoladas: permanência não apurável':'',interval.alerts.length?userAlertText(interval.alerts):''].filter(Boolean).join('. ')).filter(Boolean).join(' | '):row.alerts.length?userAlertText(row.alerts):row.status};
    row.visits.forEach((interval,i)=>{values[`arrival${i}`]=interval.spatial?spatialBoundary(interval,'arrival',row.day):wall(interval.arrival);values[`departure${i}`]=interval.spatial?spatialBoundary(interval,'departure',row.day):wall(interval.departure);});return values;
  }));
  daily.getColumn('day').numFmt='dd-mm-yyyy';if(hasVisits)for(let i=0;i<pairs;i++)daily.getColumn(`arrival${i}`).numFmt=daily.getColumn(`departure${i}`).numFmt='dd-mm-yyyy hh:mm';daily.getColumn('duration').numFmt='[h]:mm';if(spatialMode)for(const key of ['durationMin','durationMax']){daily.getColumn(key).hidden=true;daily.getColumn(key).numFmt='[h]:mm';}
  groupedReportRows(report).forEach((row,index)=>{if(row.type==='day')row.visits.forEach((interval,i)=>{if(interval.estimated){daily.getCell(index+2,daily.getColumn(`arrival${i}`).number).note='† Chegada estimada; consultar limites espaciais e posições de apoio. Fonte: '+interval.refs.join(', ');if(interval.departure!=null)daily.getCell(index+2,daily.getColumn(`departure${i}`).number).note='† Saída estimada; consultar limites espaciais e posições de apoio. Fonte: '+interval.refs.join(', ');}});});
  const weekly=sheet('Totais semanais',[['Semana inicial','from',18],['Semana final','to',18],['Permanência total','duration',25],['Cobertura','notes',90]],periodTotals(report).weeks.map(week=>({from:new Date(week.from+'T00:00:00Z'),to:new Date(week.to+'T00:00:00Z'),duration:valueOfDuration(week),notes:totalNotes(week)})));weekly.getColumn('from').numFmt=weekly.getColumn('to').numFmt='dd-mm-yyyy';weekly.getColumn('duration').numFmt='[h]:mm';weekly.state='hidden';
  const monthly=sheet('Totais mensais',[['Mês','month',18],['Permanência total','duration',25],['Cobertura','notes',90]],periodTotals(report).months.map(month=>({month:displayMonth(month.key),duration:valueOfDuration(month),notes:totalNotes(month)})));monthly.getColumn('duration').numFmt='[h]:mm';
  sheet('Informações do relatório',[['Informação','key',30],['Descrição','value',100]],[{key:'Local',value:report.params.area.label||'Local selecionado'},{key:'Período',value:`${displayDate(report.params.from)} a ${displayDate(report.params.to)}`},{key:'Raio',value:`${report.params.area.radius} m`},{key:'Fuso horário',value:report.params.zone},{key:'Arquivo de origem',value:report.acquisition?.name||'Não informado'},{key:'SHA-256 do arquivo',value:report.acquisition?.sha256||'Não informado'},{key:'Modo de apuração',value:spatialMode?'Transições espaciais: intervalos de chegada/saída por posições fora e dentro da área (†)':'Somente intervalos de visitas'},{key:'Leitura dos horários',value:'Horários sem segundos. Cada dia reúne seus intervalos de entrada e saída. Transições espaciais são janelas de tempo; os limites sem evidência ficam indeterminados e não geram duração apurada.'},{key:'Totais',value:'União dos intervalos apurados, sem duplicar sobreposições. Dias sem dados não comprovam ausência. Presença no local não equivale a tempo de trabalho.'}]);
  const entries=sheet('Entradas e saídas',[['Fonte','ref',40],['Natureza','kind',48],['Início','start',24],['Fim','end',24],['Duração do intervalo','duration',22],['Início original ISO','originalStart',32],['Fim original ISO','originalEnd',32],['Alertas','alerts',80]],[
    ...report.days.flatMap(d=>(d.semanticPeriods||d.periods).map(p=>({ref:p.ref,kind:'Visita Google; recortada ao período/dia',durationMs:toMinute(p.end)-toMinute(p.start),start:wall(p.start),end:wall(p.end),originalStart:new Date(p.originalStart).toISOString(),originalEnd:new Date(p.originalEnd).toISOString(),alerts:alertText(p.alerts)}))),
    ...report.days.flatMap(day=>(day.estimatedPeriods||[]).map(p=>({ref:p.ref+' — '+p.sourceRefs.join(', '),kind:'† Intervalo estimado por pareamento de posições',start:wall(p.start),end:wall(p.end),durationMs:p.end==null?null:p.end-p.start,alerts:userAlertText(p.alerts)}))),
    ...report.observations.flatMap(o=>[{ref:o.ref,kind:'Posição registrada dentro da área',start:wall(o.time),end:null,alerts:alertText(o.alerts)},...['arrival','departure'].filter(k=>o[k]).map(k=>({ref:o.ref,kind:k==='arrival'?'Intervalo estimado de chegada':'Intervalo estimado de saída',durationMs:toMinute(o[k][1])-toMinute(o[k][0]),start:wall(o[k][0]),end:wall(o[k][1]),alerts:alertText(o.alerts)}))]),
    ...report.records.filter(r=>r.type==='Sem classificação').map(r=>({ref:r.ref,kind:r.type,durationMs:r.start!=null&&r.end>=r.start?toMinute(r.end)-toMinute(r.start):null,start:wall(r.start),end:wall(r.end),alerts:alertText(r.alerts)}))].map(row=>({...row,duration:row.durationMs==null?null:row.durationMs/86400000})));
  entries.getColumn('duration').numFmt='[h]:mm';
  entries.getColumn('start').numFmt=entries.getColumn('end').numFmt='dd-mm-yyyy hh:mm';
  entries.state='hidden';
  sheet('Registros de suporte',[['Referência JSON','ref',45],['Dados usados (JSON)','data',120],['Alertas','alerts',90]],[...report.records,...report.points].map(r=>({ref:r.ref,data:JSON.stringify(r),alerts:alertText(r.alerts)})));

  if(spatialMode){const audit=sheet('Apuração espacial',[['Referência derivada','ref',45],['Primeira presença','first',24],['Última presença','last',24],['Chegada: limite inicial','arrivalMin',24],['Chegada: limite final','arrivalMax',24],['Saída: limite inicial','departureMin',24],['Saída: limite final','departureMax',24],['Referências da fonte','sourceRefs',100]],report.days.flatMap(day=>(day.spatialPeriods||[]).map(p=>({ref:p.ref,first:wall(p.firstPosition),last:wall(p.lastPosition),arrivalMin:p.arrivalWindow?wall(toMinute(p.arrivalWindow[0])):null,arrivalMax:p.arrivalWindow?wall(ceilMinute(p.arrivalWindow[1])):null,departureMin:p.departureWindow?wall(toMinute(p.departureWindow[0])):null,departureMax:p.departureWindow?wall(ceilMinute(p.departureWindow[1])):null,sourceRefs:p.sourceRefs.join(', ')}))));for(const key of ['first','last','arrivalMin','arrivalMax','departureMin','departureMax'])audit.getColumn(key).numFmt='dd-mm-yyyy hh:mm';audit.state='hidden';}
  book.getWorksheet('Registros de suporte').state='hidden';
  const order=['Resumo diário','Totais semanais','Totais mensais','Informações do relatório','Entradas e saídas','Metodologia e integridade','Registros de suporte',...(spatialMode?['Apuração espacial']:[])];
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
