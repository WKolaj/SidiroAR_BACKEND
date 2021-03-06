const EmailService = require("../../../services/EmailService/EmailService");
const {
  snooze,
  clearDirectoryAsync,
  exists,
  createFileAsync,
} = require("../../../utilities/utilities");
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
  generateUselessUser,
  generateTestModels,
} = require("../../utilities/testUtilities");
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

describe("/sidiroar/api/users", () => {
  let uselessUser;
  let testAdmin;
  let testUser;
  let testUserAndAdmin;
  let logActionMock;

  beforeEach(async () => {
    //clearing project directory
    await clearDirectoryAsync(testDirPath);

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

    //Overwriting logget action method
    logActionMock = jest.fn();
    logger.action = logActionMock;
  });

  afterEach(async () => {
    //Clearing users in database after each test
    await User.deleteMany({});

    await server.close();
    sendMailMockFunction.mockClear();

    //clearing project directory
    await clearDirectoryAsync(testDirPath);
  });

  describe("POST/", () => {
    let requestPayload;

    beforeEach(async () => {
      requestPayload = {
        email: testUser.email,
        password: "43214321",
      };
    });

    let exec = async () => {
      return request(server).post("/sidiroar/api/auth").send(requestPayload);
    };

    it("should return 200 and logged users payload inside body (together with jwt) if user payload is valid and user is useless (without permissions) user", async () => {
      //Setting payload of normal user
      requestPayload = {
        email: uselessUser.email,
        password: "11111111",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with users payload
      let expectedBody = {
        _id: uselessUser._id.toString(),
        email: uselessUser.email,
        name: uselessUser.name,
        permissions: uselessUser.permissions,
        modelIds: [],
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
        additionalInfo: {},
        defaultLang: "pl",
      };

      //JWT should also be returned in body
      (expectedBody.jwt = await uselessUser.generateJWT()),
        expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header should have x-auth-token as jwt
      expect(response.header["x-auth-token"]).toEqual(
        await uselessUser.generateJWT()
      );

      //#endregion CHECKING_HEADER
    });

    it("should return 200 and logged users payload inside body (together with jwt) if user payload is valid and user is normal user", async () => {
      //Setting payload of normal user - default setting

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with users payload
      let expectedBody = {
        _id: testUser._id.toString(),
        email: testUser.email,
        name: testUser.name,
        permissions: testUser.permissions,
        modelIds: [],
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
        additionalInfo: {},
        defaultLang: "pl",
      };

      //JWT should also be returned in body
      (expectedBody.jwt = await testUser.generateJWT()),
        expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header should have x-auth-token as jwt
      expect(response.header["x-auth-token"]).toEqual(
        await testUser.generateJWT()
      );

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${requestPayload.email} logged in`
      );
      //#endregion CHECKING_LOGGING

      //#region CHECKING_LOGGING

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${requestPayload.email} logged in`
      );
      //#endregion CHECKING_LOGGING
    });

    it("should return 200 and logged users payload inside body (together with jwt) if user payload is valid and user is admin user", async () => {
      //Setting payload of normal user
      requestPayload = {
        email: testAdmin.email,
        password: "12341234",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with users payload
      let expectedBody = {
        _id: testAdmin._id.toString(),
        email: testAdmin.email,
        name: testAdmin.name,
        permissions: testAdmin.permissions,
        modelIds: [],
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
        additionalInfo: {},
        defaultLang: "pl",
      };

      //JWT should also be returned in body
      (expectedBody.jwt = await testAdmin.generateJWT()),
        expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header should have x-auth-token as jwt
      expect(response.header["x-auth-token"]).toEqual(
        await testAdmin.generateJWT()
      );

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${requestPayload.email} logged in`
      );
      //#endregion CHECKING_LOGGING
    });

    it("should return 200 and logged users payload inside body (together with jwt) if user payload is valid and user is admin and normal user", async () => {
      //Setting payload of normal user
      requestPayload = {
        email: testUserAndAdmin.email,
        password: "12431243",
      };

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with users payload
      let expectedBody = {
        _id: testUserAndAdmin._id.toString(),
        email: testUserAndAdmin.email,
        name: testUserAndAdmin.name,
        permissions: testUserAndAdmin.permissions,
        modelIds: [],
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
        additionalInfo: {},
        defaultLang: "pl",
      };

      //JWT should also be returned in body
      (expectedBody.jwt = await testUserAndAdmin.generateJWT()),
        expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header should have x-auth-token as jwt
      expect(response.header["x-auth-token"]).toEqual(
        await testUserAndAdmin.generateJWT()
      );

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${requestPayload.email} logged in`
      );
      //#endregion CHECKING_LOGGING
    });

    it("should return 200 and logged users payload inside body (together with jwt) if user has model files", async () => {
      //Creating models and files
      let modelsOfTestUser = await generateTestModels([testUser]);
      let filePath = await Project.getModelFilePath(modelsOfTestUser[1]);
      await createFileAsync(filePath, "content of test file");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with users payload
      let expectedBody = {
        _id: testUser._id.toString(),
        email: testUser.email,
        name: testUser.name,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name.toString()),
        filesExist: [false, true, false],
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      //JWT should also be returned in body
      (expectedBody.jwt = await testUser.generateJWT()),
        expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header should have x-auth-token as jwt
      expect(response.header["x-auth-token"]).toEqual(
        await testUser.generateJWT()
      );

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${requestPayload.email} logged in`
      );
      //#endregion CHECKING_LOGGING
    });

    it("should return 200 and logged users payload inside body (together with jwt) if user has ios model files", async () => {
      //Creating models and files
      let modelsOfTestUser = await generateTestModels([testUser]);
      let filePath = await Project.getModelIOSFilePath(modelsOfTestUser[1]);
      await createFileAsync(filePath, "content of test file");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with users payload
      let expectedBody = {
        _id: testUser._id.toString(),
        email: testUser.email,
        name: testUser.name,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name.toString()),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: [false, true, false],
        additionalInfo: {},
        defaultLang: "pl",
      };

      //JWT should also be returned in body
      (expectedBody.jwt = await testUser.generateJWT()),
        expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header should have x-auth-token as jwt
      expect(response.header["x-auth-token"]).toEqual(
        await testUser.generateJWT()
      );

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${requestPayload.email} logged in`
      );
      //#endregion CHECKING_LOGGING
    });

    it("should return 200 and logged users payload inside body (together with jwt) if user has shared models", async () => {
      //Creating models and files
      let modelsOfTestUser = await generateTestModels([
        testUser,
        testUserAndAdmin,
      ]);
      let filePath = await Project.getModelFilePath(modelsOfTestUser[1]);
      await createFileAsync(filePath, "content of test file");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with users payload
      let expectedBody = {
        _id: testUser._id.toString(),
        email: testUser.email,
        name: testUser.name,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name.toString()),
        filesExist: [false, true, false],
        iosFilesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.iosFileExists())
        ),
        additionalInfo: {},
        defaultLang: "pl",
      };

      //JWT should also be returned in body
      (expectedBody.jwt = await testUser.generateJWT()),
        expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header should have x-auth-token as jwt
      expect(response.header["x-auth-token"]).toEqual(
        await testUser.generateJWT()
      );

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${requestPayload.email} logged in`
      );
      //#endregion CHECKING_LOGGING
    });

    it("should return 200 and logged users payload inside body (together with jwt) if user has shared ios model files", async () => {
      //Creating models and files
      let modelsOfTestUser = await generateTestModels([
        testUser,
        testUserAndAdmin,
      ]);
      let filePath = await Project.getModelIOSFilePath(modelsOfTestUser[1]);
      await createFileAsync(filePath, "content of test file");

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with users payload
      let expectedBody = {
        _id: testUser._id.toString(),
        email: testUser.email,
        name: testUser.name,
        permissions: testUser.permissions,
        modelIds: modelsOfTestUser.map((model) => model._id.toString()),
        modelNames: modelsOfTestUser.map((model) => model.name.toString()),
        filesExist: await Promise.all(
          modelsOfTestUser.map(async (model) => await model.fileExists())
        ),
        iosFilesExist: [false, true, false],
        additionalInfo: {},
        defaultLang: "pl",
      };

      //JWT should also be returned in body
      (expectedBody.jwt = await testUser.generateJWT()),
        expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header should have x-auth-token as jwt
      expect(response.header["x-auth-token"]).toEqual(
        await testUser.generateJWT()
      );

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${requestPayload.email} logged in`
      );
      //#endregion CHECKING_LOGGING
    });

    it("should return 200 and logged users payload inside body (together with jwt) if email differs due to uppercase", async () => {
      //Setting payload of normal user
      requestPayload.email = "UsEr@test1234abcd.com.pl";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toBeDefined();

      //Body should correspond with users payload
      let expectedBody = {
        _id: testUser._id.toString(),
        email: testUser.email,
        name: testUser.name,
        permissions: testUser.permissions,
        modelIds: [],
        modelNames: [],
        filesExist: [],
        iosFilesExist: [],
        additionalInfo: {},
        defaultLang: "pl",
      };

      //JWT should also be returned in body
      (expectedBody.jwt = await testUser.generateJWT()),
        expect(response.body).toEqual(expectedBody);

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header should have x-auth-token as jwt
      expect(response.header["x-auth-token"]).toEqual(
        await testUser.generateJWT()
      );

      //#endregion CHECKING_HEADER
    });

    it("should return 400 and empty body if user payload is not valid - email is not defined", async () => {
      delete requestPayload.email;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        "Invalid request - email cannot be empty"
      );

      //body should be empty
      expect(response.body).toEqual({});

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header x-auth-token should not be defined
      expect(response.header["x-auth-token"]).not.toBeDefined();

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).not.toHaveBeenCalled();

      //#endregion CHECKING_LOGGING
    });

    it("should return 400 and empty body if user payload is not valid - email is null", async () => {
      requestPayload.email = null;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        "Invalid request - email cannot be empty"
      );

      //body should be empty
      expect(response.body).toEqual({});

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header x-auth-token should not be defined
      expect(response.header["x-auth-token"]).not.toBeDefined();

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).not.toHaveBeenCalled();

      //#endregion CHECKING_LOGGING
    });

    it("should return 400 and empty body if user payload is not valid - password is not defined", async () => {
      delete requestPayload.password;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        "Invalid request - password cannot be empty"
      );

      //body should be empty
      expect(response.body).toEqual({});

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header x-auth-token should not be defined
      expect(response.header["x-auth-token"]).not.toBeDefined();

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).not.toHaveBeenCalled();

      //#endregion CHECKING_LOGGING
    });

    it("should return 400 and empty body if user payload is not valid - password is null", async () => {
      requestPayload.password = null;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        "Invalid request - password cannot be empty"
      );

      //body should be empty
      expect(response.body).toEqual({});

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header x-auth-token should not be defined
      expect(response.header["x-auth-token"]).not.toBeDefined();

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).not.toHaveBeenCalled();

      //#endregion CHECKING_LOGGING
    });

    it("should return 400 and empty body if there is no user of given email", async () => {
      requestPayload.email = "userThatDoesNotExist@test.mail.com";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain("Invalid email or password");

      //body should be empty
      expect(response.body).toEqual({});

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header x-auth-token should not be defined
      expect(response.header["x-auth-token"]).not.toBeDefined();

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).not.toHaveBeenCalled();

      //#endregion CHECKING_LOGGING
    });

    it("should return 400 and empty body if password is invalid", async () => {
      requestPayload.password = "99999999";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain("Invalid email or password");

      //body should be empty
      expect(response.body).toEqual({});

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_HEADER

      //Header x-auth-token should not be defined
      expect(response.header["x-auth-token"]).not.toBeDefined();

      //#endregion CHECKING_HEADER

      //#region CHECKING_LOGGING

      expect(logActionMock).not.toHaveBeenCalled();

      //#endregion CHECKING_LOGGING
    });
  });
});
