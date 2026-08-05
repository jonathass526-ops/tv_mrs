process.on('SIGTERM', () => {
  console.log('Caught SIGTERM, exiting gracefully');
  process.exit(0);
});
setInterval(() => {}, 1000);
