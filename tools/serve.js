import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
export function createServer(){return http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost'),decoded=decodeURIComponent(url.pathname),filename=path.resolve(root,'.'+decoded+(decoded.endsWith('/')?'index.html':''));if(!filename.startsWith(root)||decoded.split('/').some(p=>p.startsWith('.'))){res.writeHead(403).end();return;}const body=await readFile(filename);res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache'}).end(body);}catch{res.writeHead(404).end('Not found');}
});}
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||8080);createServer().listen(port,'127.0.0.1',()=>console.log(`GeezTabletop: http://127.0.0.1:${port}/?sample=1`));}
