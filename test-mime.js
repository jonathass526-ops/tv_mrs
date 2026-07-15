const express = require('express');
const app = express();
app.get('*', (req, res) => res.sendFile('/does/not/exist.html'));
app.listen(3002, () => console.log('started'));
