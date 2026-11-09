export function displayDate(iso){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');return match?`${match[3]}-${match[2]}-${match[1]}`:iso;}
export function displayMonth(iso){const match=/^(\d{4})-(\d{2})$/.exec(iso||'');return match?`${match[2]}-${match[1]}`:iso;}
export function weekdayName(day){return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'long'}).format(new Date(day+'T12:00:00Z'));}
export function toMinute(time){return time==null?null:Math.floor(time/60000)*60000;}
export function dayAt(time,zone){const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time));return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');}
export function parseDateInput(value){
  const match=/^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if(!match)throw Error('Informe as datas no formato DD-MM-AAAA.');
  const iso=`${match[3]}-${match[2]}-${match[1]}`,date=new Date(iso+'T12:00:00Z');
  if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==iso)throw Error('Data inválida. Use DD-MM-AAAA.');
  return iso;
}
export function displayTimestamp(time,zone){if(time==null)return 'Não informado';const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZoneName:'short'}).formatToParts(time);const value=key=>parts.find(p=>p.type===key)?.value||'';return `${value('day')}-${value('month')}-${value('year')} ${value('hour')}:${value('minute')}:${value('second')} ${value('timeZoneName')}`;}
