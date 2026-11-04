import {reportRows,periodTotals,totalNotes} from './presentation.js';
import {sha256,CLEAN,dayAt} from './analysis.js';
export const alertText = alerts=>alerts?.length?'* '+alerts.map(a=>`${a.kind}: ${a.reason}`).join(' | '):CLEAN;
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
  function wall(t) { if(t==null)return null;const p=new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(t);return new Date(p.replace(' ','T')+'Z'); }
  sheet('Metodologia e integridade',[['Campo','key',35],['Valor','value',130]],Object.entries({identificador:report.id,versao:report.appVersion,regras:report.rulesVersion,periodo:`${report.params.from} a ${report.params.to} (inclusive)`,fuso:zone,parametros:report.params,aquisicao:report.acquisition,cobertura:report.coverage,diagnostico:report.diagnostics,leituraDosHorarios:'Chegada e saída: limites originais das visitas da Linha do Tempo. Cada retorno mantém uma linha. Posições isoladas não determinam chegada/saída. Fim do último segmento não comprova saída. Permanência por linha: parcela do dia/período. Totais semanais (segunda a domingo) e mensais usam união dos intervalos para evitar dupla contagem. Precisão da visita e das posições de apoio são distintas; não usar probabilidade como metros. Dias não apuráveis não se tornam zero.',legenda:'* alerta individual; probabilidade semântica não é precisão espacial; vazio na duração significa não apurável',limitacoes:report.limitations,assinatura:'Documento sem mecanismo de verificação de origem. Manifesto de hashes verifica identidade, não autoria.'}).map(([key,value])=>({key,value:typeof value==='string'?value:JSON.stringify(value)})));
  const daily=sheet('Resumo diário',[['Data / semana','day',32],['Chegada','arrival',24],['Saída','departure',24],['Permanência','duration',24],['Alertas / cobertura','alerts',70]],reportRows(report).map(row=>row.type==='week'?{day:`Total semana ${row.from} a ${row.to}`,duration:row.durationMs==null?null:row.durationMs/86400000,alerts:totalNotes(row)}:{day:new Date(row.day+'T00:00:00Z'),arrival:wall(row.arrival),departure:wall(row.departure),duration:row.durationMs==null?null:row.durationMs/86400000,alerts:row.alerts.length?alertText(row.alerts):row.arrival==null?row.status:''}));
  daily.getColumn('day').numFmt='yyyy-mm-dd';daily.getColumn('arrival').numFmt=daily.getColumn('departure').numFmt='yyyy-mm-dd hh:mm:ss';daily.getColumn('duration').numFmt='[h]:mm:ss';
  const monthly=sheet('Totais mensais',[['Mês','month',18],['Permanência total','duration',25],['Cobertura','notes',90]],periodTotals(report).months.map(month=>({month:month.key,duration:month.durationMs==null?null:month.durationMs/86400000,notes:totalNotes(month)})));monthly.getColumn('duration').numFmt='[h]:mm:ss';
  const entries=sheet('Entradas e saídas',[['Fonte','ref',40],['Natureza','kind',48],['Início','start',24],['Fim','end',24],['Duração do intervalo','duration',22],['Início original ISO','originalStart',32],['Fim original ISO','originalEnd',32],['Alertas','alerts',80]],[
    ...report.days.flatMap(d=>d.periods.map(p=>({ref:p.ref,kind:'Visita Google; recortada ao período/dia',durationMs:p.end-p.start,start:wall(p.start),end:wall(p.end),originalStart:new Date(p.originalStart).toISOString(),originalEnd:new Date(p.originalEnd).toISOString(),alerts:alertText(p.alerts)}))),
    ...report.observations.flatMap(o=>[{ref:o.ref,kind:'Posição registrada dentro da área',start:wall(o.time),end:null,alerts:alertText(o.alerts)},...['arrival','departure'].filter(k=>o[k]).map(k=>({ref:o.ref,kind:k==='arrival'?'Intervalo estimado de chegada':'Intervalo estimado de saída',durationMs:o[k][1]-o[k][0],start:wall(o[k][0]),end:wall(o[k][1]),alerts:alertText(o.alerts)}))]),
    ...report.records.filter(r=>r.type==='Sem classificação').map(r=>({ref:r.ref,kind:r.type,durationMs:r.start!=null&&r.end>=r.start?r.end-r.start:null,start:wall(r.start),end:wall(r.end),alerts:alertText(r.alerts)}))].map(row=>({...row,duration:row.durationMs==null?null:row.durationMs/86400000})));
  entries.getColumn('duration').numFmt='[h]:mm:ss';
  entries.getColumn('start').numFmt=entries.getColumn('end').numFmt='yyyy-mm-dd hh:mm:ss';
  sheet('Registros de suporte',[['Referência JSON','ref',45],['Dados usados (JSON)','data',120],['Alertas','alerts',90]],[...report.records,...report.points].map(r=>({ref:r.ref,data:JSON.stringify(r),alerts:alertText(r.alerts)})));

  return new Uint8Array(await book.xlsx.writeBuffer());
}
export async function exportBundle(report) {
  const json=new TextEncoder().encode(JSON.stringify(report,null,2));
  const xlsx=await workbook(report);
  const files=[{name:`geoprova-${report.id}.json`,bytes:json,type:'application/json'},{name:`geoprova-${report.id}.xlsx`,bytes:xlsx,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}];
  const manifest={id:report.id,algorithm:'SHA-256',notice:'Hashes não comprovam autoria. Manifesto separado, sem autorreferência.',files:await Promise.all(files.map(async f=>({name:f.name,size:f.bytes.length,sha256:await sha256(f.bytes)})))};
  files.forEach(f=>download(f.bytes,f.name,f.type));download(JSON.stringify(manifest,null,2),`geoprova-${report.id}-manifesto.json`,'application/json');
}
