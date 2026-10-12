const express = require('express');
const cors = require('cors');
const rTracer = require('cls-rtracer');
const helmet = require('helmet');
const morganLogger = require('./config/morgan');
const compression = require('compression');

// JSON API with CORS; no cookie/session auth, so CSRF tokens are not applicable.
// nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
const app = express();

// middleware to trace request throughout request lifespan via request id; used to tie logs together
app.use(rTracer.expressMiddleware());

// redirect from HTTP to HTTPS if in production environment
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// middleware for http request logging via morgan and winston configs
app.use(morganLogger.successHandler);
app.use(morganLogger.warningHandler);
app.use(morganLogger.errorHandler);

app.use(
    helmet({
        contentSecurityPolicy: false,
        // allows app to be embedded on other sites
        frameguard: false,
    }),
);
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const emailsRouter = require('./routes/emails');
const healthRouter = require('./routes/health');

app.use('/api/emails', emailsRouter);
app.use('/health', healthRouter);

module.exports = app;
