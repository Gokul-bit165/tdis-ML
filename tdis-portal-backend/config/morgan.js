// morgan configuration for logging http requests

const morgan = require('morgan');
const { logger } = require('./winston.js');

require('dotenv').config();
const LONG_RESPONSE_MS = process.env.LONG_RESPONSE_MS;

morgan.token('message', (req, res) => res.locals.errorMessage || '');

// structures morgan log in a format that can be used by winston logger; adds properties to indicate it's a morgan log
const responseFormat = `{
    "morgan": "true",
    "dateTime": ":date[iso]",
    "method": ":method",
    "url": ":url",
    "httpVersion": ":http-version",
    "status": ":status",
    "contentLength": ":res[content-length]",
    "responseTimeMS": ":response-time",
    "referrer": ":referrer",
    "userAgent": ":user-agent",
    "remoteAddr": ":remote-addr",
    "remoteUser": ":remote-user",
    "message": ":message"
}`;

// checks if http response time exceeds long response threshold; boolean is added to morgan log in handlers below
const checkIfLongResponse = responseTimeMS => {
    if (responseTimeMS == '-') {
        return true;
    } else if (parseInt(responseTimeMS) >= parseInt(LONG_RESPONSE_MS)) {
        return true;
    } else {
        return false;
    }
};

// logs morgan log as info if status code is < 400
const successHandler = morgan(responseFormat, {
    skip: (req, res) => res.statusCode >= 400,
    stream: {
        write: response => {
            let jsonResponse = JSON.parse(response);
            if (checkIfLongResponse(jsonResponse.responseTimeMS)) {
                jsonResponse.longResponse = 'true';
            }
            logger.info(response.message, jsonResponse);
        },
    },
});

// logs morgan log as warning if status code is 400-500
const warningHandler = morgan(responseFormat, {
    skip: (req, res) => res.statusCode >= 500 || res.statusCode < 400,
    stream: {
        write: response => {
            let jsonResponse = JSON.parse(response);
            if (checkIfLongResponse(jsonResponse.responseTimeMS)) {
                jsonResponse.longResponse = 'true';
            }
            logger.warn(response.message, jsonResponse);
        },
    },
});

// logs morgan log as error if status code is >= 500
const errorHandler = morgan(responseFormat, {
    skip: (req, res) => res.statusCode < 500,
    stream: {
        write: response => {
            let jsonResponse = JSON.parse(response);
            if (checkIfLongResponse(jsonResponse.responseTimeMS)) {
                jsonResponse.longResponse = 'true';
            }
            logger.error(response.message, jsonResponse);
        },
    },
});

module.exports = {
    successHandler,
    warningHandler,
    errorHandler,
};
