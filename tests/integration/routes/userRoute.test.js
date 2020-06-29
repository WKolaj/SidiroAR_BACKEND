const EmailService = require("../../../services/EmailService/EmailService");
const {
  snooze,
  generateRandomString,
  generateRandomNumberString,
} = require("../../../utilities/utilities");
const _ = require("lodash");
const request = require("supertest");
const bcrypt = require("bcrypt");
const config = require("config");
const jsonWebToken = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");
let { User } = require("../../../models/user");
let { Model } = require("../../../models/model");
let {
  generateTestAdmin,
  generateTestUser,
  generateTestAdminAndUser,
  generateUselessUser,
  generateTestSuperAdmin,
  generateTestModels,
} = require("../../utilities/testUtilities");
let {
  exists,
  hashedStringMatch,
  clearDirectoryAsync,
  createFileAsync,
  checkIfDirectoryExistsAsync,
} = require("../../../utilities/utilities");
let server;
let Project = require("../../../classes/project");
let projectDirPath = Project._getProjectDirPath();
let testDirPath = "__testDir";
let logger = require("../../../logger/logger");

//mocking email service
let sendMailMockFunction = jest.fn(
  async (recipient, subject, htmlContent) => {}
);
EmailService.sendMail = sendMailMockFunction;

describe("/sidiroar/api/user", () => {
  let uselessUser;
  let testAdmin;
  let testUser;
  let testUserAndAdmin;
  let testSuperAdmin;
  let modelsOfUselessUser;
  let modelsOfTestAdmin;
  let modelsOfTestUser;
  let modelsOfTestUserAndAdmin;
  let modelsOfTestSuperAdmin;
  let logActionMock;

  beforeEach(async () => {
    //clearing project directory
    await clearDirectoryAsync(testDirPath);

    //Clearing number of mock function calls
    sendMailMockFunction.mockClear();

    server = await require("../../../startup/app")();

    //Clearing users in database before each test
    await User.deleteMany({});

    //Clearing models
    await Model.deleteMany({});

    //generating uslessUser, user, admin and adminUser
    uselessUser = await generateUselessUser();
    testAdmin = await generateTestAdmin();
    testUser = await generateTestUser();
    testUserAndAdmin = await generateTestAdminAndUser();
    testSuperAdmin = await generateTestSuperAdmin();

    modelsOfUselessUser = await generateTestModels(uselessUser);
    modelsOfTestAdmin = await generateTestModels(testAdmin);
    modelsOfTestUser = await generateTestModels(testUser);
    modelsOfTestUserAndAdmin = await generateTestModels(testUserAndAdmin);
    modelsOfTestSuperAdmin = await generateTestModels(testSuperAdmin);

    //Overwriting logget action method
    logActionMock = jest.fn();
    logger.action = logActionMock;
  });

  afterEach(async () => {
    //Clearing users in database after each test
    await User.deleteMany({});

    //Clearing models
    await Model.deleteMany({});

    await server.close();
    sendMailMockFunction.mockClear();

    //clearing project directory
    await clearDirectoryAsync(testDirPath);
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
        password: "43214321",
        defaultLang: "en",
        additionalInfo: {
          key1: "value1",
          key2: "value2",
          key3: "value3",
        },
      };

      jwt = await testAdmin.generateJWT();
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .post("/sidiroar/api/user")
          .set(config.get("tokenHeader"), jwt)
          .send(requestPayload);
      else
        return request(server).post("/sidiroar/api/user").send(requestPayload);
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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();
      userPayload.password = requestPayload.password;
      //modelIds and modelNames should be empty - it is new user
      userPayload.modelNames = [];
      userPayload.modelIds = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

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

      let expectedMailContent = await User.generateEmailText(
        response.body.name,
        response.body.email,
        response.body.password,
        response.body.defaultLang
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

    it("should create user directory if user payload is valid", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Checking if user directory exists
      let userDirectory = Project._getUserDirPath(response.body);
      let directoryExists = await checkIfDirectoryExistsAsync(userDirectory);

      expect(directoryExists).toEqual(true);

      //checking if file dir exists
      let modelFileDir = Project._getFileDirPath(response.body);
      let modelFileDirExists = await checkIfDirectoryExistsAsync(modelFileDir);

      expect(modelFileDirExists).toEqual(true);

      //checking if file dir for ios exists
      let modelIOSFileDir = Project._getIOSFileDirPath(response.body);
      let modelIOSFileDirExists = await checkIfDirectoryExistsAsync(
        modelIOSFileDir
      );

      expect(modelIOSFileDirExists).toEqual(true);
    });

    it("should call logger action method", async () => {
      let response = await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${testAdmin.email} created user ${requestPayload.email}`
      );
    });

    it("should not create new user and return 400 if user with the same email exists", async () => {
      await exec();

      requestPayload = {
        email: requestPayload.email,
        name: "testUser2",
        permissions: 2,
      };

      let response = await request(server)
        .post("/sidiroar/api/user")
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

      //Only six users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, created User, superTestUser
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(6);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

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

      expect(response.body.password).toBeDefined();

      //Body should correspond with payload (except for password and _id)
      let expectedBody = {
        ...requestPayload,
        password: response.body.password,
        _id: response.body._id,
        modelIds: [],
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

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

      let expectedMailContent = await User.generateEmailText(
        response.body.name,
        response.body.email,
        response.body.password,
        response.body.defaultLang
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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if password is a number", async () => {
      requestPayload.password = 12341234;

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if password is shorter than 8 signs", async () => {
      requestPayload.password = "1234567";

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        '"password" length must be at least 8 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and return 200 if password is 8 signs", async () => {
      //4 signs
      requestPayload.password = "12345678";

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if name is longer than 255 signs", async () => {
      //5 signs
      requestPayload.password = generateRandomString(256);

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        '"password" length must be less than or equal to 255 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user if password contains letters", async () => {
      requestPayload.password = "abcd1234";

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();
      userPayload.password = requestPayload.password;
      //modelIds and modelNames should be empty - it is new user
      userPayload.modelNames = [];
      userPayload.modelIds = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(requestPayload.password, user.password));

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and return 200 if permissions is 255 - only if user is superAdmin", async () => {
      requestPayload.permissions = 255;
      jwt = await testSuperAdmin.generateJWT();

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    //#endregion CHECK_PERMISSIONS

    //#region CHECK_DEFAULT_LANG

    it("should create new user and set defaultLang to pl if defaultLang is not defined", async () => {
      delete requestPayload.defaultLang;

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
        defaultLang: "pl",
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 to pl if defaultLang is null", async () => {
      requestPayload.defaultLang = null;

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"defaultLang" must be one of [pl, en]');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if defaultLang is a empty", async () => {
      requestPayload.defaultLang = "";

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"defaultLang" must be one of [pl, en]');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if defaultLang is an invalid string", async () => {
      requestPayload.defaultLang = "1abc";

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"defaultLang" must be one of [pl, en]');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and return 200 if defaultLang is en", async () => {
      requestPayload.defaultLang = "en";

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    //#endregion CHECK_DEFAULT_LANG

    //#region CHECK_ADDITIONAL_INFO

    it("should create new user and set additionalInfo to {} if additionalInfo is not defined", async () => {
      delete requestPayload.additionalInfo;

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
        additionalInfo: {},
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();

      userPayload.password = response.body.password;

      //List of ids and names is empty - new user without any models
      userPayload.modelIds = [];
      userPayload.modelNames = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(response.body.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400  if additionalInfo is null", async () => {
      requestPayload.additionalInfo = null;

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400  if additionalInfo is an empty string", async () => {
      requestPayload.additionalInfo = "";

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400  if additionalInfo is a string", async () => {
      requestPayload.additionalInfo = "testInfo";

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400  if additionalInfo is a number", async () => {
      requestPayload.additionalInfo = 123;

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400  if additionalInfo is an empty collection", async () => {
      requestPayload.additionalInfo = [];

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400  if additionalInfo is a collection", async () => {
      requestPayload.additionalInfo = [1, 2, 3];

      let response = await exec();

      //#region CHECKING_EMAIL

      expect(sendMailMockFunction).not.toHaveBeenCalled();

      //#endregion CHECKING_EMAIL

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    //#endregion CHECK_ADDITIONAL_INFO

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();
      userPayload.password = requestPayload.password;
      //modelIds and modelNames should be empty - it is new user
      userPayload.modelNames = [];
      userPayload.modelIds = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 400 if  jwt from different private key was provided", async () => {
      let fakeUserPayload = {
        _id: testAdmin._id,
        email: testAdmin.email,
        name: testAdmin.name,
        permissions: testAdmin.permissions,
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

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 401 if created user is an admin, and user is an admin", async () => {
      jwt = await testAdmin.generateJWT();
      requestPayload.permissions = 2;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        "Access denied. Only superAdmin can create admin"
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and return 200 if created user is an admin, and user is a superAdmin", async () => {
      jwt = await testSuperAdmin.generateJWT();
      requestPayload.permissions = 2;

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();
      userPayload.password = requestPayload.password;
      //modelIds and modelNames should be empty - it is new user
      userPayload.modelNames = [];
      userPayload.modelIds = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(requestPayload.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    it("should not create new user and return 401 if created user is an superAdmin, and user is an admin", async () => {
      jwt = await testAdmin.generateJWT();
      requestPayload.permissions = 4;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        "Access denied. Only superAdmin can create admin"
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should create new user and return 200 if created user is an admin, and user is a superAdmin", async () => {
      jwt = await testSuperAdmin.generateJWT();
      requestPayload.permissions = 4;

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
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
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
        "defaultLang",
        "additionalInfo",
      ]);
      //Id should be converted to string
      userPayload._id = user._id.toString();
      userPayload.password = requestPayload.password;
      //modelIds and modelNames should be empty - it is new user
      userPayload.modelNames = [];
      userPayload.modelIds = [];
      userPayload.filesExist = [];
      userPayload.iosFilesExist = [];

      expect(response.body).toEqual(userPayload);

      //Password should be encrypted properly
      expect(bcrypt.compareSync(requestPayload.password, user.password));

      //#endregion CHECKING_DATABASE
    });

    //#endregion CHECK_AUTHORIZATION
  });

  describe("GET/", () => {
    //jwt used to authenticate when posting
    let jwt;

    beforeEach(async () => {
      jwt = await testAdmin.generateJWT();
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .get("/sidiroar/api/user")
          .set(config.get("tokenHeader"), jwt)
          .send();
      else return request(server).get("/sidiroar/api/user").send();
    };

    it("should return 200 and a list of all users - if there are some users", async () => {
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should contain all users payload
      expect(response.body).toBeDefined();

      //There should be 4 users - useless, normal, admin, and normal+admin and superAdmin
      expect(response.body.length).toEqual(5);

      let expectedBody = [
        {
          _id: uselessUser._id.toString(),
          name: uselessUser.name,
          email: uselessUser.email,
          permissions: uselessUser.permissions,
          modelIds: modelsOfUselessUser.map((model) => model._id.toString()),
          modelNames: modelsOfUselessUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfUselessUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfUselessUser.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUser._id.toString(),
          name: testUser.name,
          email: testUser.email,
          permissions: testUser.permissions,
          modelIds: modelsOfTestUser.map((model) => model._id.toString()),
          modelNames: modelsOfTestUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testAdmin._id.toString(),
          name: testAdmin.name,
          email: testAdmin.email,
          permissions: testAdmin.permissions,
          modelIds: modelsOfTestAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUserAndAdmin._id.toString(),
          name: testUserAndAdmin.name,
          email: testUserAndAdmin.email,
          permissions: testUserAndAdmin.permissions,
          modelIds: modelsOfTestUserAndAdmin.map((model) =>
            model._id.toString()
          ),
          modelNames: modelsOfTestUserAndAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testSuperAdmin._id.toString(),
          name: testSuperAdmin.name,
          email: testSuperAdmin.email,
          permissions: testSuperAdmin.permissions,
          modelIds: modelsOfTestSuperAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestSuperAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
      ];

      //ordering both expected and real body by id
      let orderedExpectedBody = _.orderBy(expectedBody, "_id", "asc");
      let orderedResponseBody = _.orderBy(response.body, "_id", "asc");

      //after sorting - both array should be the same
      expect(orderedResponseBody).toEqual(orderedExpectedBody);

      //#endregion CHECKING_RESPONSE
    });

    it("should return 200 and a list of all users - if users model has files", async () => {
      //creating model file
      let filePath = await Project.getModelFilePath(
        testUser,
        modelsOfTestUser[1]
      );
      await createFileAsync(filePath, "test File content");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should contain all users payload
      expect(response.body).toBeDefined();

      //There should be 4 users - useless, normal, admin, and normal+admin and superAdmin
      expect(response.body.length).toEqual(5);

      let expectedBody = [
        {
          _id: uselessUser._id.toString(),
          name: uselessUser.name,
          email: uselessUser.email,
          permissions: uselessUser.permissions,
          modelIds: modelsOfUselessUser.map((model) => model._id.toString()),
          modelNames: modelsOfUselessUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfUselessUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfUselessUser.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUser._id.toString(),
          name: testUser.name,
          email: testUser.email,
          permissions: testUser.permissions,
          modelIds: modelsOfTestUser.map((model) => model._id.toString()),
          modelNames: modelsOfTestUser.map((model) => model.name),
          filesExist: [false, true, false],
          iosFilesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testAdmin._id.toString(),
          name: testAdmin.name,
          email: testAdmin.email,
          permissions: testAdmin.permissions,
          modelIds: modelsOfTestAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUserAndAdmin._id.toString(),
          name: testUserAndAdmin.name,
          email: testUserAndAdmin.email,
          permissions: testUserAndAdmin.permissions,
          modelIds: modelsOfTestUserAndAdmin.map((model) =>
            model._id.toString()
          ),
          modelNames: modelsOfTestUserAndAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testSuperAdmin._id.toString(),
          name: testSuperAdmin.name,
          email: testSuperAdmin.email,
          permissions: testSuperAdmin.permissions,
          modelIds: modelsOfTestSuperAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestSuperAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
      ];

      //ordering both expected and real body by id
      let orderedExpectedBody = _.orderBy(expectedBody, "_id", "asc");
      let orderedResponseBody = _.orderBy(response.body, "_id", "asc");

      //after sorting - both array should be the same
      expect(orderedResponseBody).toEqual(orderedExpectedBody);

      //#endregion CHECKING_RESPONSE
    });

    it("should return 200 and a list of all users - if users model has ios files", async () => {
      //creating model file
      let filePath = await Project.getModelIOSFilePath(
        testUser,
        modelsOfTestUser[1]
      );
      await createFileAsync(filePath, "test File content");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should contain all users payload
      expect(response.body).toBeDefined();

      //There should be 4 users - useless, normal, admin, and normal+admin and superAdmin
      expect(response.body.length).toEqual(5);

      let expectedBody = [
        {
          _id: uselessUser._id.toString(),
          name: uselessUser.name,
          email: uselessUser.email,
          permissions: uselessUser.permissions,
          modelIds: modelsOfUselessUser.map((model) => model._id.toString()),
          modelNames: modelsOfUselessUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfUselessUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfUselessUser.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUser._id.toString(),
          name: testUser.name,
          email: testUser.email,
          permissions: testUser.permissions,
          modelIds: modelsOfTestUser.map((model) => model._id.toString()),
          modelNames: modelsOfTestUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: [false, true, false],
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testAdmin._id.toString(),
          name: testAdmin.name,
          email: testAdmin.email,
          permissions: testAdmin.permissions,
          modelIds: modelsOfTestAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUserAndAdmin._id.toString(),
          name: testUserAndAdmin.name,
          email: testUserAndAdmin.email,
          permissions: testUserAndAdmin.permissions,
          modelIds: modelsOfTestUserAndAdmin.map((model) =>
            model._id.toString()
          ),
          modelNames: modelsOfTestUserAndAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testSuperAdmin._id.toString(),
          name: testSuperAdmin.name,
          email: testSuperAdmin.email,
          permissions: testSuperAdmin.permissions,
          modelIds: modelsOfTestSuperAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestSuperAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
      ];

      //ordering both expected and real body by id
      let orderedExpectedBody = _.orderBy(expectedBody, "_id", "asc");
      let orderedResponseBody = _.orderBy(response.body, "_id", "asc");

      //after sorting - both array should be the same
      expect(orderedResponseBody).toEqual(orderedExpectedBody);

      //#endregion CHECKING_RESPONSE
    });

    it("should return 200 and a list of all users - if some users does not have any models", async () => {
      await Model.deleteMany({});

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should contain all users payload
      expect(response.body).toBeDefined();

      //There should be 4 users - useless, normal, admin, and normal+admin and superAdmin
      expect(response.body.length).toEqual(5);

      let expectedBody = [
        {
          _id: uselessUser._id.toString(),
          name: uselessUser.name,
          email: uselessUser.email,
          permissions: uselessUser.permissions,
          modelIds: [],
          modelNames: [],
          filesExist: [],
          iosFilesExist: [],
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUser._id.toString(),
          name: testUser.name,
          email: testUser.email,
          permissions: testUser.permissions,
          modelIds: [],
          modelNames: [],
          filesExist: [],
          iosFilesExist: [],
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testAdmin._id.toString(),
          name: testAdmin.name,
          email: testAdmin.email,
          permissions: testAdmin.permissions,
          modelIds: [],
          modelNames: [],
          filesExist: [],
          iosFilesExist: [],
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUserAndAdmin._id.toString(),
          name: testUserAndAdmin.name,
          email: testUserAndAdmin.email,
          permissions: testUserAndAdmin.permissions,
          modelIds: [],
          modelNames: [],
          filesExist: [],
          iosFilesExist: [],
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testSuperAdmin._id.toString(),
          name: testSuperAdmin.name,
          email: testSuperAdmin.email,
          permissions: testSuperAdmin.permissions,
          modelIds: [],
          modelNames: [],
          filesExist: [],
          iosFilesExist: [],
          additionalInfo: {},
          defaultLang: "pl",
        },
      ];

      //ordering both expected and real body by id
      let orderedExpectedBody = _.orderBy(expectedBody, "_id", "asc");
      let orderedResponseBody = _.orderBy(response.body, "_id", "asc");

      //after sorting - both array should be the same
      expect(orderedResponseBody).toEqual(orderedExpectedBody);

      //#endregion CHECKING_RESPONSE
    });

    it("should return 200 and an empty list - if there are no users", async () => {
      await User.deleteMany({});

      //JWT should still be valid - regarding its content
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //There should be empty array - no users
      expect(response.body).toEqual([]);

      //#endregion CHECKING_RESPONSE
    });

    it("should return 200 and proper list - if there is only one users", async () => {
      //deleting all except testUser
      await User.deleteMany({ _id: { $ne: testUser._id } });

      //JWT should still be valid - regarding its content
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //There should be empty array - no users
      expect(response.body).toEqual([
        {
          _id: testUser._id.toString(),
          name: testUser.name,
          email: testUser.email,
          permissions: testUser.permissions,
          modelIds: modelsOfTestUser.map((model) => model._id.toString()),
          modelNames: modelsOfTestUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
      ]);

      //#endregion CHECKING_RESPONSE
    });

    it("should return 200 and proper list - if user has an additional info defined", async () => {
      let info = { key1: "value1", key2: "value2", key3: "value3" };

      testUser.additionalInfo = { ...info };

      await testUser.save();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should contain all users payload
      expect(response.body).toBeDefined();

      //There should be 4 users - useless, normal, admin, and normal+admin and superAdmin
      expect(response.body.length).toEqual(5);

      let expectedBody = [
        {
          _id: uselessUser._id.toString(),
          name: uselessUser.name,
          email: uselessUser.email,
          permissions: uselessUser.permissions,
          modelIds: modelsOfUselessUser.map((model) => model._id.toString()),
          modelNames: modelsOfUselessUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfUselessUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfUselessUser.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUser._id.toString(),
          name: testUser.name,
          email: testUser.email,
          permissions: testUser.permissions,
          modelIds: modelsOfTestUser.map((model) => model._id.toString()),
          modelNames: modelsOfTestUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: info,
          defaultLang: "pl",
        },
        {
          _id: testAdmin._id.toString(),
          name: testAdmin.name,
          email: testAdmin.email,
          permissions: testAdmin.permissions,
          modelIds: modelsOfTestAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUserAndAdmin._id.toString(),
          name: testUserAndAdmin.name,
          email: testUserAndAdmin.email,
          permissions: testUserAndAdmin.permissions,
          modelIds: modelsOfTestUserAndAdmin.map((model) =>
            model._id.toString()
          ),
          modelNames: modelsOfTestUserAndAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testSuperAdmin._id.toString(),
          name: testSuperAdmin.name,
          email: testSuperAdmin.email,
          permissions: testSuperAdmin.permissions,
          modelIds: modelsOfTestSuperAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestSuperAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
      ];

      //ordering both expected and real body by id
      let orderedExpectedBody = _.orderBy(expectedBody, "_id", "asc");
      let orderedResponseBody = _.orderBy(response.body, "_id", "asc");

      //after sorting - both array should be the same
      expect(orderedResponseBody).toEqual(orderedExpectedBody);

      //#endregion CHECKING_RESPONSE
    });

    it("should return 200 and proper list - if user has lang en info defined", async () => {
      testUser.defaultLang = "en";

      await testUser.save();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should contain all users payload
      expect(response.body).toBeDefined();

      //There should be 4 users - useless, normal, admin, and normal+admin and superAdmin
      expect(response.body.length).toEqual(5);

      let expectedBody = [
        {
          _id: uselessUser._id.toString(),
          name: uselessUser.name,
          email: uselessUser.email,
          permissions: uselessUser.permissions,
          modelIds: modelsOfUselessUser.map((model) => model._id.toString()),
          modelNames: modelsOfUselessUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfUselessUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfUselessUser.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUser._id.toString(),
          name: testUser.name,
          email: testUser.email,
          permissions: testUser.permissions,
          modelIds: modelsOfTestUser.map((model) => model._id.toString()),
          modelNames: modelsOfTestUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: {},
          defaultLang: "en",
        },
        {
          _id: testAdmin._id.toString(),
          name: testAdmin.name,
          email: testAdmin.email,
          permissions: testAdmin.permissions,
          modelIds: modelsOfTestAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUserAndAdmin._id.toString(),
          name: testUserAndAdmin.name,
          email: testUserAndAdmin.email,
          permissions: testUserAndAdmin.permissions,
          modelIds: modelsOfTestUserAndAdmin.map((model) =>
            model._id.toString()
          ),
          modelNames: modelsOfTestUserAndAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testSuperAdmin._id.toString(),
          name: testSuperAdmin.name,
          email: testSuperAdmin.email,
          permissions: testSuperAdmin.permissions,
          modelIds: modelsOfTestSuperAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestSuperAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
      ];

      //ordering both expected and real body by id
      let orderedExpectedBody = _.orderBy(expectedBody, "_id", "asc");
      let orderedResponseBody = _.orderBy(response.body, "_id", "asc");

      //after sorting - both array should be the same
      expect(orderedResponseBody).toEqual(orderedExpectedBody);

      //#endregion CHECKING_RESPONSE
    });

    it("should not call logger action method", async () => {
      await exec();

      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should not return any user and return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any user and return 403 if jwt of user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any user and return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should return all users and return 200 with user payload inside body if jwt of adminAndUser user is given", async () => {
      jwt = await testUserAndAdmin.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should contain all users payload
      expect(response.body).toBeDefined();

      //There should be 4 users - useless, normal, admin, and normal+admin, superAdmin
      expect(response.body.length).toEqual(5);

      let expectedBody = [
        {
          _id: uselessUser._id.toString(),
          name: uselessUser.name,
          email: uselessUser.email,
          permissions: uselessUser.permissions,
          modelIds: modelsOfUselessUser.map((model) => model._id.toString()),
          modelNames: modelsOfUselessUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfUselessUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfUselessUser.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUser._id.toString(),
          name: testUser.name,
          email: testUser.email,
          permissions: testUser.permissions,
          modelIds: modelsOfTestUser.map((model) => model._id.toString()),
          modelNames: modelsOfTestUser.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestUser.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testAdmin._id.toString(),
          name: testAdmin.name,
          email: testAdmin.email,
          permissions: testAdmin.permissions,
          modelIds: modelsOfTestAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.fileExists())
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestAdmin.map(async (model) => await model.iosFileExists())
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testUserAndAdmin._id.toString(),
          name: testUserAndAdmin.name,
          email: testUserAndAdmin.email,
          permissions: testUserAndAdmin.permissions,
          modelIds: modelsOfTestUserAndAdmin.map((model) =>
            model._id.toString()
          ),
          modelNames: modelsOfTestUserAndAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestUserAndAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
        {
          _id: testSuperAdmin._id.toString(),
          name: testSuperAdmin.name,
          email: testSuperAdmin.email,
          permissions: testSuperAdmin.permissions,
          modelIds: modelsOfTestSuperAdmin.map((model) => model._id.toString()),
          modelNames: modelsOfTestSuperAdmin.map((model) => model.name),
          filesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.fileExists()
            )
          ),
          iosFilesExist: await Promise.all(
            modelsOfTestSuperAdmin.map(
              async (model) => await model.iosFileExists()
            )
          ),
          additionalInfo: {},
          defaultLang: "pl",
        },
      ];

      //ordering both expected and real body by id
      let orderedExpectedBody = _.orderBy(expectedBody, "_id", "asc");
      let orderedResponseBody = _.orderBy(response.body, "_id", "asc");

      //after sorting - both array should be the same
      expect(orderedExpectedBody).toEqual(orderedResponseBody);

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any user and return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 400 if  jwt from different private key was provided", async () => {
      let fakeUserPayload = {
        _id: testAdmin._id,
        email: testAdmin.email,
        name: testAdmin.name,
        permissions: testAdmin.permissions,
      };

      jwt = await jsonWebToken.sign(fakeUserPayload, "differentTestPrivateKey");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE
    });
  });

  describe("GET/:id", () => {
    //jwt used to authenticate when posting
    let jwt;
    let id;

    beforeEach(async () => {
      jwt = await testAdmin.generateJWT();
      id = testUser._id;
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .get(`/sidiroar/api/user/${id}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else return request(server).get(`/sidiroar/api/user/${id}`).send();
    };

    it("should return 200 and user of given id - if user exists", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should return 200 and user of given id - if user exists and model file exists", async () => {
      //Creating file
      let filePath = await Project.getModelFilePath(
        testUser,
        modelsOfTestUser[1]
      );
      await createFileAsync(filePath, "test file content");

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: [false, true, false],
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should return 200 and user of given id - if user exists and model ios file exists", async () => {
      //Creating file
      let filePath = await Project.getModelIOSFilePath(
        testUser,
        modelsOfTestUser[1]
      );
      await createFileAsync(filePath, "test file content");

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should return 200 and user of given id - if user exists and has no models assigned", async () => {
      await Model.deleteMany({});

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: [],
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should return 200 and user of given id - if user exists and has additional info defined", async () => {
      let info = { key1: "value1", key2: "value2", key3: "value3" };

      testUser.additionalInfo = { ...info };

      await testUser.save();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: info,
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should return 200 and user of given id - if user exists and has default lang as en", async () => {
      testUser.defaultLang = "en";

      await testUser.save();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should not call logger action method", async () => {
      await exec();

      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should return 404 if id is not valid", async () => {
      id = "testUserId";

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toContain("Invalid id...");
    });

    it("should return 404 if use of given id doest not exist", async () => {
      //Generating new random id
      id = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toContain("User not found");
    });

    it("should return 404 if use of given id doest not exist", async () => {
      //Generating new random id
      id = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toContain("User not found");
    });

    it("should not return any user and return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any user and return 403 if jwt of user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any user and return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should return users and return 200 with user payloadif jwt of adminAndUser user is given", async () => {
      jwt = await testUserAndAdmin.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any user and return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 400 if  jwt from different private key was provided", async () => {
      let fakeUserPayload = {
        _id: testAdmin._id,
        email: testAdmin.email,
        name: testAdmin.name,
        permissions: testAdmin.permissions,
      };

      jwt = await jsonWebToken.sign(fakeUserPayload, "differentTestPrivateKey");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE
    });
  });

  describe("DELETE/:id", () => {
    //jwt used to authenticate when posting
    let jwt;
    let id;

    beforeEach(async () => {
      jwt = await testAdmin.generateJWT();
      id = testUser._id;
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .delete(`/sidiroar/api/user/${id}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else return request(server).delete(`/sidiroar/api/user/${id}`).send();
    };

    it("should return 200, delete user, its models and return it - if user exists", async () => {
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all user except deleted one (testUser)
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models except models of deleted user (testUser)
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, delete user,  and return it - if user exists and has no models assigned", async () => {
      //Deleting all models associated with this user
      await Model.deleteMany({ user: id });

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: [],
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all user except deleted one (testUser)
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models except models of deleted user (testUser)
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should call logger action method", async () => {
      let response = await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${testAdmin.email} deleted user ${response.body.email}`
      );
    });

    it("should remove user directory - if user exists", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      let userDirectory = Project._getUserDirPath(response.body);
      let directoryExists = await checkIfDirectoryExistsAsync(userDirectory);

      expect(directoryExists).toEqual(false);
    });

    it("should return 404 if id is not valid", async () => {
      id = "testUserId";

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toContain("Invalid id...");

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be deleted
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be deleted
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 404 if use of given id doest not exist", async () => {
      //Generating new random id
      id = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toContain("User not found");

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be deleted
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be deleted
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 404 if use of given id doest not exist", async () => {
      //Generating new random id
      id = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toContain("User not found");

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be deleted
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be deleted
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be deleted
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be deleted
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 403 if jwt of user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be deleted
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be deleted
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be deleted
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be deleted
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return user and return 200 with user payload if jwt of adminAndUser user is given", async () => {
      jwt = await testUserAndAdmin.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any user and return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be deleted
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be deleted
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 400 if  jwt from different private key was provided", async () => {
      let fakeUserPayload = {
        _id: testAdmin._id,
        email: testAdmin.email,
        name: testAdmin.name,
        permissions: testAdmin.permissions,
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

      //Database should contain all users - nothing should be deleted
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be deleted
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 401 if deleted user is an admin and user is and admin", async () => {
      jwt = await testAdmin.generateJWT();
      id = testUserAndAdmin._id;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        "Access denied. Only superAdmin can delete admins"
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be deleted
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be deleted
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return user and return 200 with user payload if deleted user is and admin and jwt of superAdmin user is given", async () => {
      jwt = await testSuperAdmin.generateJWT();
      id = testUserAndAdmin._id;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUserAndAdmin._id.toString(),
        name: testUserAndAdmin.name,
        email: testUserAndAdmin.email,
        permissions: testUserAndAdmin.permissions,
        modelIds: modelsOfTestUserAndAdmin.map((model) => model._id.toString()),
        modelNames: modelsOfTestUserAndAdmin.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUserAndAdmin.map(
            async (model) => await model.fileExists()
          )
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all user except deleted one (testUser)
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models except models of deleted user (testUser)
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 401 if deleted user is an superAdmin and user is and admin", async () => {
      jwt = await testAdmin.generateJWT();
      id = testSuperAdmin._id;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        "Access denied. Only superAdmin can delete admins"
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be deleted
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be deleted
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return user and return 200 with user payload if deleted user is an superAdmin and jwt of superAdmin user is given", async () => {
      jwt = await testSuperAdmin.generateJWT();
      id = testSuperAdmin._id;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testSuperAdmin._id.toString(),
        name: testSuperAdmin.name,
        email: testSuperAdmin.email,
        permissions: testSuperAdmin.permissions,
        modelIds: modelsOfTestSuperAdmin.map((model) => model._id.toString()),
        modelNames: modelsOfTestSuperAdmin.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestSuperAdmin.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all user except deleted one (testUser)
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testUserAndAdmin._id.toString(),
          testAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models except models of deleted user (testUser)
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });
  });

  describe("PUT/:id", () => {
    //jwt used to authenticate when posting
    let jwt;
    let requestPayload;
    let id;

    beforeEach(async () => {
      jwt = await testAdmin.generateJWT();
      id = testUser._id;
      requestPayload = {
        email: testUser.email,
        name: "editedTestUser",
        permissions: 0,
        password: "98765432",
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .put(`/sidiroar/api/user/${id}`)
          .set(config.get("tokenHeader"), jwt)
          .send(requestPayload);
      else
        return request(server)
          .put(`/sidiroar/api/user/${id}`)
          .send(requestPayload);
    };

    it("should return 200, edit user, and return it - if user exists", async () => {
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user, and return it - if user exists and password is not defined", async () => {
      delete requestPayload.password;
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should call logger action method", async () => {
      let response = await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${testAdmin.email} updated profile data of user ${response.body.email}`
      );
    });

    it("should return 400, and not edit user - if user exists but password is shorter than 8 signs", async () => {
      requestPayload.password = "1234567";
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain(
        '"password" length must be at least 8 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit user - if user exists but password is longer than 255 signs", async () => {
      requestPayload.password = generateRandomNumberString(256);
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain(
        '"password" length must be less than or equal to 255 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit user - if user exists but password is null", async () => {
      requestPayload.password = null;
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain('"password" must be a string');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit user - if user exists but password is empty", async () => {
      requestPayload.password = "";
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain('"password" is not allowed to be empty');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 404, and not edit any user- if user of given id does not exist", async () => {
      //generating new random id
      id = mongoose.Types.ObjectId();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toContain("User not found");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 404, and not edit any user- if user of given id is invalid", async () => {
      //generating new random id
      id = "testId";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toContain("Invalid id...");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users email is different than email in payload", async () => {
      //generating new random id
      requestPayload.email = "testEmail1234@1234.com.pl";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain("Invalid email for given user");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users email is not defined", async () => {
      //generating new random id
      delete requestPayload.email;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"email" is required');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users email is null", async () => {
      //generating new random id
      requestPayload.email = null;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"email" must be a string');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users email is an empty string", async () => {
      //generating new random id
      requestPayload.email = "";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"email" is not allowed to be empty');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users email is not a valid email", async () => {
      //generating new random id
      requestPayload.email = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"email" must be a valid email');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users name is not defined", async () => {
      //generating new random id
      delete requestPayload.name;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"name" is required');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users name is shorter than 3", async () => {
      //generating new random id
      requestPayload.name = "ab";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        '"name" length must be at least 3 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user, and return it - if users name length is equal to 3", async () => {
      requestPayload.name = "abc";
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users name is longer than 100", async () => {
      //101 signs
      requestPayload.name = Array(102).join("n");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        '"name" length must be less than or equal to 100 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user, and return it - if users name length is equal to 100", async () => {
      //101 signs
      requestPayload.name = Array(101).join("n");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user and not edit additionalInfo, and return it - if additionalInfo is not defined in payload, and was set previously", async () => {
      //Setting info non-empty value
      let info = { key1: "value1", key2: "value2" };
      testUser.additionalInfo = { ...info };
      await testUser.save();

      delete requestPayload.additionalInfo;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: info,
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if additionalInfo is null in payload, and was set previously", async () => {
      //Setting info non-empty value
      let info = { key1: "value1", key2: "value2" };
      testUser.additionalInfo = { ...info };
      await testUser.save();

      requestPayload.additionalInfo = null;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if additionalInfo is a string in payload, and was set previously", async () => {
      //Setting info non-empty value
      let info = { key1: "value1", key2: "value2" };
      testUser.additionalInfo = { ...info };
      await testUser.save();

      requestPayload.additionalInfo = "testString";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if additionalInfo is a number in payload, and was set previously", async () => {
      //Setting info non-empty value
      let info = { key1: "value1", key2: "value2" };
      testUser.additionalInfo = { ...info };
      await testUser.save();

      requestPayload.additionalInfo = 123;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if additionalInfo is a boolean in payload, and was set previously", async () => {
      //Setting info non-empty value
      let info = { key1: "value1", key2: "value2" };
      testUser.additionalInfo = { ...info };
      await testUser.save();

      requestPayload.additionalInfo = true;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user and not edit defaultLang- if defaultLang is not defined in payload, and was set previously to en", async () => {
      //Setting initial lang value
      testUser.defaultLang = "en";
      await testUser.save();

      delete requestPayload.defaultLang;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if defaultLang is null in payload, and was set previously to en", async () => {
      //Setting info non-empty value
      //Setting initial lang value
      testUser.defaultLang = "en";
      await testUser.save();

      requestPayload.defaultLang = null;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"defaultLang" must be one of [pl, en]');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if defaultLang is an invalid string in payload, and was set previously to en", async () => {
      //Setting info non-empty value
      //Setting initial lang value
      testUser.defaultLang = "en";
      await testUser.save();

      requestPayload.defaultLang = "invalidString";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"defaultLang" must be one of [pl, en]');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if defaultLang is a number in payload, and was set previously to en", async () => {
      //Setting info non-empty value
      //Setting initial lang value
      testUser.defaultLang = "en";
      await testUser.save();

      requestPayload.defaultLang = 123;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"defaultLang" must be one of [pl, en]');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if defaultLang is a boolean in payload, and was set previously to en", async () => {
      //Setting info non-empty value
      //Setting initial lang value
      testUser.defaultLang = "en";
      await testUser.save();

      requestPayload.defaultLang = true;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"defaultLang" must be one of [pl, en]');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users permissions is not defined", async () => {
      delete requestPayload.permissions;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"permissions" is required');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users permissions is not a number", async () => {
      requestPayload.permissions = "abc";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"permissions" must be a number');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users permissions is smaller than 0", async () => {
      requestPayload.permissions = -1;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        '"permissions" must be larger than or equal to 0'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user, and return it - if  users permissions is 0", async () => {
      //101 signs
      requestPayload.permissions = 0;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users permissions is greater than 255", async () => {
      requestPayload.permissions = 256;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        '"permissions" must be less than or equal to 255'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user, and return it - if  users permissions is 255 and user is a superAdmin", async () => {
      jwt = await testSuperAdmin.generateJWT();
      //101 signs
      requestPayload.permissions = 255;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should not edit any user and return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not edit any user and return 403 if jwt of user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not edit any user and return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should edit user and return 200 with user payload if jwt of adminAndUser user is given", async () => {
      jwt = await testUserAndAdmin.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should not edit any user and return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not edit any user and return 400 if  jwt from different private key was provided", async () => {
      let fakeUserPayload = {
        _id: testAdmin._id,
        email: testAdmin.email,
        name: testAdmin.name,
        permissions: testAdmin.permissions,
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

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not edit any user and return 401 if user is an admin and jwt is of admin user", async () => {
      jwt = await testAdmin.generateJWT();
      id = testUserAndAdmin._id;
      requestPayload = {
        email: testUserAndAdmin.email,
        name: "editedTestUser",
        permissions: 0,
        password: "987654321",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE
      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        "Access denied. Only superAdmin can edit admins"
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should edit user and return 200 with user payload if user is an admin and jwt is of superAdmin user", async () => {
      jwt = await testSuperAdmin.generateJWT();
      id = testUserAndAdmin._id;
      requestPayload = {
        email: testUserAndAdmin.email,
        name: "editedTestUser",
        permissions: 0,
        password: "987654321",
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUserAndAdmin._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUserAndAdmin.map((model) => model._id.toString()),
        modelNames: modelsOfTestUserAndAdmin.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUserAndAdmin.map(
            async (model) => await model.fileExists()
          )
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUserAndAdmin.map(
            async (model) => await model.iosFileExists()
          )
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should not edit any user and return 401 if user is an superAdmin and jwt is of admin user", async () => {
      jwt = await testAdmin.generateJWT();
      id = testUserAndAdmin._id;
      requestPayload = {
        email: testUserAndAdmin.email,
        name: "editedTestUser",
        permissions: 0,
        password: "987654321",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        "Access denied. Only superAdmin can edit admins"
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should edit user and return 200 with user payload if user is an superAdmin and jwt is of superAdmin user", async () => {
      jwt = await testSuperAdmin.generateJWT();
      id = testSuperAdmin._id;
      requestPayload = {
        email: testSuperAdmin.email,
        name: "editedTestUser",
        permissions: 0,
        password: "987654321",
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testSuperAdmin._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestSuperAdmin.map((model) => model._id.toString()),
        modelNames: modelsOfTestSuperAdmin.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestSuperAdmin.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestSuperAdmin.map(
            async (model) => await model.iosFileExists()
          )
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should not edit any user and return 401 if user is an user and jwt is of admin user but new permissions are admin permissions", async () => {
      jwt = await testAdmin.generateJWT();
      id = testUser._id;
      requestPayload = {
        email: testUser.email,
        name: "editedTestUser",
        permissions: 2,
        password: "987654321",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        "Access denied. Only superAdmin can promote users to admins"
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should edit user and return 200 with user promoted to admin if user is a user and jwt is of superAdmin user", async () => {
      jwt = await testSuperAdmin.generateJWT();
      id = testUser._id;
      requestPayload = {
        email: testUser.email,
        name: "editedTestUser",
        permissions: 2,
        password: "987654321",
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should not edit any user and return 401 if user is an user and jwt is of admin user but new permissions are superAdmin permissions", async () => {
      jwt = await testAdmin.generateJWT();
      id = testUser._id;

      requestPayload = {
        email: testUser.email,
        name: "editedTestUser",
        permissions: 4,
        password: "987654321",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain(
        "Access denied. Only superAdmin can promote users to admins"
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should edit user and return 200 with user promoted to admin if user is a user and jwt is of superAdmin user", async () => {
      jwt = await testSuperAdmin.generateJWT();
      id = testUser._id;
      requestPayload = {
        email: testUser.email,
        name: "editedTestUser",
        permissions: 4,
        password: "987654321",
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should edit user and return 200 with user promoted to admin if user is an admin and jwt is of superAdmin user", async () => {
      jwt = await testSuperAdmin.generateJWT();
      id = testAdmin._id;
      requestPayload = {
        email: testAdmin.email,
        name: "editedTestUser",
        permissions: 4,
        password: "987654321",
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testAdmin._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestAdmin.map((model) => model._id.toString()),
        modelNames: modelsOfTestAdmin.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestAdmin.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestAdmin.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: { key1: "value1", key2: "value2", key3: "value3" },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });
  });

  describe("GET/me", () => {
    //jwt used to authenticate when posting
    let jwt;

    beforeEach(async () => {
      jwt = await testUser.generateJWT();
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .get(`/sidiroar/api/user/me`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else return request(server).get(`/sidiroar/api/user/me`).send();
    };

    it("should return 200 and payload of user based on jwt - if user exists", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should not call logger action method", async () => {
      await exec();

      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should return 404  - if user of given jwt does not exist", async () => {
      //removing user from jwt
      await User.deleteMany({ _id: testUser._id });

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found");
    });

    it("should return 200 and user - if user exists and has no models assigned", async () => {
      await Model.deleteMany({});

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: [],
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should return 200 and user - if user has additionalInfo defined", async () => {
      let info = { key1: "value1", key2: "value2", key3: "value3" };
      testUser.additionalInfo = { ...info };
      await testUser.save();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: info,
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should return 200 and user - if user has defaultLang defined as en", async () => {
      testUser.defaultLang = "en";
      await testUser.save();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: testUser.name,
        email: testUser.email,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should not return any user and return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any user and return 403 if jwt of only admin has been given", async () => {
      jwt = await testAdmin.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any user and return 403 if jwt of useless user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should return 200 and payload of user based on jwt - if user exists and is both user and admin", async () => {
      jwt = await testUserAndAdmin.generateJWT();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUserAndAdmin._id.toString(),
        name: testUserAndAdmin.name,
        email: testUserAndAdmin.email,
        permissions: testUserAndAdmin.permissions,
        modelIds: modelsOfTestUserAndAdmin.map((model) => model._id.toString()),
        modelNames: modelsOfTestUserAndAdmin.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUserAndAdmin.map(
            async (model) => await model.fileExists()
          )
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUserAndAdmin.map(
            async (model) => await model.iosFileExists()
          )
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should not return any user and return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Only five users should be saved inside database - uselessUser, testAdmin, testUser, testAdminAndUser, superAdmin
      let userCount = await User.countDocuments({});

      expect(userCount).toEqual(5);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 400 if  jwt from different private key was provided", async () => {
      let fakeUserPayload = {
        _id: testAdmin._id,
        email: testAdmin.email,
        name: testAdmin.name,
        permissions: testAdmin.permissions,
      };

      jwt = await jsonWebToken.sign(fakeUserPayload, "differentTestPrivateKey");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE
    });
  });

  describe("PUT/me", () => {
    //jwt used to authenticate when posting
    let jwt;
    let requestPayload;

    beforeEach(async () => {
      jwt = await testUser.generateJWT();
      requestPayload = {
        email: testUser.email,
        name: "editedTestUser",
        permissions: testUser.permissions,
        password: "9876abcd",
        oldPassword: "43214321",
        additionalInfo: {
          key1: "value1",
          key2: "value2",
          key3: "value3",
        },
        defaultLang: "en",
      };
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .put(`/sidiroar/api/user/me`)
          .set(config.get("tokenHeader"), jwt)
          .send(requestPayload);
      else
        return request(server)
          .put(`/sidiroar/api/user/me`)
          .send(requestPayload);
    };

    it("should return 200, edit user, and return it - if user exists", async () => {
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {
          key1: "value1",
          key2: "value2",
          key3: "value3",
        },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user, and return it - if user exists and password is not defined", async () => {
      delete requestPayload.password;
      delete requestPayload.oldPassword;
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {
          key1: "value1",
          key2: "value2",
          key3: "value3",
        },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should call logger action method", async () => {
      let response = await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${testUser.email} updated their profile data`
      );
    });

    it("should return 400, and not edit user - if user exists but password is shorter than 8 signs", async () => {
      requestPayload.password = "1234567";
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain(
        '"password" length must be at least 8 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit user - if user exists but password is longer than 255 signs", async () => {
      requestPayload.password = generateRandomString(256);
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain(
        '"password" length must be less than or equal to 255 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit user - if user exists but password is null", async () => {
      requestPayload.password = null;
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain('"password" must be a string');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit user - if user exists but password is empty", async () => {
      requestPayload.password = "";
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain('"password" is not allowed to be empty');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit user - if user exists but old password has not been given", async () => {
      delete requestPayload.oldPassword;
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain("Old password should be provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit user - if user exists but old password is null", async () => {
      requestPayload.oldPassword = null;
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain('"oldPassword" must be a string');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit user - if user exists but old password is empty", async () => {
      requestPayload.oldPassword = "";
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain(
        '"oldPassword" is not allowed to be empty'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit user - if user exists but old password is invalid", async () => {
      requestPayload.oldPassword = "9999";
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      expect(response.text).toContain("Invalid old password");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should not be edited in database
      let expectedPayload = await testUser.getPayload();

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password - it should have not been changed
      let newPasswordMatches = await hashedStringMatch(
        "43214321",
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 404, and not edit any user- if user of given id in jwt does not exist", async () => {
      await User.deleteMany({ _id: testUser._id });

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toContain("User not found");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users email is different than email in payload", async () => {
      //generating new random id
      requestPayload.email = "testEmail1234@1234.com.pl";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain("Invalid email for given user");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users email is not defined", async () => {
      //generating new random id
      delete requestPayload.email;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"email" is required');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users email is null", async () => {
      //generating new random id
      requestPayload.email = null;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"email" must be a string');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users email is an empty string", async () => {
      //generating new random id
      requestPayload.email = "";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"email" is not allowed to be empty');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users email is not a valid email", async () => {
      //generating new random id
      requestPayload.email = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"email" must be a valid email');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users name is not defined", async () => {
      //generating new random id
      delete requestPayload.name;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"name" is required');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users name is shorter than 3", async () => {
      //generating new random id
      requestPayload.name = "ab";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        '"name" length must be at least 3 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user, and return it - if users name length is equal to 3", async () => {
      requestPayload.name = "abc";
      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {
          key1: "value1",
          key2: "value2",
          key3: "value3",
        },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users name is longer than 100", async () => {
      //101 signs
      requestPayload.name = Array(102).join("n");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        '"name" length must be less than or equal to 100 characters long'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user, and return it - if users name length is equal to 100", async () => {
      //101 signs
      requestPayload.name = Array(101).join("n");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {
          key1: "value1",
          key2: "value2",
          key3: "value3",
        },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user, and return it - if additional info is not defined in payload and was prevously set", async () => {
      //setting additional info
      testUser.additionalInfo = {
        key1: "value1",
        key2: "value2",
        key3: "value3",
      };
      await testUser.save();

      delete requestPayload.additionalInfo;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {
          key1: "value1",
          key2: "value2",
          key3: "value3",
        },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if additional info is null and was prevously set", async () => {
      //setting additional info
      testUser.additionalInfo = {
        key1: "value1",
        key2: "value2",
        key3: "value3",
      };
      await testUser.save();

      requestPayload.additionalInfo = null;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if additional info is a string and was prevously set", async () => {
      //setting additional info
      testUser.additionalInfo = {
        key1: "value1",
        key2: "value2",
        key3: "value3",
      };
      await testUser.save();

      requestPayload.additionalInfo = "testString";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if additional info is a number and was prevously set", async () => {
      //setting additional info
      testUser.additionalInfo = {
        key1: "value1",
        key2: "value2",
        key3: "value3",
      };
      await testUser.save();

      requestPayload.additionalInfo = 123;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if additional info is a boolean and was prevously set", async () => {
      //setting additional info
      testUser.additionalInfo = {
        key1: "value1",
        key2: "value2",
        key3: "value3",
      };
      await testUser.save();

      requestPayload.additionalInfo = true;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"additionalInfo" must be an object');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users permissions is not defined", async () => {
      delete requestPayload.permissions;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"permissions" is required');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200, edit user, and return it - if defaultLang is not defined in payload and was prevously set to en", async () => {
      //setting defaultLang
      testUser.defaultLang = "en";
      await testUser.save();

      delete requestPayload.defaultLang;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUser._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {
          key1: "value1",
          key2: "value2",
          key3: "value3",
        },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUser._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if defaultLang is null in payload and was prevously set to en", async () => {
      //setting defaultLang
      testUser.defaultLang = "en";
      await testUser.save();

      requestPayload.defaultLang = null;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"defaultLang" must be one of [pl, en]');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if defaultLang is invalid string in payload and was prevously set to en", async () => {
      //setting defaultLang
      testUser.defaultLang = "en";
      await testUser.save();

      requestPayload.defaultLang = "invalidString";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"defaultLang" must be one of [pl, en]');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if defaultLang is a number in payload and was prevously set to en", async () => {
      //setting defaultLang
      testUser.defaultLang = "en";
      await testUser.save();

      requestPayload.defaultLang = 123;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"defaultLang" must be one of [pl, en]');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if defaultLang is a boolean in payload and was prevously set to en", async () => {
      //setting defaultLang
      testUser.defaultLang = "en";
      await testUser.save();

      requestPayload.defaultLang = true;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"defaultLang" must be one of [pl, en]');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users permissions is not a number", async () => {
      requestPayload.permissions = "abc";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"permissions" must be a number');

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users permissions is smaller than 0", async () => {
      requestPayload.permissions = -1;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        '"permissions" must be larger than or equal to 0'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users permissions is greater than 255", async () => {
      requestPayload.permissions = 256;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        '"permissions" must be less than or equal to 255'
      );

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 400, and not edit any user- if users permissions is different than real users permissions", async () => {
      requestPayload.permissions = 2; //testUser has permisions of 1

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain("Invalid permissions for given user");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not edit any user and return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not edit any user and return 403 if jwt of only admin has been given", async () => {
      jwt = await testAdmin.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 403 if jwt of useless user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should return 200 and edit user based on jwt - if user exists and is both user and admin", async () => {
      jwt = await testUserAndAdmin.generateJWT();

      requestPayload = {
        email: testUserAndAdmin.email,
        name: "editedTestUser",
        permissions: testUserAndAdmin.permissions,
        password: "98769876",
        oldPassword: "12431243",
        additionalInfo: {
          key1: "value1",
          key2: "value2",
          key3: "value3",
        },
        defaultLang: "en",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: testUserAndAdmin._id.toString(),
        name: requestPayload.name,
        email: requestPayload.email,
        permissions: requestPayload.permissions,
        modelIds: modelsOfTestUserAndAdmin.map((model) => model._id.toString()),
        modelNames: modelsOfTestUserAndAdmin.map((model) => model.name),
        filesExist: await Promise.all(
          modelsOfTestUserAndAdmin.map(
            async (model) => await model.fileExists()
          )
        ),
        iosFilesExist: await Promise.all(
          modelsOfTestUserAndAdmin.map(
            async (model) => await model.iosFileExists()
          )
        ),
        additionalInfo: {
          key1: "value1",
          key2: "value2",
          key3: "value3",
        },
        defaultLang: "en",
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //User should also be edited in database

      //Getting user from db
      let userFromDatabase = await User.findOne({ _id: testUserAndAdmin._id });
      expect(userFromDatabase).toBeDefined();

      //Checking payload
      let userFromDatabasePayload = await userFromDatabase.getPayload();
      expect(userFromDatabasePayload).toEqual(expectedPayload);

      //Checking password
      let newPasswordMatches = await hashedStringMatch(
        requestPayload.password,
        userFromDatabase.password
      );

      expect(newPasswordMatches).toEqual(true);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_DATABASE

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });

    it("should not return any user and return 400 if  jwt from different private key was provided", async () => {
      let fakeUserPayload = {
        _id: testAdmin._id,
        email: testAdmin.email,
        name: testAdmin.name,
        permissions: testAdmin.permissions,
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

      //Database should contain all users - nothing should be changed
      let idOfAllUsers = _.sortBy(
        (await User.find({})).map((user) => user._id.toString()),
        (id) => id
      );

      let expectedUserIds = _.sortBy(
        [
          uselessUser._id.toString(),
          testUser._id.toString(),
          testAdmin._id.toString(),
          testUserAndAdmin._id.toString(),
          testSuperAdmin._id.toString(),
        ],
        (id) => id
      );

      expect(idOfAllUsers).toEqual(expectedUserIds);

      //Database should contain all models - nothing should be changed
      let idOfAllModels = _.sortBy(
        (await Model.find({})).map((model) => model._id.toString()),
        (id) => id
      );

      let expectedModelIds = _.sortBy(
        [
          ...modelsOfUselessUser,
          ...modelsOfTestAdmin,
          ...modelsOfTestUserAndAdmin,
          ...modelsOfTestUser,
          ...modelsOfTestSuperAdmin,
        ].map((user) => user._id.toString()),
        (id) => id
      );

      expect(idOfAllModels).toEqual(expectedModelIds);

      //#endregion CHECKING_DATABASE
    });
  });
});
