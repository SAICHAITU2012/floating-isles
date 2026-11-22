import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/saichaitu/.gemini/antigravity/scratch/ss-portfolio-floating-islands-experiment';

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(ROOT, safePath === '/' ? 'index.html' : safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const isAsset = ext === '.glb' || ext === '.wasm' || ext === '.png' || ext === '.jpg' || ext === '.svg';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': isAsset ? 'public, max-age=86400' : 'no-cache',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(8099, '0.0.0.0', () => {
  console.log('Production static server running on http://0.0.0.0:8099');
});
