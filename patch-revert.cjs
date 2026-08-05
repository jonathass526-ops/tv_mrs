const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Remove import { createServer as createViteServer } from 'vite';
code = code.replace("import { createServer as createViteServer } from 'vite';\n", "");

// Replace the end of the file
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Slideshow Server running on port \${PORT} (Ready for requests)\`);
  });

  const gracefulShutdown = (signal) => {
    console.log(\`Received \${signal}. Closing HTTP server gracefully...\`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Forced shutdown after 5s timeout.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

startServer().catch((err) => {
  console.error('Failed to start full-stack server:', err);
});
`;

code = code.replace(/  \} else \{\n    \/\/ In development, hook up Vite middleware[\s\S]*$/, newEnd);

fs.writeFileSync('server.ts', code);
console.log('done');
