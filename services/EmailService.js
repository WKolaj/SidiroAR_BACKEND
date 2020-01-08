const config = require("config");
const nodemailer = require("nodemailer");
const logger = require("../logger/logger");

/**
 * @description Method for sending email
 */
module.exports.sendMail = async function(recipient, subject, htmlContent) {
  return new Promise(async (resolve, reject) => {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: config.get("emailLogin"),
        pass: config.get("emailPassword")
      }
    });

    let mailOptions = {
      from: config.get("emailLogin"),
      to: recipient,
      subject: subject,
      html: htmlContent
    };

    transporter.sendMail(mailOptions, (err, info) => {
      //logging if error occured
      if (err) logger.error(err.message, err);
    });
  });
};
