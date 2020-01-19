const { snooze } = require("../utilities/utilities");

let mockThrowErrorWhileSending = false;

//function only for checking valid credentials and mail Options - it does not exist in original class
const mockSendMailFunction = jest.fn((mailOptions, credentails) => {});

class Transport {
  constructor(payload) {
    let self = this;

    this._payload = payload;
    this.sendMail = jest.fn(async (mailOptions, callbackFunction) => {
      await snooze(100);

      mockSendMailFunction(self._payload, mailOptions);

      let error = null;

      if (mockThrowErrorWhileSending)
        error = new Error("Test error while sending email");

      callbackFunction(error, {});

      return null;
    });
  }
}

module.exports.createTransport = transportOptions => {
  return new Transport(transportOptions);
};

module.exports.mockSendMailFunction = mockSendMailFunction;

module.exports.setMockThrowErrorWhileSending = shouldThrow =>
  (mockThrowErrorWhileSending = shouldThrow);
