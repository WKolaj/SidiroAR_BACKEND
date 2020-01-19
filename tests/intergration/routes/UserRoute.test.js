const EmailService = require("../../../services/EmailService");
const { User } = require("../../../models/user");
let request = require("supertest");

let sendMailMockFunction;
let server;

describe("/api/users", () => {
  beforeEach(async () => {
    jest.resetModules();

    //mocking email service
    sendMailMockFunction = jest.fn();
    EmailService.sendMail = sendMailMockFunction;

    server = await require("../../../startup/app")();

    //Clearing users in database before each test
    User.remove({});
  });

  afterEach(() => {
    //Clearing users in database after each test
    User.remove({});
  });

  describe("POST/", () => {
    let userPayload;

    beforeEach(() => {
      userPayload = {
        email: "1234@abcd.pl",
        name: "testUser",
        permissions: 1
      };

      User;
    });

    let exec = async () => {
      return request(server).post(userPayload);
    };

    it("should create and return new user if user payload is valid", async () => {
      let result = await exec();

      expect(result).toBeDefined();
    });
  });
});
