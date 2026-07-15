import https from 'https';

const googleApiKey = process.env.GOOGLE_API_KEY;
if (!googleApiKey) {
  console.log("No API key");
  process.exit(1);
}

const url = `https://www.googleapis.com/drive/v3/files/some-id?alt=media&key=${googleApiKey}`;
// We can't really test without a real file ID.
