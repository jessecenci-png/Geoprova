function unionDuration(periods){
  const intervals=periods.filter(p=>p.end!=null).map(p=>[p.start,p.end]).sort((a,b)=>a[0]-b[0]);let last=null,total=0;
  for(const [a,b] of intervals){if(!last)last=[a,b];else if(a<=last[1])last[1]=Math.max(last[1],b);else{total+=last[1]-last[0];last=[a,b];}}return last?total+last[1]-last[0]:null;
}
export function conservativePositionRuns(points,area,movements=[]){
  const runs=[];let current=null,previousOutside=null;
  const finish=outside=>{if(current){current.outsideAfter=outside;current.sourceRefs=[...new Set([...current.inside.map(p=>p.ref),...current.uncertain.map(p=>p.ref),...(current.outsideBefore?[current.outsideBefore.ref]:[]),...(outside?[outside.ref]:[])])];runs.push(current);current=null;}};
  const groups=new Map();for(const point of points){if(!groups.has(point.time))groups.set(point.time,[]);groups.get(point.time).push(point);}
  for(const movement of movements){if(!groups.has(movement.start))groups.set(movement.start,[]);groups.get(movement.start).push({movement:true,ref:movement.ref,time:movement.start});}
  for(const [,samples] of [...groups].sort((a,b)=>a[0]-b[0])){
    const movement=samples.find(p=>p.movement);if(movement){finish(movement);previousOutside=movement;continue;}
    const activeMovement=movements.find(m=>samples[0].time>=m.start&&m.end!=null&&samples[0].time<m.end);if(activeMovement){finish({ref:activeMovement.ref,time:activeMovement.start});previousOutside={ref:activeMovement.ref,time:activeMovement.start};continue;}
    const inside=samples.filter(p=>p.within),outside=samples.filter(p=>!p.within&&(!(typeof p.accuracy==='number'&&p.accuracy>=0)||p.distanceMeters>area.radius+p.accuracy));
    if(inside.length&&outside.length){finish(null);previousOutside=null;continue;}
    if(outside.length){finish(outside[0]);previousOutside=outside[0];continue;}
    if(inside.length){if(!current)current={inside:[],uncertain:[],outsideBefore:previousOutside};current.inside.push(...inside);}else if(current)current.uncertain.push(...samples);
  }
  finish(null);return runs;
}
export function applyConservativeInference(days,points,params,records){
  if(params.positionPairing!=='hybrid'&&params.positionPairing!=='none')return days;
  const movements=records.filter(r=>r.start!=null&&(r.end==null||r.end>=r.start)&&/^(IN_PASSENGER_VEHICLE|IN_VEHICLE|DRIVING|MOTORCYCLING)$/.test(r.original.activity?.topCandidate?.type||r.original.activity?.type||''));
  return days.map(day=>{
    const periods=day.periods.map(p=>({...p,approximate:true,timingSource:'google-visit',sourceRefs:[p.ref],movementRefs:movements.filter(r=>r.start>=p.originalEnd&&r.start-p.originalEnd<=120000).map(r=>r.ref)}));
    const infer=params.positionPairing==='hybrid'&&periods.length===0;
    const runs=infer?conservativePositionRuns(points.filter(p=>!p.context&&p.time>=day.start&&p.time<day.end),params.area,movements.filter(m=>m.start>=day.start&&m.start<day.end||m.start<day.start&&m.end>day.start)):[];
    const inferredPeriods=runs.map((run,i)=>{const first=run.inside[0],last=run.inside.at(-1),hasSpan=last.time>first.time;return {ref:`derived.conservativePresence[${day.day}][${i}]`,start:first.time,end:hasSpan?last.time:null,firstPosition:first.time,lastPosition:last.time,approximate:true,timingSource:'first-last-inside',sourceRefs:run.sourceRefs,continuityAssumed:hasSpan,largestGapMs:run.inside.reduce((gap,p,index)=>index?Math.max(gap,p.time-run.inside[index-1].time):0,0),alerts:[...new Map([...run.inside,...run.uncertain].flatMap(p=>p.alerts).map(a=>[a.kind+'|'+a.reason,a])).values()]};});
    const usedRefs=new Set(inferredPeriods.flatMap(p=>p.sourceRefs)),insideDay=points.filter(p=>!p.context&&p.within&&p.time>=day.start&&p.time<day.end);
    const supportOnlyPositionRefs=periods.length?insideDay.map(p=>p.ref):infer?insideDay.filter(p=>!usedRefs.has(p.ref)).map(p=>p.ref):[];
    return {...day,refs:[...new Set([...day.refs,...periods.flatMap(p=>p.movementRefs),...inferredPeriods.flatMap(p=>p.sourceRefs)])],periods,inferredPeriods,supportOnlyPositionRefs,preserveSeconds:true,approximateMode:true,spatialMode:false,hasEstimates:periods.length>0||inferredPeriods.some(p=>p.end!=null),durationMs:unionDuration([...periods,...inferredPeriods]),incompletePresence:inferredPeriods.some(p=>p.end==null),status:periods.length?'Horários aproximados da visita registrada':inferredPeriods.length?'Horários conservadores estimados pelas posições':day.status};
  });
}
