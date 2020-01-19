const nodemailer = require("nodemailer");

let server;

createTransport({
  service: "gmail",
  auth: {
    user: config.get("emailLogin"),
    pass: config.get("emailPassword")
  }
});

describe("/api/users", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe("POST/", () => {
    let userPayload;

    beforeEach(() => {
      userPayload = {
        email: "1234@abcd.pl",
        name: "testUser",
        permissions: 1
      };
    });

    it("should create and return new user if user payload is valid", () => {});
  });
});
