const http = require('http');

console.log('🔍 Iniciando diagnóstico do servidor...');
console.log('✅ NODE_ENV atual:', process.env.NODE_ENV || 'não definido (usará fallback para produção via .cjs)');
console.log('✅ PORTA configurada no ambiente:', process.env.PORT || 'não definida');

const req = http.get('http://localhost:3000', (res) => {
  console.log(`✅ Teste de conexão local (Porta 3000): Sucesso! Código HTTP: ${res.statusCode}`);
  process.exit(0);
});

req.on('error', (err) => {
  console.log(`❌ Erro ao conectar na porta 3000: O servidor não está rodando no momento. (${err.message})`);
  process.exit(1);
});
