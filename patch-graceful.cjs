const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `  app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Slideshow Server running on port \${PORT} (Ready for requests)\`);
  });
}`;

const replace = `  const server = app.listen(PORT, '0.0.0.0', () => {
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
});`;

code = code.replace(target, replace);
fs.writeFileSync('server.ts', code);
console.log('done');
