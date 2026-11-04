import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {fetchSuggestions} from './locations.js';
export function mountMap({onSelect,onInvalidate}){
  const $=id=>document.getElementById(id);
  const hosted=!globalThis.GEOPROVA_STANDALONE&&/^https?:$/.test(location.protocol);
  let map,marker,circle,selected,timer,controller,sequence=0,chosenText='',lastRequest=0;
  const cache=new Map();
  const status=text=>{$('mapStatus').textContent=text;};
  function clearList(){$('addressResults').replaceChildren();$('address').setAttribute('aria-expanded','false');}
  function showMap(point){
    $('onlineMap').hidden=false;
    if(!map){
      map=L.map('map',{scrollWheelZoom:false}).setView(point,18);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map).on('tileerror',()=>{$('tileStatus').textContent='As imagens do mapa não carregaram. O ponto selecionado continua aplicado; o provedor de imagens pode estar bloqueado ou indisponível.';});
      marker=L.marker(point,{draggable:true,icon:L.divIcon({className:'workplace-pin',html:'<span></span>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map);
      circle=L.circle(point,{radius:+$('radius').value,color:'#22624e',fillOpacity:.18}).addTo(map);
      marker.on('dragend',()=>{const p=marker.getLatLng();select({lat:p.lat,lng:p.lng},'Ponto ajustado no mapa');});
      map.on('click',e=>select(e.latlng,'Ponto selecionado no mapa'));
    }
    marker.setLatLng(point).setOpacity(1);circle.setLatLng(point).setRadius(+$('radius').value);map.setView(point,18);requestAnimationFrame(()=>map.invalidateSize());
  }
  function select(point,label){
    const lat=point.lat,lon=point.lon??point.lng;if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return;
    selected={lat,lon};$('lat').value=lat.toFixed(7);$('lon').value=lon.toFixed(7);$('selectedPlace').textContent=label;onSelect(label);showMap([lat,lon]);
  }
  function choose(row){
    sequence++;controller?.abort();clearTimeout(timer);chosenText=row.label;$('address').value=row.label;clearList();select(row,row.label);status('Local aplicado automaticamente. Confira o marcador e o raio e confirme o estabelecimento.');
  }
  function render(rows){
    clearList();$('address').setAttribute('aria-expanded',String(rows.length>0));
    rows.forEach(row=>{const option=document.createElement('button');option.type='button';option.className='address-result secondary';option.setAttribute('role','option');option.textContent=row.label;option.onclick=()=>choose(row);$('addressResults').append(option);});
  }
  async function search(explicit=false){
    const query=$('address').value.trim();if(query.length<3){status('Digite pelo menos três caracteres e inclua a cidade para refinar.');clearList();return;}
    const request=++sequence;controller?.abort();controller=new AbortController();const activeController=controller,signal=activeController.signal;
    if(!cache.has(query)&&Date.now()-lastRequest<1000){timer=setTimeout(()=>{if(request===sequence)search(explicit);},1000-(Date.now()-lastRequest));return;}
    let timeout;status('Buscando sugestões…');
    try{
      let rows=cache.get(query);
      if(!rows){lastRequest=Date.now();timeout=setTimeout(()=>activeController.abort(),12000);rows=await fetchSuggestions(query,{hosted,signal});if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(query,rows);}
      if(request!==sequence||signal.aborted)return;
      if(explicit&&rows.length===1){choose(rows[0]);return;}
      render(rows);status(rows.length?'Selecione uma sugestão para mostrar o local no mapa.':'Nenhum resultado encontrado. Inclua nome, rua, cidade e estado. A cobertura depende dos dados do OpenStreetMap.');
    }catch(error){
      if(request!==sequence)return;
      clearList();status(error.name==='AbortError'?'O serviço demorou a responder. Tente novamente.':error.status?error.message:'O navegador não conseguiu consultar as sugestões. Pode ser bloqueio do HTML local/CORS ou indisponibilidade do serviço; isso não comprova falta de Internet. Para evitar bloqueio do arquivo local, use a versão hospedada com busca no mesmo site.');
    }finally{clearTimeout(timeout);}
  }
  $('address').oninput=()=>{
    clearTimeout(timer);sequence++;controller?.abort();clearList();
    if($('address').value!==chosenText){selected=null;$('lat').value=$('lon').value='';$('selectedPlace').textContent='Escolha uma sugestão para definir o local.';marker?.setOpacity(.35);onInvalidate();}
    if($('address').value.trim().length>=3)timer=setTimeout(()=>search(),700);else status('Digite endereço ou nome do estabelecimento.');
  };
  $('address').onkeydown=e=>{if(e.key==='Escape'){sequence++;controller?.abort();clearTimeout(timer);clearList();}if(e.key==='ArrowDown'){const first=$('addressResults').querySelector('button');if(first){e.preventDefault();first.focus();}}if(e.key==='Enter'){e.preventDefault();clearTimeout(timer);search(true);}};
  $('addressResults').onkeydown=e=>{const options=[...$('addressResults').querySelectorAll('button')],i=options.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();options[(i+(e.key==='ArrowDown'?1:options.length-1))%options.length]?.focus();}if(e.key==='Escape'){$('address').focus();clearList();}};
  $('search').onclick=()=>{clearTimeout(timer);search(true);};
  $('radius').addEventListener('input',()=>circle?.setRadius(+$('radius').value));
  for(const id of ['lat','lon'])$(id).addEventListener('input',()=>{const lat=+$('lat').value,lon=+$('lon').value;if($('lat').value&&$('lon').value&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180)select({lat,lon},'Local informado manualmente');});
}
