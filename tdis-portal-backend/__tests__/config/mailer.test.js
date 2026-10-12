jest.mock('nodemailer', () => ({
    createTransport: jest.fn(() => ({})),
}));

jest.mock('email-templates', () =>
    jest.fn().mockImplementation(() => ({
        send: jest.fn().mockResolvedValue(undefined),
    })),
);

const MAIL_USER = 'user@example.com';
const TO_EMAIL = 'to@example.com';

describe('config/mailer', () => {
    let nodemailer;
    let Email;

    beforeEach(() => {
        jest.resetModules();
        nodemailer = require('nodemailer');
        Email = require('email-templates');
        nodemailer.createTransport.mockClear();
        nodemailer.createTransport.mockReturnValue({});
        Email.mockClear();
        process.env.MAIL_SERVER = 'smtp.example.com';
        process.env.MAIL_PORT = '587';
        process.env.MAIL_USERNAME = MAIL_USER;
        process.env.MAIL_DISPLAY_NAME = 'TDIS';
        process.env.MAIL_REPLY_TO = 'reply@example.com';
        process.env.MAIL_PASSWORD = 'secret';
    });

    it('creates transport and sends template email', async () => {
        const mailer = require('../../config/mailer');
        await mailer.sendEmail(TO_EMAIL, ['bcc@example.com'], 'tpl', { a: 1 }, [
            { filename: 'f.txt' },
        ]);
        expect(nodemailer.createTransport).toHaveBeenCalledWith(
            expect.objectContaining({
                host: 'smtp.example.com',
                port: '587',
                secure: false,
                auth: { user: MAIL_USER, pass: 'secret' },
            }),
        );
        const instance = Email.mock.results[0].value;
        expect(instance.send).toHaveBeenCalledWith(
            expect.objectContaining({
                template: 'tpl',
                message: expect.objectContaining({
                    from: `TDIS <${MAIL_USER}>`,
                    replyTo: 'reply@example.com',
                    to: TO_EMAIL,
                    bcc: ['bcc@example.com'],
                    attachments: [{ filename: 'f.txt' }],
                }),
                locals: { a: 1 },
            }),
        );
    });

    it('uses secure transport when MAIL_PORT is 465', async () => {
        process.env.MAIL_PORT = '465';
        jest.resetModules();
        nodemailer = require('nodemailer');
        Email = require('email-templates');
        nodemailer.createTransport.mockReturnValue({});
        const mailer = require('../../config/mailer');
        await mailer.sendEmail(TO_EMAIL, [], 'tpl', {});
        expect(nodemailer.createTransport).toHaveBeenCalledWith(
            expect.objectContaining({
                port: '465',
                secure: true,
            }),
        );
    });

    it('defaults attachments to empty array when omitted', async () => {
        const mailer = require('../../config/mailer');
        await mailer.sendEmail(TO_EMAIL, [], 'tpl', {});
        const instance = Email.mock.results[0].value;
        expect(instance.send).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.objectContaining({
                    attachments: [],
                }),
            }),
        );
    });
});
