jest.mock('../../config/mailer', () => ({
    sendEmail: jest.fn(),
}));

jest.mock('../../config/winston', () => {
    const actual = jest.requireActual('../../config/winston');
    return {
        ...actual,
        logger: {
            ...actual.logger,
            errorWithDebug: jest.fn().mockResolvedValue(undefined),
        },
    };
});

const mailer = require('../../config/mailer');
const { logger } = require('../../config/winston');
const emailsController = require('../../controllers/emailsController');

const SEND_EMAIL_PATH = '/api/emails/send-email';
const SUBSCRIBE_PATH = '/api/emails/subscribe-user-request';

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('controllers/emailsController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('sendEmail', () => {
        it('returns 400 when userEmail is missing', async () => {
            const req = { body: {}, originalUrl: SEND_EMAIL_PATH };
            const res = mockRes();
            await emailsController.sendEmail(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                msg: 'Please provide the user email address',
            });
            expect(mailer.sendEmail).not.toHaveBeenCalled();
        });

        it('returns 200 when mailer succeeds', async () => {
            mailer.sendEmail.mockResolvedValue(undefined);
            const req = {
                body: { userEmail: 'u@x.com', userName: 'U', message: 'M' },
                originalUrl: SEND_EMAIL_PATH,
            };
            const res = mockRes();
            await emailsController.sendEmail(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                msg: 'Contact us form email successfully sent',
            });
        });

        it('returns 500 and logs when mailer throws', async () => {
            mailer.sendEmail.mockRejectedValue(new Error('fail'));
            const req = {
                body: { userEmail: 'u@x.com' },
                originalUrl: SEND_EMAIL_PATH,
            };
            const res = mockRes();
            await emailsController.sendEmail(req, res);
            expect(logger.errorWithDebug).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    msg: 'Error sending contact us form email',
                    error: 'fail',
                }),
            );
        });
    });

    describe('sendSubscribeUserRequest', () => {
        it('returns 400 when emailAddress is missing', async () => {
            const req = { body: {}, originalUrl: SUBSCRIBE_PATH };
            const res = mockRes();
            await emailsController.sendSubscribeUserRequest(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                msg: 'Please provide the email address',
            });
        });

        it('returns 200 when mailer succeeds', async () => {
            mailer.sendEmail.mockResolvedValue(undefined);
            const req = {
                body: { emailAddress: 'sub@x.com' },
                originalUrl: SUBSCRIBE_PATH,
            };
            const res = mockRes();
            await emailsController.sendSubscribeUserRequest(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('returns 500 when mailer throws', async () => {
            mailer.sendEmail.mockRejectedValue(new Error('x'));
            const req = {
                body: { emailAddress: 'sub@x.com' },
                originalUrl: SUBSCRIBE_PATH,
            };
            const res = mockRes();
            await emailsController.sendSubscribeUserRequest(req, res);
            expect(logger.errorWithDebug).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
