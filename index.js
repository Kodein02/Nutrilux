const roleMap = require('./roleMap');
require('dotenv').config();
const express = require('express');
const app = express();
app.get('/', (req, res) => {
    res.send('Nutrilux server running 🚀');
});
app.use(express.json());

app.post("/webhooks/seal", (req, res) => {
    console.log("Webhook received:", req.body);
    res.status(200).send("ok");
});

app.listen(3000, () => console.log("Running on port 3000"));