require('dotenv').config();
const http = require('http');
const https = require('https');
const url = `https://www.googleapis.com/drive/v3/files/1CAixuGMtneRvsffD_9r1a240jtAfcELB?alt=media&key=${process.env.GOOGLE_API_KEY}`;

function fetchWithRedirect(targetUrl, redirectCount = 0) {
  const requestMod = targetUrl.startsWith('https:') ? https : http;
  const clientReq = requestMod.get(targetUrl, (apiRes) => {
    console.log('Got', apiRes.statusCode, targetUrl);
    if (apiRes.statusCode >= 300 && apiRes.statusCode < 400 && apiRes.headers.location) {
      console.log('Redirecting to', apiRes.headers.location);
      apiRes.resume();
      let redirectUrl = apiRes.headers.location;
      if (!redirectUrl.startsWith('http')) {
        redirectUrl = new URL(redirectUrl, targetUrl).toString();
      }
      return fetchWithRedirect(redirectUrl, redirectCount + 1);
    }
    // consume body
    apiRes.resume();
  });
  clientReq.on('error', (e) => console.error(e));
}
fetchWithRedirect(url);
