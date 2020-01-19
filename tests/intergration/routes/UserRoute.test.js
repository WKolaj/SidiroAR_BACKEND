const EmailService = require("../../../services/EmailService");
const { snooze } = require("../../../utilities/utilities");
const _ = require("lodash");
const request = require("supertest");
const bcrypt = require("bcrypt");
const config = require("config");
const jsonWebToken = require("jsonwebtoken");
let { User } = require("../../../models/user");
let {
  generateTestAdmin,
  generateTestUser,
  generateTestAdminAndUser,
  generateUselessUser
} = require("../../utilities/testUtilities");
let { exists } = require("../../../utilities/utilities");
let server;

//mocking email service
let sendMailMockFunction = jest.fn(
  async (recipient, subject, htmlContent) => {}
);
EmailService.sendMail = sendMailMockFunction;

describe("/api/users", () => {
  let uselessUser;
  let testAdmin;
  let testUser;
  let testUserAndAdmin;

  beforeEach(async () => {
    //Clearing number of mock function calls
    sendMailMockFunction.mockClear();

    server = await require("../../../startup/app")();

    //Clearing users in database before each test
    await User.deleteMany({});

    //generating uslessUser, user, admin and adminUser
    uselessUser = await generateUselessUser();
    testAdmin = await generateTestAdmin();
    testUser = await generateTestUser();
    testUserAndAdmin = await generateTestAdminAndUser();
  });

  afterEach(async () => {
    //Clearing users in database after each test
    await User.deleteMany({});

    await server.close();
    sendMailMockFunction.mockClear();
  });

  describe("POST/", () => {
    let requestPayload;
    //jwt used to authenticate when posting
    let jwt;

    beforeEach(async () => {
      requestPayload = {
        email: "1234@abcd.pl",
        name: "testUser",
        permissions: 1,
        password: "4321"
      };

      jwt = await testAdmin.generateJWT();
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .post("/api/users")
          .set(config.get("tokenHeader"), jwt)
          .send(requestPayload);
      else
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
        _id: response.body._id,
        modelIds: [],
        modelNames: []
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (except hashed password)
      let userPayload = _.pick(user, ["email", "name", "permissions"]);
      //Id should be converted to string
      userPayload._id = user._id.toString();
      userPayload.password = requestPayload.password;
      //modelIds and modelNames should be empty - it is new user
      userPayload.modelNames = [];
      userPayload.modelIds = [];

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
        .set(config.get("tokenHeader"), jwt)
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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, created User
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    //#region CHECK_EMAIL

    it("should not create new user and return 400 if email is not defined", async () => {
      delete requestPayload.email;

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if email is null", async () => {
      requestPayload.email = null;

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if email is a empty", async () => {
      requestPayload.email = "";

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if email is a number", async () => {
      requestPayload.email = 123;

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if email is an invalid string", async () => {
      requestPayload.email = "abcd1234";

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    //#endregion CHECK_EMAIL

    //#region CHECK_NAME

    it("should not create new user and return 400 if name is not defined", async () => {
      delete requestPayload.name;

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is null", async () => {
      requestPayload.name = null;

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is a empty", async () => {
      requestPayload.name = "";

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is a number", async () => {
      requestPayload.name = 123;

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is shorter than 3 signs", async () => {
      requestPayload.name = "ab";

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

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
        _id: response.body._id,
        modelIds: [],
        modelNames: []
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (excepted hashed password)
      let userPayload = _.pick(user, ["email", "name", "permissions"]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is longer than 100 signs", async () => {
      //101 signs
      requestPayload.name = Array(102).join("n");

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

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
        _id: response.body._id,
        modelIds: [],
        modelNames: []
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (excepted hashed password)
      let userPayload = _.pick(user, ["email", "name", "permissions"]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];

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
        _id: response.body._id,
        modelIds: [],
        modelNames: []
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (excepted hashed password)
      let userPayload = _.pick(user, ["email", "name", "permissions"]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];

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

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if password is a empty", async () => {
      requestPayload.password = "";

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if password is a number", async () => {
      requestPayload.password = 1234;

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if password is shorter than 4 signs", async () => {
      requestPayload.password = "123";

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

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
        _id: response.body._id,
        modelIds: [],
        modelNames: []
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (excepted hashed password)
      let userPayload = _.pick(user, ["email", "name", "permissions"]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is longer than 4 signs", async () => {
      //5 signs
      requestPayload.password = "12345";

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if password contains letters", async () => {
      //5 signs
      requestPayload.password = "1ab2";

      let response = await exec();

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

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    //#endregion CHECK_PASSWORD

    //#region CHECK_PERMISSIONS

    it("should not create new user and return 400 if permissions is not defined", async () => {
      delete requestPayload.permissions;

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"permissions" is required');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if permissions is null", async () => {
      requestPayload.permissions = null;

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"permissions" must be a number');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if permissions is a empty", async () => {
      requestPayload.permissions = "";

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"permissions" must be a number');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if permissions is a string", async () => {
      requestPayload.permissions = "1abc";

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"permissions" must be a number');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if permissions is smaller than 0", async () => {
      requestPayload.permissions = -1;

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        '"permissions" must be larger than or equal to 0'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and return 200 if permissions is 0", async () => {
      requestPayload.permissions = 0;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with payload (except for password and _id)
      let expectedBody = {
        ...requestPayload,
        password: response.body.password,
        _id: response.body._id,
        modelIds: [],
        modelNames: []
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (excepted hashed password)
      let userPayload = _.pick(user, ["email", "name", "permissions"]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if permissions is greater than 255", async () => {
      requestPayload.permissions = 256;

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        '"permissions" must be less than or equal to 255'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and return 200 if permissions is 255", async () => {
      requestPayload.permissions = 255;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with payload (except for password and _id)
      let expectedBody = {
        ...requestPayload,
        password: response.body.password,
        _id: response.body._id,
        modelIds: [],
        modelNames: []
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (excepted hashed password)
      let userPayload = _.pick(user, ["email", "name", "permissions"]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if permissions is float", async () => {
      requestPayload.permissions = 123.321;

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"permissions" must be an integer');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    //#endregion CHECK_PERMISSIONS

    //#region CHECK_AUTHORIZATION

    it("should not create new user and return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 403 if jwt of user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and return 200 with user payload inside body if jwt of adminAndUser user is given", async () => {
      jwt = await testUserAndAdmin.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with payload (except  _id)
      let expectedBody = {
        ...requestPayload,
        _id: response.body._id,
        modelIds: [],
        modelNames: []
      };

      expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //New user should be saved inside database
      let user = await User.findOne({ _id: response.body._id });
      expect(user).toBeDefined();

      //user payload should be the same to response (except hashed password)
      let userPayload = _.pick(user, ["email", "name", "permissions"]);
      //Id should be converted to string
      userPayload._id = user._id.toString();
      userPayload.password = requestPayload.password;
      //modelIds and modelNames should be empty - it is new user
      userPayload.modelNames = [];
      userPayload.modelIds = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(requestPayload.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if  jwt from different private key was provided", async () => {
      let fakeUserPayload = {
        _id: "abcdefgh",
        email: "fakeUser@testFakeUser.com.pl",
        name: "fakeUser",
        permissions: 3
      };

      jwt = await jsonWebToken.sign(fakeUserPayload, "differentTestPrivateKey");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only four users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(4);

      //#endregion CHECKING_DATABASE
    });

    //#endregion CHECK_AUTHORIZATION
  });
});
