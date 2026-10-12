const express = require('express');
const request = require('supertest');
const healthRouter = require('../../routes/health');

describe('routes/health', () => {
    let app;

    beforeEach(() => {
        // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
        app = express();
        app.use('/health', healthRouter);
    });

    it('responds with 200 and health JSON on GET /health/', async () => {
        const res = await request(app).get('/health/');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            status: 'ok',
            message: 'Service is healthy',
        });
    });
});
