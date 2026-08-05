const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `  // --- Health Check ---
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // --- Serve Frontend and Integrate Vite ---
  const isProduction = process.env.NODE_ENV === 'production' || (process.argv[1] && process.argv[1].endsWith('.cjs'));
  if (isProduction) {
    // In production, serve build assets statically
    let distPath = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      if (fs.existsSync(path.join(process.cwd(), 'index.html'))) {
        distPath = process.cwd();
      } else if (typeof __dirname !== 'undefined' && fs.existsSync(path.join(__dirname, 'index.html'))) {
        distPath = __dirname;
      }
    }
        
    app.use(express.static(distPath));

    // Fallback for Single Page App routing
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('API is running (Frontend build not found)');
      }
    });`;

const original = `  // --- Serve Frontend and Integrate Vite ---
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    // In production, serve build assets statically
    // Ensure we find the correct dist directory whether running from project root or inside dist/
    let distPath = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(path.join(distPath, 'index.html')) && fs.existsSync(path.join(process.cwd(), 'index.html'))) {
      distPath = process.cwd();
    } else if (typeof __dirname !== 'undefined') {
       if (fs.existsSync(path.join(__dirname, 'index.html'))) {
           distPath = __dirname;
       } else if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
           distPath = path.join(__dirname, 'dist');
       }
    }
    
    app.use(express.static(distPath));

    // Fallback for Single Page App routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });`;

code = code.replace(target, original);
fs.writeFileSync('server.ts', code);
console.log('done');
