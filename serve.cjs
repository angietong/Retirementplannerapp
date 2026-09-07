// Minimal zero-dependency static server compatible with Node.js 12, 14, 16, 18, 20, and 22+
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DIST_DIR = fs.existsSync(path.join(__dirname, 'standalone'))
  ? path.join(__dirname, 'standalone')
  : path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer(function (req, res) {
  const reqUrl = req.url.split('?')[0];
  let safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  let filePath = path.join(DIST_DIR, safePath);

  fs.stat(filePath, function (err, stats) {
    if (err || !stats.isFile()) {
      // SPA Fallback: serve dist/index.html
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, function (readErr, content) {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error: ' + readErr.message);
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('====================================================');
  console.log('Retirement Financial Planner running locally!');
  console.log('Open in Safari: http://localhost:' + PORT);
  console.log('====================================================');
});
