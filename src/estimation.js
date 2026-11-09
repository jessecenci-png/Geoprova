import {dayAt,toMinute,ceilMinute} from './dates.js';
export function consolidatePositionMarks(observations,duplicateMinutes=1){
  const groups=[];for(const p of [...observations].sort((a,b)=>a.time-b.time)){const time=toMinute(p.time),last=groups.at(-1);if(last&&time-last.time<=duplicateMinutes*60000){last.sourceRefs.push(p.ref);last.alerts.push(...p.alerts);}else groups.push({time,sourceRefs:[p.ref],alerts:[...p.alerts]});}return groups;
}
function union(intervals){
  const sorted=intervals.filter(p=>p.end!=null&&p.start!=null).map(p=>[toMinute(p.start),toMinute(p.end)]).filter(([a,b])=>b>=a).sort((a,b)=>a[0]-b[0]);let last=null,total=0;for(const [a,b] of sorted){if(!last)last=[a,b];else if(a<=last[1])last[1]=Math.max(last[1],b);else{total+=last[1]-last[0];last=[a,b];}}return last?total+last[1]-last[0]:null;
}
export function spatialSessions(points,maxGapMinutes=30){
  const byTime=new Map();for(const p of points){if(!byTime.has(p.time))byTime.set(p.time,[]);byTime.get(p.time).push(p);}
  const samples=[...byTime.entries()].sort((a,b)=>a[0]-b[0]).map(([time,items])=>({time,items,within:items.every(p=>p.within)?true:items.every(p=>!p.within)?false:null}));
  const sessions=[];let current=null,previous=null;
  const close=()=>{if(current){sessions.push(current);current=null;}};
  for(const sample of samples){
    if(sample.within===null){close();previous=sample;continue;}
    if(sample.within){
      if(current&&sample.time-current.last.time>maxGapMinutes*60000)close();
      if(!current){const arrival=previous?.within===false&&sample.time-previous.time<=maxGapMinutes*60000?[previous.time,sample.time]:null;current={first:sample,last:sample,samples:[sample],arrivalWindow:arrival,departureWindow:null,boundarySamples:arrival?[previous]:[]};}
      else{current.last=sample;current.samples.push(sample);}
    }else if(current){if(sample.time-current.last.time<=maxGapMinutes*60000){current.departureWindow=[current.last.time,sample.time];current.boundarySamples.push(sample);}close();}
    previous=sample;
  }
  close();return sessions;
}
export function applySpatialTransitions(days,points,params,precomputedSessions){
  if(params.positionPairing==='consecutive')throw Error('O pareamento por ordem dos horários foi substituído por transições espaciais. Selecione a nova apuração.');
  if(params.positionPairing!=='spatial')return days;
  const sessions=(precomputedSessions||spatialSessions(points,params.maxGapMinutes)).map(s=>({...s,firstDay:dayAt(s.first.time,params.zone),lastDay:dayAt(s.last.time,params.zone)}));
  return days.map(day=>{
    const sessionsOfDay=sessions.filter(s=>s.firstDay<=day.day&&s.lastDay>=day.day);
    const spatialPeriods=sessionsOfDay.map((s,i)=>{
      const items=[...s.samples,...s.boundarySamples].flatMap(sample=>sample.items),refs=[...new Set(items.map(p=>p.ref))];
      return {ref:`derived.spatialSessions[${day.day}][${i}]`,spatial:true,estimated:true,firstPosition:s.first.time,lastPosition:s.last.time,arrivalWindow:s.arrivalWindow,departureWindow:s.departureWindow,sourceRefs:refs,alerts:[...new Map(items.flatMap(p=>p.alerts).map(a=>[a.kind+'|'+a.reason,a])).values()],complete:!!s.arrivalWindow&&!!s.departureWindow};
    });
    const complete=spatialPeriods.filter(p=>p.complete);
    // Local-day clipping uses existing day bounds supplied by analysis, not a fixed 24 h.
    const minIntervals=complete.map(p=>({start:Math.max(day.start,ceilMinute(p.firstPosition)),end:Math.max(Math.max(day.start,ceilMinute(p.firstPosition)),Math.min(day.end,toMinute(p.lastPosition)))}));
    const maxIntervals=complete.map(p=>({start:Math.max(day.start,toMinute(p.arrivalWindow[0])),end:Math.min(day.end,ceilMinute(p.departureWindow[1]))}));
    const durationMinMs=union(minIntervals),durationMaxMs=union(maxIntervals);
    return {...day,semanticPeriods:day.periods,periods:[],spatialPeriods,hasEstimates:spatialPeriods.some(p=>p.arrivalWindow||p.departureWindow),spatialMode:true,observedDurationMs:day.durationMs,durationMinMs,durationMaxMs,durationMs:durationMinMs!=null&&durationMinMs===durationMaxMs?durationMinMs:null,incompletePresence:spatialPeriods.some(p=>!p.complete),status:spatialPeriods.length?'Posições no local; limites determinados por transições espaciais':day.periods.length?'Visitas disponíveis, mas faltam posições para determinar chegada e saída espacial':day.status};
  });
}
