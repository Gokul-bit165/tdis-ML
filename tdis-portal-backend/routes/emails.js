const express = require('express');
const router = express.Router();
const emailsController = require('../controllers/emailsController');

// send an email with the feedback from the "contact us" form
// expects feedback form fields: userName, userEmail, and message
router.post('/send-email', emailsController.sendEmail);

// send a subscribe-user request email to idrt@tamu.edu
// expects emailAddress field in the request body
router.post('/subscribe-user-request', emailsController.sendSubscribeUserRequest);

module.exports = router;
