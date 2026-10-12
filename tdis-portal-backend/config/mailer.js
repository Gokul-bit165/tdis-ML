const nodemailer = require('nodemailer');
const Email = require('email-templates');
require('dotenv').config();

const mailServer = process.env.MAIL_SERVER;
const mailPort = process.env.MAIL_PORT;
const mailUsername = process.env.MAIL_USERNAME;
const mailDisplayName = process.env.MAIL_DISPLAY_NAME;
const mailReplyTo = process.env.MAIL_REPLY_TO;
const mailPassword = process.env.MAIL_PASSWORD;

module.exports = {
    sendEmail: (to, bcc, tplName, locals, attachments) => {
        const transporter = nodemailer.createTransport({
            host: mailServer,
            port: mailPort,
            secure: mailPort === '465',
            auth: {
                user: mailUsername,
                pass: mailPassword,
            },
        });

        const email = new Email({
            send: true,
            preview: false,
            transport: transporter,
        });

        return email.send({
            template: tplName,
            message: {
                from: `${mailDisplayName} <${mailUsername}>`,
                replyTo: mailReplyTo,
                to: to,
                bcc: bcc,
                attachments: attachments || [],
            },
            locals: locals,
        });
    },
};
