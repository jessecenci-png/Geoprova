export const VERSION = '0.5.0';
export const RULES = 'experimental-2026-11-04.4';
export const PRIVACY = 'Seus dados de localização são processados neste dispositivo e não são enviados ao criador do software.';
export const ABSENCE = 'A ausência de registros de localização não significa que a pessoa esteve ausente do local de trabalho. Pode decorrer de falhas de localização, configurações do aparelho, interrupções na coleta ou outras limitações dos dados.';
export const HASH_NOTICE = 'O hash permite verificar se o arquivo permanece idêntico ao importado. Ele não comprova a autenticidade da origem nem a ausência de alterações anteriores à importação.';
export const CLEAN = 'Sem indícios identificados pelos critérios utilizados';
export async function sha256(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
export function coordinates(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    // Android exports can include a degree sign BEFORE the comma: "-23.55°, -46.63°".
    // A degree sign is a unit, not the separator between latitude and longitude.
    const text=value.trim().replace(/^geo:/i,'').replace(/[°º]/g,'');
    const m = text.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/);
    return m ? validPoint(+m[1], +m[2]) : null;
  }
  if (value.latitudeE7 != null && value.longitudeE7 != null) return validPoint(value.latitudeE7/1e7,value.longitudeE7/1e7);
  if (value.latitude != null && value.longitude != null) return validPoint(+value.latitude,+value.longitude);
  if (value.lat != null && (value.lng != null || value.lon != null)) return validPoint(+value.lat,+(value.lng ?? value.lon));
  return coordinates(value.latLng || value.LatLng || value.point || value.position || value.location);
}
function validPoint(lat,lon) { return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180 ? {lat,lon} : null; }
export function distance(a,b) { const r=Math.PI/180, d=(b.lat-a.lat)*r, e=(b.lon-a.lon)*r; return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(d/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(e/2)**2))); }
export function inside(point, area) {
  if (!point) return false;
  if (area.polygon?.length>=3) {
    let yes=false; const p=area.polygon;
    for(let i=0,j=p.length-1;i<p.length;j=i++) if ((p[i].lat>point.lat)!==(p[j].lat>point.lat) && point.lon<(p[j].lon-p[i].lon)*(point.lat-p[i].lat)/(p[j].lat-p[i].lat)+p[i].lon) yes=!yes;
    return yes;
  }
  return distance(point,area)<=area.radius;
}
export function dayAt(time, zone) { const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time)); return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-'); }
export function midnight(day, zone) {
  const target=Date.parse(day+'T00:00:00Z'); let t=target;
  for(let i=0;i<4;i++) {
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(t);
    const v=k=>p.find(x=>x.type===k).value;
    const local=Date.parse(`${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:${v('second')}Z`);
    const diff=target-local; t+=diff; if(!diff) break;
  }
  return t;
}
export function nextDay(day) { return new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10); }
const timestamp=v=> { if(v==null) return null; const n=typeof v==='number'?v:Date.parse(v); return Number.isFinite(n)?n:null; };
export function normalize(json) {
  const records=[], points=[];
  const parsing={segments:0,visits:0,visitsWithCoordinates:0,visitsWithoutCoordinates:0,positionCandidates:0,positionsRead:0,positionsWithoutCoordinates:0,positionsWithoutTimestamp:0};
  const segments=Array.isArray(json.semanticSegments)?json.semanticSegments:[];
  function addPoint(v,ref,parent,time) {
    if(!v||typeof v!=='object')return;
    parsing.positionCandidates++;
    const point=coordinates(v), t=timestamp(time ?? v.timestamp ?? v.time);
    if(!point)parsing.positionsWithoutCoordinates++;
    if(t===null)parsing.positionsWithoutTimestamp++;
    if(!point || t===null) return;
    parsing.positionsRead++;
    points.push({ref,parent,time:t,point,accuracy:v.accuracyMeters ?? v.accuracy ?? v.horizontalAccuracy ?? null, source:v.source ?? v.provider ?? null,altitude:v.altitudeMeters ?? v.altitude ?? null,speed:v.speedMetersPerSecond ?? v.speed ?? null,original:v});
  }
  segments.forEach((s,i)=> {
    const ref=`semanticSegments[${i}]`, alerts=[], visit=s.visit;
    if(visit && Object.hasOwn(visit,'isTimelessVisit') && visit.isTimelessVisit===false) {
      alerts.push({kind:'Possível intervenção manual',reason:'visit.isTimelessVisit presente com valor booleano false; critério experimental.'});
      if(visit.topCandidate?.probability===0) alerts.push({kind:'Fundamento adicional',reason:'Probabilidade do lugar igual a zero, acompanhada de isTimelessVisit: false.'});
    }
    const timeKeys=new Set(['startTime','endTime','startTimeTimezoneUtcOffsetMinutes','endTimeTimezoneUtcOffsetMinutes','startTimeTimezoneUtcOffset','endTimeTimezoneUtcOffset']);
    if(Object.keys(s).length && Object.keys(s).every(k=>timeKeys.has(k))) alerts.push({kind:'Intervalo sem classificação — possível remoção de registro',reason:'Segmento contém somente horários e/ou campos de fuso; critério experimental.'});
    const start=timestamp(s.startTime),end=timestamp(s.endTime);
    if(start===null || end===null || end<start) alerts.push({kind:'Inconsistência',reason:'Horário ausente, inválido ou fim anterior ao início.'});
    const spatial=visit?.topCandidate?.placeLocation;
    const accuracy=spatial?.accuracyMeters??spatial?.horizontalAccuracyMeters??visit?.accuracyMeters??null;
    const record={ref,start,end,point:coordinates(spatial),accuracy:typeof accuracy==='number'&&Number.isFinite(accuracy)&&accuracy>=0?accuracy:null,placeId:visit?.topCandidate?.placeId ?? null,semanticType:visit?.topCandidate?.semanticType ?? null,visitProbability:visit?.probability ?? null,placeProbability:visit?.topCandidate?.probability ?? null,type:visit?'Visita interpretada pelo Google':s.activity?'Atividade':s.timelinePath?'Trajeto':'Sem classificação',alerts,original:s};
    records.push(record);
    parsing.segments++;if(visit){parsing.visits++;if(record.point)parsing.visitsWithCoordinates++;else parsing.visitsWithoutCoordinates++;}
    (s.timelinePath||[]).forEach((p,j)=>addPoint(p,`${ref}.timelinePath[${j}]`,ref,p.time ?? (start!==null && p.durationMinutesOffsetFromStartTime!=null ? start+Number(p.durationMinutesOffsetFromStartTime)*60000 : null)));
  });
  (Array.isArray(json.rawSignals)?json.rawSignals:[]).forEach((s,i)=> {
    if(s.position) addPoint(s.position,`rawSignals[${i}].position`,null,s.position.timestamp ?? s.timestamp);
    else if(coordinates(s)) addPoint(s,`rawSignals[${i}]`,null);
  });
  points.sort((a,b)=>a.time-b.time);
  const coverage = list => { const times=list.filter(Number.isFinite); return times.length?times.reduce((c,t)=>({start:Math.min(c.start,t),end:Math.max(c.end,t),count:c.count+1}),{start:Infinity,end:-Infinity,count:0}):null; };
  return {records,points,parsing,coverage:{semanticSegments:coverage(records.flatMap(r=>[r.start,r.end])),rawSignals:coverage(points.filter(p=>p.ref.startsWith('rawSignals')).map(p=>p.time)),timelinePath:coverage(points.filter(p=>p.parent).map(p=>p.time))},profile:json.userLocationProfile ?? null};
}
function unionDuration(periods) {
  const sorted=periods.map(p=>[p.start,p.end]).sort((a,b)=>a[0]-b[0]); let total=0,last=null;
  for(const [a,b] of sorted) { if(!last) last=[a,b]; else if(a<=last[1]) last[1]=Math.max(last[1],b); else {total+=last[1]-last[0];last=[a,b];} }
  return total+(last?last[1]-last[0]:0);
}
export function analyze(data,params) {
  if(!params.confirmed) throw Error('Confirme o local de trabalho.');
  if(!validPoint(+params.area.lat,+params.area.lon) || !(params.area.radius>0)) throw Error('Coordenadas ou raio inválidos.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(params.from)||!/^\d{4}-\d{2}-\d{2}$/.test(params.to)||params.from>params.to) throw Error('Período inválido.');
  const begin=midnight(params.from,params.zone), finish=midnight(nextDay(params.to),params.zone);
  if((finish-begin)/86400000>3660) throw Error('Selecione no máximo dez anos por análise.');
  const overlaps=r=>r.start!==null&&r.end!==null&&r.end>=begin&&r.start<finish;
  const records=data.records.filter(overlaps).map(r=>({...r,alerts:[...r.alerts]}));
  const visits=records.filter(r=>r.type==='Visita interpretada pelo Google' && r.end>=r.start && inside(r.point,params.area));
  for(let i=0;i<visits.length;i++) {
    const v=visits[i];
    if(visits.some((w,j)=>j!==i&&w.start<v.end&&w.end>v.start)) v.alerts.push({kind:'Inconsistência',reason:'Visitas do estabelecimento se sobrepõem; duração diária usa união dos intervalos.'});
    if(data.records.filter(r=>r.end!==null).every(r=>r.end<=v.end)) v.alerts.push({kind:'Insuficiência de dados',reason:'Fim do último segmento da exportação não comprova saída.'});
  }
  const points=data.points.filter(p=>p.time>=begin&&p.time<finish).map(p=>({...p,alerts:[],within:inside(p.point,params.area)}));
  points.forEach((p,i)=> {
    if(p.accuracy!=null && p.accuracy>params.maxAccuracy) p.alerts.push({kind:'Inconsistência',reason:`Precisão espacial informada de ${p.accuracy} m supera o limite de ${params.maxAccuracy} m.`});
    if(p.accuracy!=null && Math.abs(distance(p.point,params.area)-params.area.radius)<=p.accuracy && !params.area.polygon?.length) p.alerts.push({kind:'Insuficiência de dados',reason:'Margem de precisão cruza o limite da área.'});
    const prev=points[i-1];
    if(prev && p.time>prev.time && distance(prev.point,p.point)/((p.time-prev.time)/1000)>params.maxSpeed) p.alerts.push({kind:'Inconsistência',reason:`Deslocamento entre ${prev.ref} e ${p.ref} supera ${params.maxSpeed} m/s.`});
    if(p.parent) p.alerts.push(...(records.find(r=>r.ref===p.parent)?.alerts||[]));
    // A visit is a semantic interval; nearby trajectory endpoints can fall outside a
    // small establishment radius. That fact alone is not an inconsistency.
  });
  const observations=points.flatMap((p,i)=> {
    if(!p.within)return [];
    const prev=points[i-1],next=points[i+1],limit=params.maxGapMinutes*60000;
    const arrival=prev&&!prev.within&&p.time-prev.time<=limit?[prev.time,p.time]:null,departure=next&&!next.within&&next.time-p.time<=limit?[p.time,next.time]:null;
    return [{ref:p.ref,time:p.time,arrival,departure,arrivalRef:arrival?prev.ref:null,departureRef:departure?next.ref:null,alerts:p.alerts}];
  });
  const days=[];
  for(let day=params.from;day<=params.to;day=nextDay(day)) {
    const a=midnight(day,params.zone),b=midnight(nextDay(day),params.zone);
    const periods=visits.filter(v=>v.start<b&&v.end>a).map(v=>({ref:v.ref,start:Math.max(a,begin,v.start),end:Math.min(b,finish,v.end),originalStart:v.start,originalEnd:v.end,alerts:v.alerts}));
    const seen=observations.filter(p=>p.time>=a&&p.time<b), available=records.some(r=>r.start<b&&r.end>=a)||points.some(p=>p.time>=a&&p.time<b);
    const alerts=[...periods.flatMap(p=>p.alerts),...seen.flatMap(p=>p.alerts),...records.filter(r=>r.start<b&&r.end>=a).flatMap(r=>r.alerts)];
    days.push({day,periods,firstPosition:seen[0]?.time??null,lastPosition:seen.at(-1)?.time??null,durationMs:periods.length?unionDuration(periods):null,status:periods.length?'Presença segundo visitas interpretadas pelo Google':seen.length?'Posições no local; permanência não apurável':available?'Dados insuficientes para determinar a presença':'Sem registros disponíveis',refs:[...new Set([...periods.map(p=>p.ref),...seen.map(p=>p.ref)])],alerts,notes:periods.some(p=>p.start!==p.originalStart||p.end!==p.originalEnd)?'Intervalo recortado aos limites do dia ou do período selecionado.':''});
  }
  const boundaryRefs=new Set(observations.flatMap(o=>[o.arrivalRef,o.departureRef]).filter(Boolean));
  const minimum=list=>list.reduce((best,p)=>Math.min(best,distance(p,params.area)),Infinity);
  const finite=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
  const diagnostics={parsing:data.parsing,visitsInPeriod:records.filter(r=>r.type==='Visita interpretada pelo Google').length,visitsWithCoordinatesInPeriod:records.filter(r=>r.type==='Visita interpretada pelo Google'&&r.point).length,positionsInPeriod:points.length,visitsInArea:visits.length,positionsInArea:observations.length,nearestVisitMeters:finite(minimum(records.filter(r=>r.type==='Visita interpretada pelo Google'&&r.point).map(r=>r.point))),nearestPositionMeters:finite(minimum(points.map(p=>p.point))),radiusMeters:params.area.radius};
  return {appVersion:VERSION,rulesVersion:RULES,params,coverage:data.coverage,diagnostics,days,records,points:points.filter(p=>p.within||boundaryRefs.has(p.ref)),observations,limitations:[ABSENCE,'Os períodos identificados podem não representar toda a permanência. Presença não equivale a tempo de trabalho.',HASH_NOTICE,'Critérios de intervenção são experimentais, não universais. Correções podem ser legítimas. Edições diretas do JSON e exclusões sem vestígios podem não ser detectadas.','Horários de visitas são interpretações do Google. Posições isoladas não demonstram permanência contínua. Intervalos estimados não são horários exatos.','Histórico local não é inviolável e não certifica cadeia de custódia anterior à importação.']};
}
