import {defineConfig} from 'vite';
import {createApp} from './server.mjs';
function locationProxy(server){const app=createApp();server.middlewares.use((req,res,next)=>req.url?.startsWith('/api/')?app(req,res):next());}
export default defineConfig({plugins:[{name:'local-location-proxy',configureServer:locationProxy,configurePreviewServer:locationProxy}]});
