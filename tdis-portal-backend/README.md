# TDIS Portal Backend

## Initialization

If this is your first time downloading this project, you'll need to run `npm install` to install the necessary dependencies.

To run the Node backend, run `npm start`. This will start the server at http://localhost:8080

## Environmental Variables

Add a `.env` file to the root of the repository with the following variables:

- `NODE_ENV` = add the environment for express; set to appropriate environment (development, staging, production)
- `CONTACT_US_FORM_EMAIL_ADDRESS` = add the email address where the "Contact Us" form will be sent to (eg. idrt@tamug.edu)
- `MAIL_SERVER` = add the mail server
- `MAIL_PORT` = add the mail port
- `MAIL_USERNAME` = add the mail username
- `MAIL_DISPLAY_NAME` = add a mail display name (eg. M3FR Feedback Form Email)
- `MAIL_REPLY_TO` = add the email address you would like to appear in the reply to field for emails
- `MAIL_PASSWORD` = add the mail password
