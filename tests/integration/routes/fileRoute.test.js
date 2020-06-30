const EmailService = require("../../../services/EmailService/EmailService");
const { createFileAsync } = require("../../../utilities/utilities");
const _ = require("lodash");
const jsonWebToken = require("jsonwebtoken");
const request = require("supertest");
const path = require("path");
const config = require("config");
const mongoose = require("mongoose");
let { User } = require("../../../models/user");
let { Model } = require("../../../models/model");
let {
  generateTestAdmin,
  generateTestUser,
  generateTestAdminAndUser,
  generateUselessUser,
  generateTestModels,
} = require("../../utilities/testUtilities");
let {
  exists,
  snooze,
  hashedStringMatch,
  clearDirectoryAsync,
  checkIfFileExistsAsync,
  readFileAsync,
} = require("../../../utilities/utilities");
let server;
let Project = require("../../../classes/project");
let testDirPath = "__testDir";
let logger = require("../../../logger/logger");

describe("/sidiroar/api/file", () => {
  let uselessUser;
  let testAdmin;
  let testUser;
  let testUserAndAdmin;
  let modelsOfUselessUser;
  let modelsOfTestAdmin;
  let modelsOfTestUser;
  let modelsOfTestUserAndAdmin;
  let logActionMock;

  beforeEach(async () => {
    //clearing project directory
    await clearDirectoryAsync(testDirPath);

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

    modelsOfUselessUser = await generateTestModels([uselessUser]);
    modelsOfTestAdmin = await generateTestModels([testAdmin]);
    modelsOfTestUser = await generateTestModels([testUser]);
    modelsOfTestUserAndAdmin = await generateTestModels([testUserAndAdmin]);

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

    //clearing project directory
    await clearDirectoryAsync(testDirPath);
  });

  describe("GET/me/:modelId", () => {
    //jwt used to authenticate when posting
    let jwt;
    let model;
    let modelId;
    let user;
    let fileContent;
    let createFile;

    beforeEach(async () => {
      user = testUser;
      model = modelsOfTestUser[1];
      modelId = model._id;
      fileContent = "This is a test file";
      jwt = await user.generateJWT();
      createFile = true;
    });

    let exec = async () => {
      //creating file
      let filePath = Project.getModelFilePath(model);
      if (createFile) await createFileAsync(filePath, fileContent);

      if (exists(jwt))
        return request(server)
          .get(`/sidiroar/api/file/me/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else
        return request(server).get(`/sidiroar/api/file/me/${modelId}`).send();
    };

    it("should return 200 and pipe file to download - if file exists", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let responseText = response.body.toString();
      expect(responseText).toEqual(fileContent);
    });

    it("should return 200 and pipe file to download - if file exists and model is shared via several users", async () => {
      let sharedModels = await generateTestModels([testUser, testUserAndAdmin]);

      user = testUser;
      model = sharedModels[1];
      modelId = model._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let responseText = response.body.toString();
      expect(responseText).toEqual(fileContent);
    });

    it("should call logger action method", async () => {
      await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${user.email} started downloading android file for model ${modelId}`
      );
    });

    it("should return 404 - if model does not exist", async () => {
      createFile = false;
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model file not found...");
    });

    it("should return 404 - if file does not exist", async () => {
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model not found...");
    });

    it("should return 404 - if model Id is invalid", async () => {
      modelId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid id...");
    });

    it("should return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE
    });

    it("should return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return 400 if invalid jwt has been given", async () => {
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

    it("should not return 400 if jwt from different private key was provided", async () => {
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

  describe("GET/:userId/:modelId", () => {
    //jwt used to authenticate when posting
    let jwt;
    let model;
    let modelId;
    let userId;
    let user;
    let queryUser;
    let fileContent;
    let createFile;

    beforeEach(async () => {
      queryUser = testAdmin;
      model = modelsOfTestUser[1];
      modelId = model._id;
      user = testUser;
      userId = user._id;
      fileContent = "This is a test file";
      jwt = await queryUser.generateJWT();
      createFile = true;
    });

    let exec = async () => {
      //creating file
      let filePath = Project.getModelFilePath(model);
      if (createFile) await createFileAsync(filePath, fileContent);

      if (exists(jwt))
        return request(server)
          .get(`/sidiroar/api/file/${userId}/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else
        return request(server)
          .get(`/sidiroar/api/file/${userId}/${modelId}`)
          .send();
    };

    it("should return 200 and pipe file to download - if file exists", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let responseText = response.body.toString();
      expect(responseText).toEqual(fileContent);
    });

    it("should return 200 and pipe file to download - if model is shared via several users", async () => {
      let sharedModels = await generateTestModels([testUser, testUserAndAdmin]);

      model = sharedModels[1];
      modelId = model._id;
      user = testUser;
      userId = user._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let responseText = response.body.toString();
      expect(responseText).toEqual(fileContent);
    });

    it("should call logger action method", async () => {
      await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${user.email} started downloading android file for model ${modelId}`
      );
    });

    it("should return 404 - if model does not exist", async () => {
      createFile = false;
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model file not found...");
    });

    it("should return 404 - if user does not exist", async () => {
      userId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found...");
    });

    it("should return 404 - if user id is invalid", async () => {
      userId = "fakeUserId";

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid user id...");
    });

    it("should return 404 - if model does not exist for given user", async () => {
      modelId = modelsOfTestUserAndAdmin[1]._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model not found...");
    });

    it("should return 404 - if model file not exist for given user", async () => {
      modelId = modelsOfTestUser[0]._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model file not found...");
    });

    it("should return 404 - if model Id is invalid", async () => {
      modelId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid id...");
    });

    it("should return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE
    });

    it("should return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should return 403 if jwt of user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return 400 if invalid jwt has been given", async () => {
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

    it("should not return 400 if jwt from different private key was provided", async () => {
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

  describe("POST/:userId/:modelId", () => {
    //jwt used to authenticate when posting
    let jwt;
    let model;
    let modelId;
    let user;
    let userId;
    let fileContent;
    let filePath;

    beforeEach(async () => {
      user = testUser;
      userId = testUser._id;
      model = modelsOfTestUser[1];
      modelId = model._id;
      fileContent = "This is a test file";
      filePath = path.join(testDirPath, "testFile.test");
      jwt = await testAdmin.generateJWT();
    });

    let exec = async () => {
      await createFileAsync(filePath, fileContent);

      if (exists(jwt))
        return request(server)
          .post(`/sidiroar/api/file/${userId}/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .attach("file", filePath);
      else
        return request(server)
          .post(`/sidiroar/api/file/${userId}/${modelId}`)
          .attach("file", filePath);
    };

    it("should return 200 and send file to the server", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully uploaded!");

      let modelFilePath = Project.getModelFilePath(model);

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(true);

      let uploadedFileContent = (
        await readFileAsync(modelFilePath, "utf8")
      ).toString();
      expect(uploadedFileContent).toEqual(fileContent);
    });

    it("should return 200 and send file to the server - if model is shared with some users", async () => {
      let sharedModels = await generateTestModels([testUser, testUserAndAdmin]);

      user = testUser;
      userId = testUser._id;
      model = sharedModels[1];
      modelId = model._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully uploaded!");

      let modelFilePath = Project.getModelFilePath(model);

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(true);

      let uploadedFileContent = (
        await readFileAsync(modelFilePath, "utf8")
      ).toString();
      expect(uploadedFileContent).toEqual(fileContent);

      //File should be available to download via both users routes

      let result1 = await request(server)
        .get(`/sidiroar/api/file/${testUser._id.toString()}/${modelId}`)
        .set(config.get("tokenHeader"), jwt)
        .send();

      expect(result1.status).toEqual(200);
      expect(result1.body.toString()).toEqual(fileContent);

      let result2 = await request(server)
        .get(`/sidiroar/api/file/${testUserAndAdmin._id.toString()}/${modelId}`)
        .set(config.get("tokenHeader"), jwt)
        .send();

      expect(result2.status).toEqual(200);
      expect(result2.body.toString()).toEqual(fileContent);
    });

    it("should return 200, send file to the server and override it - if file already exist", async () => {
      //Creating file to override
      let modelFilePath = Project.getModelFilePath(model);
      await createFileAsync(modelFilePath, "test file content");

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully uploaded!");

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(true);

      let uploadedFileContent = (
        await readFileAsync(modelFilePath, "utf8")
      ).toString();
      expect(uploadedFileContent).toEqual(fileContent);
    });

    it("should return 200, send file to the server and override it - if file already exist and is shared with some users", async () => {
      let sharedModels = await generateTestModels([testUser, testUserAndAdmin]);

      user = testUser;
      userId = testUser._id;
      model = sharedModels[1];
      modelId = model._id;

      //Creating file to override
      let modelFilePath = Project.getModelFilePath(model);
      await createFileAsync(modelFilePath, "test file content");

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully uploaded!");

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(true);

      let uploadedFileContent = (
        await readFileAsync(modelFilePath, "utf8")
      ).toString();
      expect(uploadedFileContent).toEqual(fileContent);

      //File should be available to download via both users routes

      let result1 = await request(server)
        .get(`/sidiroar/api/file/${testUser._id.toString()}/${modelId}`)
        .set(config.get("tokenHeader"), jwt)
        .send();

      expect(result1.status).toEqual(200);
      expect(result1.body.toString()).toEqual(fileContent);

      let result2 = await request(server)
        .get(`/sidiroar/api/file/${testUserAndAdmin._id.toString()}/${modelId}`)
        .set(config.get("tokenHeader"), jwt)
        .send();

      expect(result2.status).toEqual(200);
      expect(result2.body.toString()).toEqual(fileContent);
    });

    it("should call logger action method", async () => {
      await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${testAdmin.email} uploaded android file for model ${modelId}`
      );
    });

    it("should return 404 - if user does not exist", async () => {
      userId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found...");
    });

    it("should return 404 - if user Id is invalid", async () => {
      userId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid user id...");
    });

    it("should return 404 - if file does not exist", async () => {
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model not found...");
    });

    it("should return 404 - if model Id is invalid", async () => {
      modelId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid id...");
    });

    it("should return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(false);

      //#endregion CHECKING_FILE
    });

    it("should return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(false);

      //#endregion CHECKING_FILE
    });

    it("should return 403 if jwt of normal  user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(false);

      //#endregion CHECKING_FILE
    });

    it("should not return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(false);

      //#endregion CHECKING_FILE
    });

    it("should not return 400 if jwt from different private key was provided", async () => {
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

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(false);

      //#endregion CHECKING_FILE
    });
  });

  describe("DELETE/:userId/:modelId", () => {
    //jwt used to authenticate when posting
    let jwt;
    let model;
    let modelId;
    let user;
    let userId;
    let createFile;

    beforeEach(async () => {
      user = testUser;
      userId = testUser._id;
      model = modelsOfTestUser[1];
      modelId = model._id;
      jwt = await testAdmin.generateJWT();
      createFile = true;
    });

    let exec = async () => {
      let modelFilePath = Project.getModelFilePath(model);
      if (createFile)
        await createFileAsync(modelFilePath, "This is a test file");

      if (exists(jwt))
        return request(server)
          .delete(`/sidiroar/api/file/${userId}/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else
        return request(server)
          .delete(`/sidiroar/api/file/${userId}/${modelId}`)
          .send();
    };

    it("should return 200 and delete file from the server", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully deleted!");

      let modelFilePath = Project.getModelFilePath(model);

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(false);
    });

    it("should return 200 and delete file from the server - if file is shared via several users", async () => {
      let sharedModels = await generateTestModels([testUser, testUserAndAdmin]);

      user = testUser;
      userId = testUser._id;
      model = sharedModels[1];
      modelId = model._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully deleted!");

      let modelFilePath = Project.getModelFilePath(model);

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(false);
    });

    it("should call logger action method", async () => {
      await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${testAdmin.email} deleted android file for model ${modelId}`
      );
    });

    it("should return 404 - if user does not exist", async () => {
      userId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found...");
    });

    it("should return 404 - if user Id is invalid", async () => {
      userId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid user id...");
    });

    it("should return 404 - if file does not exist", async () => {
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model not found...");
    });

    it("should return 404 - if model Id is invalid", async () => {
      modelId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid id...");
    });

    it("should return 404 - if model file does not exist", async () => {
      createFile = false;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model file does not exist...");
    });

    it("should return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(true);

      //#endregion CHECKING_FILE
    });

    it("should return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(true);

      //#endregion CHECKING_FILE
    });

    it("should return 403 if jwt of normal  user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(true);

      //#endregion CHECKING_FILE
    });

    it("should not return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(true);

      //#endregion CHECKING_FILE
    });

    it("should not return 400 if jwt from different private key was provided", async () => {
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

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(true);

      //#endregion CHECKING_FILE
    });
  });

  describe("GET/ios/me/:modelId", () => {
    //jwt used to authenticate when posting
    let jwt;
    let model;
    let modelId;
    let user;
    let fileContent;
    let createFile;

    beforeEach(async () => {
      user = testUser;
      model = modelsOfTestUser[1];
      modelId = model._id;
      fileContent = "This is a test file";
      jwt = await user.generateJWT();
      createFile = true;
    });

    let exec = async () => {
      //creating file
      let filePath = Project.getModelIOSFilePath(model);
      if (createFile) await createFileAsync(filePath, fileContent);

      if (exists(jwt))
        return request(server)
          .get(`/sidiroar/api/file/ios/me/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else
        return request(server)
          .get(`/sidiroar/api/file/ios/me/${modelId}`)
          .send();
    };

    it("should return 200 and pipe file to download - if file exists", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let responseText = response.body.toString();
      expect(responseText).toEqual(fileContent);
    });

    it("should return 200 and pipe file to download - if file exists and model is shared via several users", async () => {
      let sharedModels = await generateTestModels([testUser, testUserAndAdmin]);

      user = testUser;
      model = sharedModels[1];
      modelId = model._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let responseText = response.body.toString();
      expect(responseText).toEqual(fileContent);
    });

    it("should call logger action method", async () => {
      await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${user.email} started downloading ios file for model ${modelId}`
      );
    });

    it("should return 404 - if model does not exist", async () => {
      createFile = false;
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model file not found...");
    });

    it("should return 404 - if file does not exist", async () => {
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model not found...");
    });

    it("should return 404 - if model Id is invalid", async () => {
      modelId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid id...");
    });

    it("should return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE
    });

    it("should return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return 400 if invalid jwt has been given", async () => {
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

    it("should not return 400 if jwt from different private key was provided", async () => {
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

  describe("GET/ios/:userId/:modelId", () => {
    //jwt used to authenticate when posting
    let jwt;
    let model;
    let modelId;
    let userId;
    let user;
    let queryUser;
    let fileContent;
    let createFile;

    beforeEach(async () => {
      queryUser = testAdmin;
      model = modelsOfTestUser[1];
      modelId = model._id;
      user = testUser;
      userId = user._id;
      fileContent = "This is a test file";
      jwt = await queryUser.generateJWT();
      createFile = true;
    });

    let exec = async () => {
      //creating file
      let filePath = Project.getModelIOSFilePath(model);
      if (createFile) await createFileAsync(filePath, fileContent);

      if (exists(jwt))
        return request(server)
          .get(`/sidiroar/api/file/ios/${userId}/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else
        return request(server)
          .get(`/sidiroar/api/file/ios/${userId}/${modelId}`)
          .send();
    };

    it("should return 200 and pipe file to download - if file exists", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let responseText = response.body.toString();
      expect(responseText).toEqual(fileContent);
    });

    it("should return 200 and pipe file to download - if model is shared via several users", async () => {
      let sharedModels = await generateTestModels([testUser, testUserAndAdmin]);

      model = sharedModels[1];
      modelId = model._id;
      user = testUser;
      userId = user._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let responseText = response.body.toString();
      expect(responseText).toEqual(fileContent);
    });

    it("should call logger action method", async () => {
      await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${user.email} started downloading ios file for model ${modelId}`
      );
    });

    it("should return 404 - if model does not exist", async () => {
      createFile = false;
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model file not found...");
    });

    it("should return 404 - if user does not exist", async () => {
      userId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found...");
    });

    it("should return 404 - if user id is invalid", async () => {
      userId = "fakeUserId";

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid user id...");
    });

    it("should return 404 - if model does not exist for given user", async () => {
      modelId = modelsOfTestUserAndAdmin[1]._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model not found...");
    });

    it("should return 404 - if model file not exist for given user", async () => {
      modelId = modelsOfTestUser[0]._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model file not found...");
    });

    it("should return 404 - if model Id is invalid", async () => {
      modelId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid id...");
    });

    it("should return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE
    });

    it("should return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should return 403 if jwt of user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return 400 if invalid jwt has been given", async () => {
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

    it("should not return 400 if jwt from different private key was provided", async () => {
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

  describe("POST/ios/:userId/:modelId", () => {
    //jwt used to authenticate when posting
    let jwt;
    let model;
    let modelId;
    let user;
    let userId;
    let fileContent;
    let filePath;

    beforeEach(async () => {
      user = testUser;
      userId = testUser._id;
      model = modelsOfTestUser[1];
      modelId = model._id;
      fileContent = "This is a test file";
      filePath = path.join(testDirPath, "testFile.test");
      jwt = await testAdmin.generateJWT();
    });

    let exec = async () => {
      await createFileAsync(filePath, fileContent);

      if (exists(jwt))
        return request(server)
          .post(`/sidiroar/api/file/ios/${userId}/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .attach("file", filePath);
      else
        return request(server)
          .post(`/sidiroar/api/file/ios/${userId}/${modelId}`)
          .attach("file", filePath);
    };

    it("should return 200 and send file to the server", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully uploaded!");

      let modelFilePath = Project.getModelIOSFilePath(model);

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(true);

      let uploadedFileContent = (
        await readFileAsync(modelFilePath, "utf8")
      ).toString();
      expect(uploadedFileContent).toEqual(fileContent);
    });

    it("should return 200 and send file to the server - if model is shared with some users", async () => {
      let sharedModels = await generateTestModels([testUser, testUserAndAdmin]);

      user = testUser;
      userId = testUser._id;
      model = sharedModels[1];
      modelId = model._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully uploaded!");

      let modelFilePath = Project.getModelIOSFilePath(model);

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(true);

      let uploadedFileContent = (
        await readFileAsync(modelFilePath, "utf8")
      ).toString();
      expect(uploadedFileContent).toEqual(fileContent);

      //File should be available to download via both users routes

      let result1 = await request(server)
        .get(`/sidiroar/api/file/ios/${testUser._id.toString()}/${modelId}`)
        .set(config.get("tokenHeader"), jwt)
        .send();

      expect(result1.status).toEqual(200);
      expect(result1.body.toString()).toEqual(fileContent);

      let result2 = await request(server)
        .get(
          `/sidiroar/api/file/ios/${testUserAndAdmin._id.toString()}/${modelId}`
        )
        .set(config.get("tokenHeader"), jwt)
        .send();

      expect(result2.status).toEqual(200);
      expect(result2.body.toString()).toEqual(fileContent);
    });

    it("should return 200, send file to the server and override it - if file already exist", async () => {
      //Creating file to override
      let modelFilePath = Project.getModelIOSFilePath(model);
      await createFileAsync(modelFilePath, "test file content");

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully uploaded!");

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(true);

      let uploadedFileContent = (
        await readFileAsync(modelFilePath, "utf8")
      ).toString();
      expect(uploadedFileContent).toEqual(fileContent);
    });

    it("should return 200, send file to the server and override it - if file already exist and is shared with some users", async () => {
      let sharedModels = await generateTestModels([testUser, testUserAndAdmin]);

      user = testUser;
      userId = testUser._id;
      model = sharedModels[1];
      modelId = model._id;

      //Creating file to override
      let modelFilePath = Project.getModelIOSFilePath(model);
      await createFileAsync(modelFilePath, "test file content");

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully uploaded!");

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(true);

      let uploadedFileContent = (
        await readFileAsync(modelFilePath, "utf8")
      ).toString();
      expect(uploadedFileContent).toEqual(fileContent);

      //File should be available to download via both users routes

      let result1 = await request(server)
        .get(`/sidiroar/api/file/ios/${testUser._id.toString()}/${modelId}`)
        .set(config.get("tokenHeader"), jwt)
        .send();

      expect(result1.status).toEqual(200);
      expect(result1.body.toString()).toEqual(fileContent);

      let result2 = await request(server)
        .get(
          `/sidiroar/api/file/ios/${testUserAndAdmin._id.toString()}/${modelId}`
        )
        .set(config.get("tokenHeader"), jwt)
        .send();

      expect(result2.status).toEqual(200);
      expect(result2.body.toString()).toEqual(fileContent);
    });

    it("should call logger action method", async () => {
      await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${testAdmin.email} uploaded ios file for model ${modelId}`
      );
    });

    it("should return 404 - if user does not exist", async () => {
      userId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found...");
    });

    it("should return 404 - if user Id is invalid", async () => {
      userId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid user id...");
    });

    it("should return 404 - if file does not exist", async () => {
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model not found...");
    });

    it("should return 404 - if model Id is invalid", async () => {
      modelId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid id...");
    });

    it("should return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelIOSFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(false);

      //#endregion CHECKING_FILE
    });

    it("should return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelIOSFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(false);

      //#endregion CHECKING_FILE
    });

    it("should return 403 if jwt of normal  user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelIOSFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(false);

      //#endregion CHECKING_FILE
    });

    it("should not return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelIOSFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(false);

      //#endregion CHECKING_FILE
    });

    it("should not return 400 if jwt from different private key was provided", async () => {
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

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelIOSFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(false);

      //#endregion CHECKING_FILE
    });
  });

  describe("DELETE/ios/:userId/:modelId", () => {
    //jwt used to authenticate when posting
    let jwt;
    let model;
    let modelId;
    let user;
    let userId;
    let createFile;

    beforeEach(async () => {
      user = testUser;
      userId = testUser._id;
      model = modelsOfTestUser[1];
      modelId = model._id;
      jwt = await testAdmin.generateJWT();
      createFile = true;
    });

    let exec = async () => {
      let modelFilePath = Project.getModelIOSFilePath(model);
      if (createFile)
        await createFileAsync(modelFilePath, "This is a test file");

      if (exists(jwt))
        return request(server)
          .delete(`/sidiroar/api/file/ios/${userId}/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else
        return request(server)
          .delete(`/sidiroar/api/file/ios/${userId}/${modelId}`)
          .send();
    };

    it("should return 200 and delete file from the server", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully deleted!");

      let modelFilePath = Project.getModelIOSFilePath(model);

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(false);
    });

    it("should return 200 and delete file from the server - if file is shared via several users", async () => {
      let sharedModels = await generateTestModels([testUser, testUserAndAdmin]);

      user = testUser;
      userId = testUser._id;
      model = sharedModels[1];
      modelId = model._id;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.text).toEqual("File successfully deleted!");

      let modelFilePath = Project.getModelIOSFilePath(model);

      let uploadedFileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(uploadedFileExists).toEqual(false);
    });

    it("should call logger action method", async () => {
      await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);
      expect(logActionMock.mock.calls[0][0]).toEqual(
        `User ${testAdmin.email} deleted ios file for model ${modelId}`
      );
    });

    it("should return 404 - if user does not exist", async () => {
      userId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found...");
    });

    it("should return 404 - if user Id is invalid", async () => {
      userId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid user id...");
    });

    it("should return 404 - if file does not exist", async () => {
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model not found...");
    });

    it("should return 404 - if model Id is invalid", async () => {
      modelId = "abcd";
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid id...");
    });

    it("should return 404 - if model file does not exist", async () => {
      createFile = false;

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model file does not exist...");
    });

    it("should return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelIOSFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(true);

      //#endregion CHECKING_FILE
    });

    it("should return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelIOSFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(true);

      //#endregion CHECKING_FILE
    });

    it("should return 403 if jwt of normal  user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelIOSFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(true);

      //#endregion CHECKING_FILE
    });

    it("should not return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelIOSFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(true);

      //#endregion CHECKING_FILE
    });

    it("should not return 400 if jwt from different private key was provided", async () => {
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

      //#region CHECKING_FILE

      let modelFilePath = Project.getModelIOSFilePath(model);
      let fileExists = await checkIfFileExistsAsync(modelFilePath);
      expect(fileExists).toEqual(true);

      //#endregion CHECKING_FILE
    });
  });
});
