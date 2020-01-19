const EmailService = require("../../../services/EmailService");
const nodemailer = require("nodemailer");
const config = require("config");
const { snooze } = require("../../../utilities/utilities");

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
        service: "gmail",
        auth: {
          user: config.get("emailLogin"),
          pass: config.get("emailPassword")
        }
      };
      expect(nodemailer.mockSendMailFunction.mock.calls[0][0]).toEqual(
        expectedTranportSettings
      );

      let expectedMailOptions = {
        from: config.get("emailLogin"),
        to: recipient,
        subject: subject,
        html: htmlContent
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
});
