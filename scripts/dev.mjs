import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import './build.mjs';
import { localDatabase } from './local-db.mjs';

const { default: worker } = await import('../dist/server/index.js');
mkdirSync('.local', { recursive: true });
const DB = localDatabase('.local/parking.sqlite');
const portFlag = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (portFlag >= 0 ? process.argv[portFlag+1] : 3000));
createServer(async (req,res)=>{
  try {
    const origin = req.headers.origin || 'http://' + req.headers.host;
    const body = [];
    for await (const part of req) body.push(part);
    const response = await worker.fetch(new Request(origin + req.url, {
      method: req.method, headers: req.headers,
      body: ['GET','HEAD'].includes(req.method) ? undefined : Buffer.concat(body)
    }), { DB });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) { console.error(err); res.writeHead(500).end('Local preview error'); }
}).listen(port, '0.0.0.0',()=>console.log('Parking dashboard listening on port '+port));
