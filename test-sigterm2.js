process.on('SIGTERM', () => {
  console.log('Caught SIGTERM, exiting with code 0');
  process.exit(0);
});
setTimeout(() => {}, 10000);
