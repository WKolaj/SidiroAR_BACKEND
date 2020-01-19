const EmailService = require("../../../services/EmailService");
const { snooze } = require("../../../utilities/utilities");
const _ = require("lodash");
const request = require("supertest");
const bcrypt = require("bcrypt");
let { User } = require("../../../models/user");

let server;

//mocking email service
let sendMailMockFunction = jest.fn(
  async (recipient, subject, htmlContent) => {}
);
EmailService.sendMail = sendMailMockFunction;

describe("/api/users", () => {
  beforeEach(async () => {
    //Clearing number of mock function calls
    sendMailMockFunction.mockClear();

    server = await require("../../../startup/app")();

    //Clearing users in database before each test
    await User.deleteMany({});
  });

  afterEach(async () => {
    //Clearing users in database after each test
    await User.deleteMany({});

    await server.close();
    sendMailMockFunction.mockClear();
  });

  describe("POST/", () => {
    let requestPayload;

    beforeEach(() => {
      requestPayload = {
        email: "1234@abcd.pl",
        name: "testUser",
        permissions: 1,
        password: "4321"
      };
    });

    let exec = async () => {
      return request(server)
        .post("/api/users")
        .send(requestPayload);
    };

    it("should create new user and return 200 with user payload inside body if user payload is valid", async () => {
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with payload (except  _id)
      let expectedBody = {
        ...requestPayload,
        _id: response.body._id
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (except hashed password)
      let userPayload = _.pick(user, [
        "email",
        "name",
        "permissions",
        "modelIds",
        "modelNames"
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = requestPayload.password;
      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(requestPayload.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and send email to user with own payload if user payload is valid", async () => {
      let response = await exec();

      //Waiting for send mail to end - it is not marked as await
      await snooze(200);

      expect(sendMailMockFunction).toHaveBeenCalledTimes(1);

      let expectedMailContent = User.generateEmailText(
        response.body.name,
        response.body.email,
        response.body.password
      );

      expect(sendMailMockFunction.mock.calls[0][0]).toEqual(
        response.body.email
      );
      expect(sendMailMockFunction.mock.calls[0][1]).toEqual(
        "Rejestracja SidiroAR"
      );
      expect(sendMailMockFunction.mock.calls[0][2]).toEqual(
        expectedMailContent
      );
    });

    it("should not create new user and return 400 if user with the same email exists", async () => {
      await exec();

      requestPayload = {
        email: requestPayload.email,
        name: "testUser2",
        permissions: 2
      };

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      //Call only one - during first registration
      expect(sendMailMockFunction).toHaveBeenCalledTimes(1);

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("User already registered");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only one user should be saved inside database
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(1);

      //#endregion CHECKING_DATABASE
    });

    //#region CHECK_EMAIL

    it("should not create new user and return 400 if email is not defined", async () => {
      delete requestPayload.email;

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"email" is required');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if email is null", async () => {
      requestPayload.email = null;

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"email" must be a string');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if email is a empty", async () => {
      requestPayload.email = "";

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"email" is not allowed to be empty');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if email is a number", async () => {
      requestPayload.email = 123;

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"email" must be a string');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if email is an invalid string", async () => {
      requestPayload.email = "abcd1234";

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"email" must be a valid email');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    //#endregion CHECK_EMAIL

    //#region CHECK_NAME

    it("should not create new user and return 400 if name is not defined", async () => {
      delete requestPayload.name;

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"name" is required');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is null", async () => {
      requestPayload.name = null;

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"name" must be a string');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is a empty", async () => {
      requestPayload.name = "";

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"name" is not allowed to be empty');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is a number", async () => {
      requestPayload.name = 123;

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"name" must be a string');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is shorter than 3 signs", async () => {
      requestPayload.name = "ab";

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        '"name" length must be at least 3 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and return 200 if name is 3 signs", async () => {
      //3 signs
      requestPayload.name = "abc";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with payload (except for password and _id)
      let expectedBody = {
        ...requestPayload,
        password: response.body.password,
        _id: response.body._id
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (excepted hashed password)
      let userPayload = _.pick(user, [
        "email",
        "name",
        "permissions",
        "modelIds",
        "modelNames"
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;
      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is longer than 100 signs", async () => {
      //101 signs
      requestPayload.name = Array(102).join("n");

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        '"name" length must be less than or equal to 100 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and return 200 if name is 100 signs", async () => {
      //100 signs
      requestPayload.name = Array(101).join("n");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with payload (except for password and _id)
      let expectedBody = {
        ...requestPayload,
        password: response.body.password,
        _id: response.body._id
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (excepted hashed password)
      let userPayload = _.pick(user, [
        "email",
        "name",
        "permissions",
        "modelIds",
        "modelNames"
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;
      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    //#endregion CHECK_NAME

    //#region CHECK_PASSWORD

    it("should generate new password and create new user and return 200 with user payload inside body if user password is not defined", async () => {
      delete requestPayload.password;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with payload (except for password and _id)
      let expectedBody = {
        ...requestPayload,
        password: response.body.password,
        _id: response.body._id
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (excepted hashed password)
      let userPayload = _.pick(user, [
        "email",
        "name",
        "permissions",
        "modelIds",
        "modelNames"
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;
      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should generate random password and create new user and send email to user with own payload if user payload is valid", async () => {
      delete requestPayload.password;

      let response = await exec();

      //Waiting for send mail to end - it is not marked as await
      await snooze(200);

      expect(sendMailMockFunction).toHaveBeenCalledTimes(1);

      let expectedMailContent = User.generateEmailText(
        response.body.name,
        response.body.email,
        response.body.password
      );

      expect(sendMailMockFunction.mock.calls[0][0]).toEqual(
        response.body.email
      );
      expect(sendMailMockFunction.mock.calls[0][1]).toEqual(
        "Rejestracja SidiroAR"
      );
      expect(sendMailMockFunction.mock.calls[0][2]).toEqual(
        expectedMailContent
      );
    });

    it("should not create new user and return 400 if password is null", async () => {
      requestPayload.password = null;

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"password" must be a string');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if password is a empty", async () => {
      requestPayload.password = "";

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"password" is not allowed to be empty');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if password is a number", async () => {
      requestPayload.password = 1234;

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"password" must be a string');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if password is shorter than 4 signs", async () => {
      requestPayload.password = "123";

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        '"password" length must be at least 4 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and return 200 if password is 4 signs", async () => {
      //4 signs
      requestPayload.password = "1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with payload (except for password and _id)
      let expectedBody = {
        ...requestPayload,
        password: response.body.password,
        _id: response.body._id
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (excepted hashed password)
      let userPayload = _.pick(user, [
        "email",
        "name",
        "permissions",
        "modelIds",
        "modelNames"
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;
      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is longer than 4 signs", async () => {
      //5 signs
      requestPayload.password = "12345";

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        '"password" length must be less than or equal to 4 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if password contains letters", async () => {
      //5 signs
      requestPayload.password = "1ab2";

      await exec();

      let response = await request(server)
        .post("/api/users")
        .send(requestPayload);

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        "fails to match the required pattern: /^\\d+$/"
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(0);

      //#endregion CHECKING_DATABASE
    });

    //#endregion CHECK_PASSWORD
  });
});
