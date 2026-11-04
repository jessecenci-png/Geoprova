import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
async function request(app,url,method='GET'){
 const result={};await app({url,method,resume(){}},{writeHead(status,headers){result.status=status;result.headers=headers;},end(body){result.body=body;}});return result;
}
test('proxy encaminha somente consulta ao host fixo, usa cache e não precisa de segredo',async()=>{
 const calls=[];const app=createApp({minInterval:0,fetcher:async(url)=>{calls.push(url);return {ok:true,json:async()=>({features:[]})};}});
 const a=await request(app,'/api/places?q=Rua+A+10'),b=await request(app,'/api/places?q=Rua+A+10');assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(calls.length,1);assert.equal(calls[0].hostname,'photon.komoot.io');assert.equal(calls[0].searchParams.get('q'),'Rua A 10');assert.equal(calls[0].searchParams.has('key'),false);
});
test('proxy rejeita uploads, consultas arbitrárias e volume sem encaminhar dados',async()=>{
 let count=0;const app=createApp({fetcher:async()=>{count++;return {ok:true,json:async()=>({features:[]})};}});
 assert.equal((await request(app,'/api/places?q=abc','POST')).status,405);assert.equal((await request(app,'/api/places?q=ab')).status,400);assert.equal((await request(app,'/api/upload')).status,404);assert.equal(count,0);
 assert.equal((await request(app,'/api/places?q=abc')).status,200);assert.equal((await request(app,'/api/places?q=abcd')).status,429);assert.equal(count,1);
});
test('proxy retorna indisponibilidade sem vazar resposta ou credenciais do provedor',async()=>{
 const app=createApp({fetcher:async()=>{throw Error('private upstream detail');}});const result=await request(app,'/api/places?q=abc');assert.equal(result.status,502);assert.doesNotMatch(result.body,/private upstream/);
});
