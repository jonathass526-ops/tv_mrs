const https = require('https');
const url = 'https://www.googleapis.com/drive/v3/files/1?alt=media&key=test';
https.request(url, (res) => {
  console.log(res.statusCode, res.headers);
}).end();
