const { logger, structureBaseLogObject } = require('../config/winston');
const process = require('process');
const mailer = require('../config/mailer');

require('dotenv').config();
const CONTACT_US_FORM_EMAIL_ADDRESS = process.env.CONTACT_US_FORM_EMAIL_ADDRESS;
const SUBSCRIBE_USER_REQUEST_EMAIL_ADDRESS = process.env.SUBSCRIBE_USER_REQUEST_EMAIL_ADDRESS;

exports.sendEmail = async (req, res) => {
    const baseCodeLocation = 'emailsController.sendEmail';
    const baseLogObject = structureBaseLogObject(baseCodeLocation, req.originalUrl, process.pid);

    if (!req.body.userEmail) {
        return res.status(400).json({
            msg: 'Please provide the user email address',
        });
    }

    try {
        await mailer.sendEmail(CONTACT_US_FORM_EMAIL_ADDRESS, [], 'contactusform', {
            userEmail: req.body.userEmail,
            userName: req.body.userName || null,
            message: req.body.message || null,
        });
    } catch (error) {
        const message = 'Error sending contact us form email';

        logger.errorWithDebug(message, error, {
            ...baseLogObject,
            reqBody: req.body,
        });

        return res.status(500).json({
            msg: message,
            error: error.message,
        });
    }

    return res.status(200).json({
        msg: 'Contact us form email successfully sent',
    });
};

exports.sendSubscribeUserRequest = async (req, res) => {
    const baseCodeLocation = 'emailsController.sendSubscribeUserRequest';
    const baseLogObject = structureBaseLogObject(baseCodeLocation, req.originalUrl, process.pid);

    if (!req.body.emailAddress) {
        return res.status(400).json({
            msg: 'Please provide the email address',
        });
    }

    try {
        await mailer.sendEmail(SUBSCRIBE_USER_REQUEST_EMAIL_ADDRESS, [], 'subscribeuserrequest', {
            emailAddress: req.body.emailAddress,
        });
    } catch (error) {
        const message = 'Error sending subscribe-user request email';

        logger.errorWithDebug(message, error, {
            ...baseLogObject,
            reqBody: req.body,
        });

        return res.status(500).json({
            msg: message,
            error: error.message,
        });
    }

    return res.status(200).json({
        msg: 'Subscribe-user request email successfully sent',
    });
};
