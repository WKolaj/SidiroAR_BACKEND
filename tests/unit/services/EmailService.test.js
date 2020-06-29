const EmailService = require("../../../services/EmailService/EmailService");
const nodemailer = require("nodemailer");
const config = require("config");
const { snooze } = require("../../../utilities/utilities");
const fs = require("fs");

describe("EmailService", () => {
  describe("sendMail", () => {
    let recipient, subject, htmlContent;

    beforeEach(() => {
      recipient = "1234@abcd.com";
      subject = "test email";
      htmlContent = "<p>test content</p>";
    });

    let exec = async () => {
      return await EmailService.sendMail(recipient, subject, htmlContent);
    };

    it("should send email to given recipient with given subject and given htmlContent", async () => {
      await exec();
      expect(nodemailer.mockSendMailFunction).toHaveBeenCalledTimes(1);

      let expectedTranportSettings = {
        pool: true,
        host: "pricelist.nazwa.pl",
        port: 465,
        secure: true,
        auth: {
          user: config.get("emailLogin"),
          pass: config.get("emailPassword"),
        },
      };
      expect(nodemailer.mockSendMailFunction.mock.calls[0][0]).toEqual(
        expectedTranportSettings
      );

      let expectedMailOptions = {
        from: config.get("emailLogin"),
        to: recipient,
        subject: subject,
        html: htmlContent,
      };
      expect(nodemailer.mockSendMailFunction.mock.calls[0][1]).toEqual(
        expectedMailOptions
      );
    });

    it("should resolve even if there is an error while sending mail", async () => {
      nodemailer.setMockThrowErrorWhileSending(true);

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            return reject(err);
          }
        })
      ).resolves.toBeDefined();
    });
  });

  describe("generateEmailContent", () => {
    let enMailContent;
    let plMailContent;
    let login;
    let password;
    let language;

    beforeEach(() => {
      login = "testLogin";
      language = "pl";

      enMailContent = fs.readFileSync(
        "./services/EmailService/emailTemplate/en.html",
        "UTF-8"
      );

      plMailContent = fs.readFileSync(
        "./services/EmailService/emailTemplate/pl.html",
        "UTF-8"
      );
    });

    let exec = async () => {
      return EmailService.generateEmailContent(login, password, language);
    };

    it("should return valid html content, personlized for given user and language", async () => {
      let content = await exec();

      let expectedContent = plMailContent
        .replace("@PAR_LOGIN", login)
        .replace("@PAR_PIN", password);

      expect(content).toEqual(expectedContent);
    });

    it("should return valid html content, personlized for given user and language - if language is en", async () => {
      language = "en";

      let content = await exec();

      let expectedContent = enMailContent
        .replace("@PAR_LOGIN", login)
        .replace("@PAR_PIN", password);

      expect(content).toEqual(expectedContent);
    });

    it("should throw if there is no language supported", async () => {
      language = "fakeLang";

      let rejectError;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            rejectError = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(rejectError).toBeDefined();
      expect(rejectError.message).toEqual(
        "Unsupported language fakeLang - email content not found"
      );
    });
  });
});
