const express = require('express');
const path = require('path');
const app = express();
const distPath = path.resolve('./missing-dist');
app.use(express.static(distPath));
app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
app.listen(3001, () => console.log('started'));
