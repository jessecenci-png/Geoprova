import {dayAt,toMinute} from './dates.js';
export function consolidatePositionMarks(observations,duplicateMinutes=1){
  const groups=[];
  for(const observation of [...observations].sort((a,b)=>a.time-b.time)){
    const time=toMinute(observation.time),last=groups.at(-1);
    if(last&&time-last.time<=duplicateMinutes*60000){last.sourceRefs.push(observation.ref);last.alerts.push(...observation.alerts);}
    else groups.push({time,sourceRefs:[observation.ref],alerts:[...observation.alerts]});
  }
  return groups;
}
function unionMinutes(periods){
  const intervals=periods.filter(p=>p.end!=null).map(p=>[toMinute(p.start),toMinute(p.end)]).sort((a,b)=>a[0]-b[0]);
  let total=0,last=null;for(const [a,b] of intervals){if(!last)last=[a,b];else if(a<=last[1])last[1]=Math.max(last[1],b);else{total+=last[1]-last[0];last=[a,b];}}return last?total+last[1]-last[0]:null;
}
export function applyPositionPairing(days,observations,params){
  if(params.positionPairing!=='consecutive')return days;
  const duplicateMinutes=params.positionDuplicateMinutes??1;
  if(!Number.isFinite(duplicateMinutes)||duplicateMinutes<0)throw Error('Limite de consolidação de posições inválido.');
  const byDay=new Map();for(const p of observations){const day=dayAt(p.time,params.zone);if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(p);}
  return days.map(day=>{
    const candidates=(byDay.get(day.day)||[]).filter(p=>!day.periods.some(v=>toMinute(p.time)>=toMinute(v.start)-duplicateMinutes*60000&&toMinute(p.time)<=toMinute(v.end)+duplicateMinutes*60000));
    const marks=consolidatePositionMarks(candidates,duplicateMinutes),estimatedPeriods=[];
    for(let i=0;i<marks.length;i+=2){const a=marks[i],b=marks[i+1];estimatedPeriods.push({ref:`derived.positionPairs[${day.day}][${i/2}]`,start:a.time,end:b?.time??null,estimated:true,sourceRefs:[...new Set([...a.sourceRefs,...(b?.sourceRefs||[])])],alerts:[...new Map([...a.alerts,...(b?.alerts||[])].map(alert=>[alert.kind+'|'+alert.reason,alert])).values()]});}
    return {...day,estimatedPeriods,hasEstimates:estimatedPeriods.length>0,observedDurationMs:day.durationMs,durationMs:unionMinutes([...day.periods,...estimatedPeriods]),incompletePresence:estimatedPeriods.some(p=>p.end==null),unpairedPositionRefs:estimatedPeriods.filter(p=>p.end==null).flatMap(p=>p.sourceRefs)};
  });
}
