const express = require('express');
const router = express.Router();

router.get('/', (_, res) => {
    return res.status(200).json({ status: 'ok', message: 'Service is healthy' });
});

module.exports = router;
