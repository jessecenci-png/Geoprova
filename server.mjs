import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
export function createApp({fetcher=globalThis.fetch,root=resolve('dist'),minInterval=1000}={}){
  const cache=new Map();let busy=false,last=0;
  const send=(res,status,body,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-store'});res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body));};
  return async(req,res)=>{
    try{
      if(req.method!=='GET'&&req.method!=='HEAD'){req.resume();send(res,405,{error:'Somente leitura.'});return;}
      const url=new URL(req.url,'http://local');
      if(url.pathname==='/api/places'){
        const q=(url.searchParams.get('q')||'').trim();if(q.length<3||q.length>200){send(res,400,{error:'Consulta inválida.'});return;}
        const cached=cache.get(q);if(cached&&Date.now()-cached.time<86400000){send(res,200,cached.data);return;}
        if(busy||Date.now()-last<minInterval){send(res,429,{error:'Aguarde antes de nova busca.'});return;}
        busy=true;last=Date.now();
        try{
          const upstream=new URL('https://photon.komoot.io/api/');upstream.search=new URLSearchParams({q,limit:'6'});
          const response=await fetcher(upstream,{headers:{'User-Agent':'Geoprova/0.5 (https://github.com/jessecenci-png/Geoprova)','Accept':'application/json'},signal:AbortSignal.timeout(12000)});
          if(!response.ok){send(res,response.status===429?429:502,{error:'Serviço de localização indisponível.'});return;}
          const data=await response.json();if(!Array.isArray(data.features))throw Error('Formato inválido');
          if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(q,{time:Date.now(),data});send(res,200,data);
        }catch{send(res,502,{error:'Não foi possível consultar o provedor de localização.'});}finally{busy=false;}
        return;
      }
      if(url.pathname.startsWith('/api/')){send(res,404,{error:'Não encontrado.'});return;}
      const pathname=decodeURIComponent(url.pathname);const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(root+sep)){send(res,403,'Acesso negado.','text/plain');return;}
      const info=await stat(file);if(!info.isFile()){send(res,404,'Não encontrado.','text/plain');return;}
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
      send(res,200,req.method==='HEAD'?'':await readFile(file),mime[extname(file)]||'application/octet-stream');
    }catch{send(res,404,'Não encontrado.','text/plain');}
  };
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
  const port=Number(process.env.PORT||3000);http.createServer(createApp()).listen(port,'0.0.0.0',()=>console.log(`Geoprova iniciado na porta ${port}. Sem upload de histórico ou relatórios.`));
}
