const https = require('https');

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.log("No GOOGLE_API_KEY");
  process.exit(1);
}

const folderId = '1K10tFckXEG_2IF4knfMaezexpulzYta2'; // from previous curl
const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&key=${apiKey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode, data));
});
