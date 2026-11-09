import {nextDay,dayAt} from './analysis.js';
import {displayDate,weekdayName,toMinute} from './dates.js';
export function durationText(ms) { if(ms==null)return 'Não apurável';return `${Math.floor(ms/3600000)}h ${String(Math.floor(ms%3600000/60000)).padStart(2,'0')}min`; }
export function accuracyText(row) {
  const number=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:1});
  const visit=row.accuracy==null?'Visita: não informada':`Visita: ${number(row.accuracy)} m`;
  const support=row.supportAccuracy;
  return visit+(support?`; posições de apoio: ${number(support.min)}${support.max!==support.min?'–'+number(support.max):''} m (${support.count} registros)`:'');
}
// Keep every visit/return separate. Never turn a single recorded position into an arrival/exit.
export function summaryRows(report) {
  const observationsByDay=new Map();
  for(const observation of report.observations||[]){const day=dayAt(observation.time,report.params.zone);if(!observationsByDay.has(day))observationsByDay.set(day,[]);observationsByDay.get(day).push(observation);}
  const recordByRef=new Map(report.records.map(record=>[record.ref,record]));
  return report.days.flatMap(day=>{
    const visitRows=day.periods.map(period=>{
    const source=recordByRef.get(period.ref);
    const supporting=report.points.filter(p=>p.within&&p.time>=period.start&&p.time<=period.end&&Number.isFinite(p.accuracy)&&p.accuracy>=0);
    const accuracies=supporting.map(p=>p.accuracy);
    return {
    day:day.day,arrival:period.originalStart,departure:period.originalEnd,clippedStart:period.start,clippedEnd:period.end,
    durationMs:toMinute(period.end)-toMinute(period.start),accuracy:source?.accuracy??null,
    supportAccuracy:accuracies.length?{min:accuracies.reduce((a,b)=>Math.min(a,b)),max:accuracies.reduce((a,b)=>Math.max(a,b)),count:accuracies.length,refs:supporting.map(p=>p.ref)}:null,
    ref:period.ref,alerts:period.alerts
  };});

    const spatialRows=(day.spatialPeriods||[]).map(period=>({day:day.day,spatial:true,estimated:!!period.arrivalWindow||!!period.departureWindow,arrival:period.arrivalWindow?.[1]??null,departure:period.departureWindow?.[0]??null,firstPosition:period.firstPosition,lastPosition:period.lastPosition,arrivalWindow:period.arrivalWindow,departureWindow:period.departureWindow,durationMs:null,ref:period.ref,refs:period.sourceRefs,alerts:period.alerts}));
    const pairedSourceRefs=new Set((day.spatialPeriods||[]).flatMap(period=>period.sourceRefs));
    const observations=(observationsByDay.get(day.day)||[]).filter(p=>!pairedSourceRefs.has(p.ref)&&!day.periods.some(v=>p.time>=v.start&&p.time<=v.end));
    const groups=[];
    for(const observation of observations){const previous=groups.at(-1)?.at(-1),gap=report.params.maxGapMinutes*60000;
      const outside=previous&&(report.points||[]).some(p=>p.within===false&&p.time>previous.time&&p.time<observation.time);
      if(!previous||outside||observation.time-previous.time>gap)groups.push([observation]);else groups.at(-1).push(observation);
    }
    const positions=groups.map(group=>({day:day.day,arrival:null,departure:null,firstPosition:group[0].time,lastPosition:group.at(-1).time,positionTimes:group.map(p=>p.time),positionOnly:true,durationMs:null,accuracy:null,supportAccuracy:null,ref:group[0].ref,refs:group.map(p=>p.ref),alerts:[...new Map(group.flatMap(p=>p.alerts).map(a=>[a.kind+'|'+a.reason,a])).values()],status:'Posições registradas no local; permanência não apurável'}));
    const rows=[...visitRows,...spatialRows,...positions].sort((a,b)=>(a.arrival??a.firstPosition)-(b.arrival??b.firstPosition));
    return rows.length?rows:[{day:day.day,arrival:null,departure:null,durationMs:null,accuracy:null,supportAccuracy:null,ref:null,alerts:day.alerts,status:day.status}];
  });
}
export function weekStart(day){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10);}
function addDays(day,n){let d=day;for(let i=0;i<n;i++)d=nextDay(d);return d;}
export function periodTotals(report){
  function group(key,bounds){const grouped=new Map();for(const day of report.days){const id=key(day.day);let g=grouped.get(id);if(!g){g={key:id,...bounds(id),selectedFrom:day.day,selectedTo:day.day,durationMs:null,durationMinMs:null,durationMaxMs:null,spatialMode:!!day.spatialMode,unquantifiableDays:0,days:0,hasAlerts:false,hasEstimates:false};grouped.set(id,g);}g.selectedTo=day.day;g.days++;g.hasAlerts ||= day.alerts.length>0;g.hasEstimates ||= !!day.hasEstimates;const measurable=day.spatialMode?day.durationMinMs!=null:day.durationMs!=null;if(!measurable||day.incompletePresence)g.unquantifiableDays++;if(day.spatialMode&&measurable){g.durationMinMs=(g.durationMinMs??0)+day.durationMinMs;g.durationMaxMs=(g.durationMaxMs??0)+day.durationMaxMs;}else if(!day.spatialMode&&measurable)g.durationMs=(g.durationMs??0)+day.durationMs;}return [...grouped.values()].map(g=>({...g,durationMs:g.spatialMode&&g.durationMinMs!=null&&g.durationMinMs===g.durationMaxMs?g.durationMinMs:g.durationMs,partial:g.selectedFrom!==g.from||g.selectedTo!==g.to}));}
  return {weeks:group(weekStart,from=>({from,to:addDays(from,6)})),months:group(day=>day.slice(0,7),key=>({from:key+'-01',to:new Date(Date.UTC(+key.slice(0,4),+key.slice(5,7),0,12)).toISOString().slice(0,10)}))};
}
export function reportRows(report){const rows=summaryRows(report),totals=periodTotals(report);return rows.flatMap((row,index)=>{
  const output=[{...row,type:'presence',rowNumber:index+1}];
  if(!rows[index+1]||weekStart(rows[index+1].day)!==weekStart(row.day))output.push({...totals.weeks.find(w=>w.key===weekStart(row.day)),type:'week'});
  return output;
});}
export function dailyRows(report){
  const rows=summaryRows(report).map((row,index)=>({...row,rowNumber:index+1}));
  return report.days.map(day=>{
    const sameDay=rows.filter(row=>row.day===day.day),intervals=sameDay.filter(row=>row.arrival!=null||row.firstPosition!=null),ordered=intervals.filter(row=>!row.positionOnly).sort((a,b)=>(a.arrival??a.firstPosition)-(b.arrival??b.firstPosition)||(a.departure??a.lastPosition)-(b.departure??b.lastPosition)),positions=intervals.filter(row=>row.positionOnly),visits=[];
    for(const interval of ordered){const previous=visits.at(-1);if(previous&&!previous.spatial&&!interval.spatial&&previous.departure!=null&&interval.departure!=null&&interval.arrival<=previous.departure&&!!previous.estimated===!!interval.estimated){previous.departure=Math.max(previous.departure,interval.departure);previous.clippedStart=Math.min(previous.clippedStart,interval.clippedStart);previous.clippedEnd=Math.max(previous.clippedEnd,interval.clippedEnd);previous.durationMs=toMinute(previous.clippedEnd)-toMinute(previous.clippedStart);previous.sourceRowNumbers.push(interval.rowNumber);previous.refs=[...new Set([...previous.refs,...(interval.refs||[interval.ref])])];previous.alerts=[...new Map([...previous.alerts,...interval.alerts].map(a=>[a.kind+'|'+a.reason,a])).values()];previous.merged=true;}else visits.push({...interval,refs:interval.refs||[interval.ref],sourceRowNumbers:[interval.rowNumber]});}
    const nearVisit=time=>day.periods.some(period=>toMinute(time)>=toMinute(period.start)-60000&&toMinute(time)<=toMinute(period.end)+60000);
    const positionTimes=[...new Set(positions.flatMap(row=>row.positionTimes||[row.firstPosition,row.lastPosition]).filter(t=>t!=null&&!nearVisit(t)).map(toMinute))].sort((a,b)=>a-b);
    return {day:day.day,weekday:weekdayName(day.day),durationMs:day.durationMs,durationMinMs:day.durationMinMs,durationMaxMs:day.durationMaxMs,spatialMode:!!day.spatialMode,hasEstimates:!!day.hasEstimates,incompletePresence:!!day.incompletePresence,alerts:day.alerts,status:day.status,emptyRowNumber:sameDay[0]?.rowNumber,intervals,visits,positionRows:positions,positionTimes};
  });
}
export function groupedReportRows(report){const days=dailyRows(report),totals=periodTotals(report);return days.flatMap((day,index)=>{
  const rows=[{...day,type:'day'}];if(!days[index+1]||weekStart(days[index+1].day)!==weekStart(day.day))rows.push({...totals.weeks.find(w=>w.key===weekStart(day.day)),type:'week'});return rows;
});}
export function timePairCount(report){return Math.max(2,...dailyRows(report).map(day=>day.visits.length));}
export function totalNotes(total){return [total.hasEstimates?'† Inclui estimativas por transições espaciais':'',total.unquantifiableDays?'Total parcial: soma dos intervalos disponíveis':'',total.partial?`Período: ${displayDate(total.selectedFrom)} a ${displayDate(total.selectedTo)}`:'',total.hasAlerts?'* Registros com alertas':''].filter(Boolean).join('. ');}

export function totalDurationText(total){if(!total.spatialMode)return durationText(total.durationMs);if(total.durationMinMs==null)return 'Não apurável';return total.durationMinMs===total.durationMaxMs?durationText(total.durationMinMs):durationText(total.durationMinMs)+' a '+durationText(total.durationMaxMs);}
