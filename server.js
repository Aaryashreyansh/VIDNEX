const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns').promises;
const net = require('node:net');
const { URL } = require('node:url');

const PORT = process.env.PORT || 10000;
const ROOT = __dirname;
const MAX_BYTES = 1024 * 1024 * 1024;
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8'};

function isPrivate(ip) {
  if (net.isIPv4(ip)) {
    const p=ip.split('.').map(Number);
    return p[0]===10 || p[0]===127 || p[0]===0 || (p[0]===169&&p[1]===254) || (p[0]===172&&p[1]>=16&&p[1]<=31) || (p[0]===192&&p[1]===168) || p[0]>=224;
  }
  if (net.isIPv6(ip)) {
    const s=ip.toLowerCase();
    return s==='::1' || s==='::' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80:') || s.startsWith('::ffff:127.') || s.startsWith('::ffff:10.');
  }
  return true;
}
async function safeUrl(raw) {
  let u;
  try { u=new URL(raw); } catch { throw new Error('Valid video URL required.'); }
  if (!['http:','https:'].includes(u.protocol) || u.username || u.password) throw new Error('Only public HTTP/HTTPS video links are supported.');
  if (u.hostname==='localhost' || u.hostname.endsWith('.local')) throw new Error('Private network addresses are not allowed.');
  if (net.isIP(u.hostname)) {
    if (isPrivate(u.hostname)) throw new Error('Private network addresses are not allowed.');
  } else {
    const records=await dns.lookup(u.hostname,{all:true});
    if (!records.length || records.some(x=>isPrivate(x.address))) throw new Error('This host is not a publicly reachable media source.');
  }
  return u;
}
async function remoteFetch(raw, method='GET', headers={}) {
  let u=await safeUrl(raw);
  for(let i=0;i<4;i++) {
    const res=await fetch(u,{method,headers,redirect:'manual',signal:AbortSignal.timeout(25000)});
    if([301,302,303,307,308].includes(res.status)) {
      const loc=res.headers.get('location');
      if(!loc) return res;
      await res.body?.cancel();
      u=await safeUrl(new URL(loc,u).href);
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects from the media host.');
}
function cors(res){res.setHeader('Access-Control-Allow-Origin','https://vidnex-web.onrender.com');res.setHeader('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Range, Content-Type');res.setHeader('Access-Control-Expose-Headers','Content-Length, Content-Range, Accept-Ranges');}
function send(res,status,obj){cors(res);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj));}
const server=http.createServer(async(req,res)=>{
  const base='http://'+(req.headers.host||'localhost');
  const u=new URL(req.url,base);
  if(req.method==='OPTIONS'){cors(res);res.writeHead(204);return res.end();}
  if(u.pathname==='/api/health') return send(res,200,{ok:true,service:'VIDNEX'});
  if(u.pathname==='/api/inspect' && req.method==='GET') {
    try {
      const target=u.searchParams.get('url');
      if(!target) return send(res,400,{error:'Paste a video URL first.'});
      let r=await remoteFetch(target,'HEAD');
      if([403,405,501].includes(r.status)) {
        await r.body?.cancel();
        r=await remoteFetch(target,'GET',{Range:'bytes=0-0'});
      }
      const type=r.headers.get('content-type')||'';
      const length=Number(r.headers.get('content-length')||0);
      const range=(r.headers.get('accept-ranges')||'').toLowerCase()==='bytes' || r.status===206;
      await r.body?.cancel();
      if(!r.ok && r.status!==206) return send(res,422,{error:'The source did not provide a downloadable file (HTTP '+r.status+').'});
      const ext=/\.(mp4|webm|mov|m4v)$/i.test(new URL(target).pathname);
      if(!type.toLowerCase().startsWith('video/') && !ext) return send(res,422,{error:'This is not a direct video file. Paste a direct MP4, WebM, MOV or M4V file URL, not a webpage or social-media post.'});
      if(length>MAX_BYTES) return send(res,413,{error:'This file is larger than the current 1 GB limit.'});
      return send(res,200,{ok:true,type:type||'video file',size:length,range,qualityNote:'The source file is delivered as-is. Quality selection is available only when the source provides separate quality URLs.'});
    } catch(e) { return send(res,400,{error:e.message||'Could not inspect this video link.'}); }
  }
  if(u.pathname==='/api/download' && req.method==='GET') {
    try {
      const target=u.searchParams.get('url');
      if(!target) return send(res,400,{error:'Video URL is missing.'});
      const range=req.headers.range;
      const headers={}; if(range) headers.Range=range;
      const upstream=await remoteFetch(target,'GET',headers);
      if(!upstream.ok && upstream.status!==206) { await upstream.body?.cancel(); return send(res,422,{error:'The source refused the download (HTTP '+upstream.status+').'}); }
      const size=Number(upstream.headers.get('content-length')||0);
      const type=upstream.headers.get('content-type')||'application/octet-stream';
      const ext=/\.(mp4|webm|mov|m4v)$/i.test(new URL(target).pathname);
      if(!type.toLowerCase().startsWith('video/') && !ext) { await upstream.body?.cancel(); return send(res,422,{error:'This URL is not a direct video file.'}); }
      if(size>MAX_BYTES) { await upstream.body?.cancel(); return send(res,413,{error:'This file is larger than the current 1 GB limit.'}); }
      const filename=(new URL(target).pathname.split('/').pop()||'vidnex-video.mp4').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);
      const out={'access-control-allow-origin':'https://vidnex-web.onrender.com','access-control-expose-headers':'Content-Length, Content-Range, Accept-Ranges','content-type':type,'content-disposition':'attachment; filename="'+(filename.includes('.')?filename:'vidnex-video.mp4')+'"','cache-control':'no-store','x-content-type-options':'nosniff'};
      for(const h of ['content-length','content-range','accept-ranges']) { const v=upstream.headers.get(h); if(v) out[h]=v; }
      res.writeHead(upstream.status,out);
      if(!upstream.body) return res.end();
      const reader=upstream.body.getReader();
      let sent=0; try { while(true) { const {done,value}=await reader.read(); if(done) break; sent+=value.byteLength; if(sent>MAX_BYTES) { await reader.cancel(); res.destroy(); return; } if(!res.write(Buffer.from(value))) await new Promise(resolve=>res.once('drain',resolve)); } res.end(); }
      catch { res.destroy(); }
    } catch(e) { if(!res.headersSent) send(res,400,{error:e.message||'Download failed.'}); else res.destroy(); }
    return;
  }
  if(req.method!=='GET' && req.method!=='HEAD') return send(res,405,{error:'Method not allowed.'});
  let file=decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname);
  const full=path.resolve(ROOT,'.'+file);
  if(!full.startsWith(ROOT+path.sep)) return send(res,403,{error:'Forbidden'});
  fs.stat(full,(err,st)=>{
    if(err||!st.isFile()) {res.writeHead(404,{'content-type':'text/plain'});return res.end('Not found');}
    res.writeHead(200,{'content-type':MIME[path.extname(full)]||'application/octet-stream','cache-control':file==='/sw.js'?'no-cache':'public, max-age=300'});
    if(req.method==='HEAD') return res.end();
    fs.createReadStream(full).pipe(res);
  });
});
server.listen(PORT,'0.0.0.0',()=>console.log('VIDNEX server listening on '+PORT));
