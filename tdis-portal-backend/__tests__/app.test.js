const request = require('supertest');

const SEND_EMAIL_PATH = '/api/emails/send-email';
const SUBSCRIBE_PATH = '/api/emails/subscribe-user-request';
const USER_EMAIL = 'user@example.com';
const NEW_SUBSCRIBER_EMAIL = 'new@example.com';

jest.mock('../config/mailer', () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('app', () => {
    let app;
    let mailer;

    beforeEach(() => {
        jest.resetModules();
        mailer = require('../config/mailer');
        mailer.sendEmail.mockResolvedValue(undefined);
        app = require('../app');
    });

    describe('routes', () => {
        it('returns health payload on GET /health', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                status: 'ok',
                message: 'Service is healthy',
            });
        });

        it('rejects contact email when userEmail is missing', async () => {
            const res = await request(app).post(SEND_EMAIL_PATH).send({});
            expect(res.status).toBe(400);
            expect(res.body.msg).toBe('Please provide the user email address');
            expect(mailer.sendEmail).not.toHaveBeenCalled();
        });

        it('sends contact email when userEmail is provided', async () => {
            const res = await request(app).post(SEND_EMAIL_PATH).send({
                userEmail: USER_EMAIL,
                userName: 'Test User',
                message: 'Hello',
            });
            expect(res.status).toBe(200);
            expect(res.body.msg).toBe('Contact us form email successfully sent');
            expect(mailer.sendEmail).toHaveBeenCalledWith(
                process.env.CONTACT_US_FORM_EMAIL_ADDRESS,
                [],
                'contactusform',
                {
                    userEmail: USER_EMAIL,
                    userName: 'Test User',
                    message: 'Hello',
                },
            );
        });

        it('uses null for optional contact fields when omitted', async () => {
            await request(app).post(SEND_EMAIL_PATH).send({
                userEmail: 'only@example.com',
            });
            expect(mailer.sendEmail).toHaveBeenCalledWith(
                process.env.CONTACT_US_FORM_EMAIL_ADDRESS,
                [],
                'contactusform',
                {
                    userEmail: 'only@example.com',
                    userName: null,
                    message: null,
                },
            );
        });

        it('returns 500 when contact email send fails', async () => {
            mailer.sendEmail.mockRejectedValueOnce(new Error('smtp down'));
            const res = await request(app).post(SEND_EMAIL_PATH).send({
                userEmail: USER_EMAIL,
            });
            expect(res.status).toBe(500);
            expect(res.body.msg).toBe('Error sending contact us form email');
            expect(res.body.error).toBe('smtp down');
        });

        it('rejects subscribe request when emailAddress is missing', async () => {
            const res = await request(app).post(SUBSCRIBE_PATH).send({});
            expect(res.status).toBe(400);
            expect(res.body.msg).toBe('Please provide the email address');
            expect(mailer.sendEmail).not.toHaveBeenCalled();
        });

        it('sends subscribe-user request email when emailAddress is provided', async () => {
            const res = await request(app)
                .post(SUBSCRIBE_PATH)
                .send({ emailAddress: NEW_SUBSCRIBER_EMAIL });
            expect(res.status).toBe(200);
            expect(res.body.msg).toBe('Subscribe-user request email successfully sent');
            expect(mailer.sendEmail).toHaveBeenCalledWith(
                process.env.SUBSCRIBE_USER_REQUEST_EMAIL_ADDRESS,
                [],
                'subscribeuserrequest',
                { emailAddress: NEW_SUBSCRIBER_EMAIL },
            );
        });

        it('returns 500 when subscribe email send fails', async () => {
            mailer.sendEmail.mockRejectedValueOnce(new Error('queue full'));
            const res = await request(app)
                .post(SUBSCRIBE_PATH)
                .send({ emailAddress: NEW_SUBSCRIBER_EMAIL });
            expect(res.status).toBe(500);
            expect(res.body.msg).toBe('Error sending subscribe-user request email');
            expect(res.body.error).toBe('queue full');
        });
    });
});

describe('app production HTTPS redirect', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        jest.resetModules();
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.resetModules();
    });

    it('redirects to HTTPS when X-Forwarded-Proto is not https', async () => {
        process.env.NODE_ENV = 'production';
        const prodApp = require('../app');
        const res = await request(prodApp)
            .get('/health')
            .set('Host', 'api.example.com')
            .set('X-Forwarded-Proto', 'http');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('https://api.example.com/health');
    });

    it('does not redirect when X-Forwarded-Proto is https', async () => {
        process.env.NODE_ENV = 'production';
        const prodApp = require('../app');
        const res = await request(prodApp).get('/health').set('X-Forwarded-Proto', 'https');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});
