const express = require('express');
const request = require('supertest');
const { logger } = require('../../config/winston');
const morganLogger = require('../../config/morgan');

describe('config/morgan', () => {
    let app;

    beforeEach(() => {
        jest.spyOn(logger, 'info').mockImplementation(() => {});
        jest.spyOn(logger, 'warn').mockImplementation(() => {});
        jest.spyOn(logger, 'error').mockImplementation(() => {});
        // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
        app = express();
        app.use(morganLogger.successHandler);
        app.use(morganLogger.warningHandler);
        app.use(morganLogger.errorHandler);
        app.get('/ok', (req, res) => res.status(200).send('ok'));
        app.get('/client-error', (req, res) => res.status(404).send('nf'));
        app.get('/server-error', (req, res) => res.status(500).send('err'));
        app.get('/slow-ok', async (req, res) => {
            await new Promise(r => setTimeout(r, 60));
            res.status(200).send('slow');
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('logs successful responses at info level', async () => {
        await request(app).get('/ok');
        expect(logger.info).toHaveBeenCalled();
    });

    it('logs 4xx responses at warn level', async () => {
        await request(app).get('/client-error');
        expect(logger.warn).toHaveBeenCalled();
    });

    it('logs 5xx responses at error level', async () => {
        await request(app).get('/server-error');
        expect(logger.error).toHaveBeenCalled();
    });

    it('flags long responses when above LONG_RESPONSE_MS', async () => {
        const prev = process.env.LONG_RESPONSE_MS;
        process.env.LONG_RESPONSE_MS = '30';
        jest.resetModules();
        const morganReloaded = require('../../config/morgan');
        const winstonReloaded = require('../../config/winston');
        jest.spyOn(winstonReloaded.logger, 'info').mockImplementation(() => {});
        // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
        const slowApp = express();
        slowApp.use(morganReloaded.successHandler);
        slowApp.get('/slow', async (req, res) => {
            await new Promise(r => setTimeout(r, 60));
            res.status(200).send('x');
        });
        await request(slowApp).get('/slow');
        const logArg = winstonReloaded.logger.info.mock.calls[0][1];
        const payload = typeof logArg === 'string' ? JSON.parse(logArg) : logArg;
        expect(payload.longResponse).toBe('true');
        process.env.LONG_RESPONSE_MS = prev;
        jest.resetModules();
    });
});
