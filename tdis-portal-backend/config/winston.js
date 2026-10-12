// winston configuration for application logging

require('dotenv').config();
const NODE_ENV = process.env.NODE_ENV || 'development';
const { createLogger, format, transports } = require('winston');
const rTracer = require('cls-rtracer');

const addReqIdToJson = format(logObject => {
    logObject.reqId = rTracer.id();
    return logObject;
})();

// define the custom settings for each transport (file, console)
const options = {
    console: {
        // format with as text for local development, format as json for other envs
        format:
            NODE_ENV === 'development'
                ? format.combine(
                      format.colorize(),
                      format.splat(),
                      format.printf(logObject => {
                          return `${
                              logObject.level
                          }: [${new Date().toISOString()}] [reqId: ${rTracer.id()}] ${
                              logObject.message
                          } \n${JSON.stringify(logObject)}`;
                      }),
                  )
                : format.combine(addReqIdToJson, format.json()),
        silent: NODE_ENV === 'test' ? true : false,
    },
    debugConsole: {
        // format as text (easier to read error stack)
        format: format.combine(
            format.colorize(),
            format.splat(),
            format.printf(logObject => {
                return `${logObject.level}: ${
                    NODE_ENV === 'development' ? `[${new Date().toISOString()}] ` : ''
                }[reqId: ${rTracer.id()}] ${logObject.message}`;
            }),
        ),
        silent: NODE_ENV === 'test' ? true : false,
    },
};

// logger for extended debug logs
const debugLogger = createLogger({
    level: 'debug',
    transports: [new transports.Console(options.debugConsole)],
    handleExceptions: true,
    exitOnError: false,
});

// logger
const logger = createLogger({
    level: 'info',
    transports: [new transports.Console(options.console)],
    handleExceptions: true,
    exitOnError: false,
});

// additional logger function that includes extended logs for errors when called; should be used as default for logging errors
logger.errorWithDebug = async (message, error, logObject) => {
    logObject.error = `${error.name}: ${error.message}`;
    logger.error(message, logObject);
    debugLogger.debug(error.stack);
};

// return base object used for logs;
const structureBaseLogObject = (location, url, pid) => {
    return { location, url, pid };
};

module.exports = {
    logger,
    debugLogger,
    structureBaseLogObject,
};
