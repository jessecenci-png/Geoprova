import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSuggestions,parseSuggestions,suggestionURL} from '../src/locations.js';
const feature={geometry:{coordinates:[-46,-23]},properties:{name:'Loja exemplo',street:'Rua A',housenumber:'10',city:'São Paulo'}};
test('busca por nome/endereço retorna coordenadas sem chave e sem parse da página de mapa',async()=>{
 const calls=[];const rows=await fetchSuggestions('Loja exemplo, São Paulo',{fetcher:async(url,options)=>{calls.push(url);assert.equal(options.credentials,'omit');return {ok:true,json:async()=>({features:[feature]})};}});assert.equal(rows[0].lat,-23);assert.equal(rows[0].lon,-46);assert.match(rows[0].label,/Loja exemplo/);assert.match(rows[0].address,/Rua A 10/);assert.equal(new URL(calls[0]).searchParams.get('q'),'Loja exemplo, São Paulo');assert.equal(new URL(calls[0]).searchParams.has('key'),false);
});
test('modo hospedado consulta somente API do próprio site',()=>assert.equal(suggestionURL('Rua A',true),'/api/places?q=Rua+A'));
test('serviço inválido ou coordenadas impossíveis não geram estabelecimento',()=>{
 assert.throws(()=>parseSuggestions({}));assert.deepEqual(parseSuggestions({features:[{geometry:{coordinates:[181,91]}}]}),[]);
});
test('limite e falha de serviço não afirmam ausência de Internet',async()=>{
 await assert.rejects(fetchSuggestions('Rua A',{fetcher:async()=>({ok:false,status:429})}),/limite/);
});
