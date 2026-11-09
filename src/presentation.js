import {nextDay,dayAt} from './analysis.js';
import {displayDate} from './dates.js';
export function durationText(ms) { if(ms==null)return 'Não apurável';return `${Math.floor(ms/3600000)}h ${String(Math.floor(ms%3600000/60000)).padStart(2,'0')}min ${String(Math.floor(ms%60000/1000)).padStart(2,'0')}s`; }
export function accuracyText(row) {
  const number=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:1});
  const visit=row.accuracy==null?'Visita: não informada':`Visita: ${number(row.accuracy)} m`;
  const support=row.supportAccuracy;
  return visit+(support?`; posições de apoio: ${number(support.min)}${support.max!==support.min?'–'+number(support.max):''} m (${support.count} registros)`:'');
}
// Keep every visit/return separate. Never turn a single recorded position into an arrival/exit.
export function summaryRows(report) {
  return report.days.flatMap(day=>{
    const visitRows=day.periods.map(period=>{
    const source=report.records.find(r=>r.ref===period.ref);
    const supporting=report.points.filter(p=>p.within&&p.time>=period.start&&p.time<=period.end&&Number.isFinite(p.accuracy)&&p.accuracy>=0);
    const accuracies=supporting.map(p=>p.accuracy);
    return {
    day:day.day,arrival:period.originalStart,departure:period.originalEnd,
    durationMs:period.end-period.start,accuracy:source?.accuracy??null,
    supportAccuracy:accuracies.length?{min:accuracies.reduce((a,b)=>Math.min(a,b)),max:accuracies.reduce((a,b)=>Math.max(a,b)),count:accuracies.length,refs:supporting.map(p=>p.ref)}:null,
    ref:period.ref,alerts:period.alerts
  };});
    const observations=(report.observations||[]).filter(p=>dayAt(p.time,report.params.zone)===day.day&&!day.periods.some(v=>p.time>=v.start&&p.time<=v.end));
    const groups=[];
    for(const observation of observations){const previous=groups.at(-1)?.at(-1),gap=report.params.maxGapMinutes*60000;
      const outside=previous&&(report.points||[]).some(p=>p.within===false&&p.time>previous.time&&p.time<observation.time);
      if(!previous||outside||observation.time-previous.time>gap)groups.push([observation]);else groups.at(-1).push(observation);
    }
    const positions=groups.map(group=>({day:day.day,arrival:null,departure:null,firstPosition:group[0].time,lastPosition:group.at(-1).time,positionOnly:true,durationMs:null,accuracy:null,supportAccuracy:null,ref:group[0].ref,refs:group.map(p=>p.ref),alerts:[...new Map(group.flatMap(p=>p.alerts).map(a=>[a.kind+'|'+a.reason,a])).values()],status:'Posições registradas no local; permanência não apurável'}));
    const rows=[...visitRows,...positions].sort((a,b)=>(a.arrival??a.firstPosition)-(b.arrival??b.firstPosition));
    return rows.length?rows:[{day:day.day,arrival:null,departure:null,durationMs:null,accuracy:null,supportAccuracy:null,ref:null,alerts:day.alerts,status:day.status}];
  });
}
export function weekStart(day){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10);}
function addDays(day,n){let d=day;for(let i=0;i<n;i++)d=nextDay(d);return d;}
export function periodTotals(report){
  function group(key,bounds){const grouped=new Map();for(const day of report.days){const id=key(day.day);let g=grouped.get(id);if(!g){g={key:id,...bounds(id),selectedFrom:day.day,selectedTo:day.day,durationMs:null,unquantifiableDays:0,days:0,hasAlerts:false};grouped.set(id,g);}g.selectedTo=day.day;g.days++;g.hasAlerts ||= day.alerts.length>0;if(day.durationMs==null||day.incompletePresence)g.unquantifiableDays++;if(day.durationMs!=null)g.durationMs=(g.durationMs??0)+day.durationMs;}return [...grouped.values()].map(g=>({...g,partial:g.selectedFrom!==g.from||g.selectedTo!==g.to}));}
  return {weeks:group(weekStart,from=>({from,to:addDays(from,6)})),months:group(day=>day.slice(0,7),key=>({from:key+'-01',to:new Date(Date.UTC(+key.slice(0,4),+key.slice(5,7),0,12)).toISOString().slice(0,10)}))};
}
export function reportRows(report){const rows=summaryRows(report),totals=periodTotals(report);return rows.flatMap((row,index)=>{
  const output=[{...row,type:'presence',rowNumber:index+1}];
  if(!rows[index+1]||weekStart(rows[index+1].day)!==weekStart(row.day))output.push({...totals.weeks.find(w=>w.key===weekStart(row.day)),type:'week'});
  return output;
});}
export function totalNotes(total){return [total.partial?`Período selecionado: ${displayDate(total.selectedFrom)} a ${displayDate(total.selectedTo)}`:'',total.unquantifiableDays?`${total.unquantifiableDays} dia(s) com duração não apurável ou parcial; total dos intervalos disponíveis`:'',total.hasAlerts?'* Existem registros com alertas específicos':''].filter(Boolean).join('. ');}
