const throng = require('throng');
require('dotenv').config();

const WORKERS = process.env.WEB_CONCURRENCY || 1;
const PORT = process.env.PORT || 8080;

// worker manager
throng(
    {
        worker: start,
        count: WORKERS,
        lifetime: Infinity,
    },
    start,
);

// app is separated from server so that it can be used by mocha test, etc.
function start() {
    const app = require('./app');

    app.listen(PORT, () => {
        console.log('Server is running on %s', PORT);
    });
}
