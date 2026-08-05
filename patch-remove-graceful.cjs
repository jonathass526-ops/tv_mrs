const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newEnd = `  } else {
    // In development, hook up Vite middleware
    console.log('Starting server in development mode with Vite middleware...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
        
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Slideshow Server running on port \${PORT} (Ready for requests)\`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start full-stack server:', err);
});
`;

code = code.replace(/  \} else \{\n    \/\/ In development, hook up Vite middleware[\s\S]*$/, newEnd);
fs.writeFileSync('server.ts', code);
console.log('done');
