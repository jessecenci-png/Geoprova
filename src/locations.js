export function parseSuggestions(data){
  if(!data||!Array.isArray(data.features))throw Error('O serviço retornou uma resposta inválida.');
  return data.features.flatMap(feature=>{
    const [lon,lat]=feature.geometry?.coordinates||[],p=feature.properties||{};
    if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return [];
    const title=p.name||[p.street,p.housenumber].filter(Boolean).join(' ')||p.city||'Local sem nome';
    const address=[p.street&&p.name!==p.street?[p.street,p.housenumber].filter(Boolean).join(' '):p.housenumber,p.district,p.city,p.state,p.country].filter(Boolean).join(', ');
    return [{lat,lon,title,address,label:[title,address].filter(Boolean).join(' — '),source:'Photon / OpenStreetMap'}];
  });
}
export function suggestionURL(query,hosted=false){return hosted?'/api/places?'+new URLSearchParams({q:query}):'https://photon.komoot.io/api/?'+new URLSearchParams({q:query,limit:'6'});}
export async function fetchSuggestions(query,{hosted=false,signal,fetcher=globalThis.fetch}={}){
  const response=await fetcher(suggestionURL(query,hosted),{signal,credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin'});
  if(!response.ok){const error=new Error(response.status===429?'O serviço atingiu o limite de consultas. Aguarde e tente novamente.':`O serviço de sugestões não respondeu normalmente (HTTP ${response.status}).`);error.status=response.status;throw error;}
  return parseSuggestions(await response.json());
}
