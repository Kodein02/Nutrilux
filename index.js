const roleMap = require('./roleMap');
require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook/seal', (req, res) => {
    console.log("Webhook received:", req.body);
    res.sendStatus(200);
});

app.listen(3000, () => console.log("Running on port 3000"));