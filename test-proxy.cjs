const express = require('express');
const app = express();
const fetch = require('node-fetch'); // we'll use global fetch

app.get('/media/:id', async (req, res) => {
  const fileId = req.params.id;
  const apiKey = process.env.GOOGLE_API_KEY;
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    res.status(response.status).send('Error');
    return;
  }
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (response.body) {
    const { Readable } = require('stream');
    Readable.fromWeb(response.body).pipe(res);
  }
});
app.listen(3002, () => console.log('started'));
