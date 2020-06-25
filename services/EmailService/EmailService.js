const config = require("config");
const nodemailer = require("nodemailer");
const logger = require("../../logger/logger");
const path = require("path");
const { readFileAsync } = require("../../utilities/utilities");

module.exports.generateEmailContent = async function (login, password) {
  const templatePath = path.join(__dirname, "emailTemplate/emailTemplate.html");

  let templateContent = (await readFileAsync(templatePath, "utf8")).toString();

  templateContent = templateContent
    .replace("@PAR_LOGIN", login)
    .replace("@PAR_PIN", password);

  return templateContent;
};

/**
 * @description Method for sending email
 */
module.exports.sendMail = async function (recipient, subject, htmlContent) {
  return new Promise(async (resolve, reject) => {
    let transporter = nodemailer.createTransport({
      pool: config.get("useNodemailerPool"),
      host: config.get("smtpServerURL"),
      port: config.get("smtpServerPort"),
      secure: config.get("useTLS"),
      auth: {
        user: config.get("emailLogin"),
        pass: config.get("emailPassword"),
      },
    });

    let mailOptions = {
      from: config.get("emailLogin"),
      to: recipient,
      subject: subject,
      html: htmlContent,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      //logging if error occured
      if (err) logger.error(err.message, err);

      //Always resolving - in order not to throw without checking with await
      return resolve(info);
    });
  });
};
