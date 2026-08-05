const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('--- SYSTEM DEBUG INFO ---');
console.log('Node Version:', process.version);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('CWD:', process.cwd());

const distPath = path.resolve(process.cwd(), 'dist');
console.log('Dist path:', distPath, 'Exists?', fs.existsSync(distPath));
if (fs.existsSync(distPath)) {
  console.log('Files in dist:', fs.readdirSync(distPath));
  const indexPath = path.join(distPath, 'index.html');
  console.log('index.html exists in dist?', fs.existsSync(indexPath));
}

console.log('\n--- PORT BINDING TEST ---');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('OK');
});

server.on('error', (err) => {
  console.error('Failed to bind port:', err.message);
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Successfully bound to port 3000. Port is NOT blocked.');
  server.close();
});
