const express = require('express');
const request = require('supertest');

jest.mock('../../config/mailer', () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const emailsRouter = require('../../routes/emails');
const mailer = require('../../config/mailer');

describe('routes/emails', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
        app = express();
        app.use(express.json());
        app.use('/api/emails', emailsRouter);
    });

    it('POST /send-email forwards to controller behavior', async () => {
        const res = await request(app).post('/api/emails/send-email').send({
            userEmail: 'a@b.com',
        });
        expect(res.status).toBe(200);
        expect(mailer.sendEmail).toHaveBeenCalled();
    });

    it('POST /subscribe-user-request forwards to controller behavior', async () => {
        const res = await request(app)
            .post('/api/emails/subscribe-user-request')
            .send({ emailAddress: 'sub@b.com' });
        expect(res.status).toBe(200);
        expect(mailer.sendEmail).toHaveBeenCalled();
    });
});
