const { snooze } = require("../../../utilities/utilities");
const _ = require("lodash");
const request = require("supertest");
const config = require("config");
const jsonWebToken = require("jsonwebtoken");
const mongoose = require("mongoose");
let { User } = require("../../../models/user");
let { Model } = require("../../../models/model");
let {
  generateTestAdmin,
  generateTestUser,
  generateTestAdminAndUser,
  generateUselessUser,
  generateTestModels
} = require("../../utilities/testUtilities");
let { exists } = require("../../../utilities/utilities");
let server;

describe("/api/models", () => {
  let uselessUser;
  let testAdmin;
  let testUser;
  let testUserAndAdmin;
  let modelsOfUselessUser;
  let modelsOfTestAdmin;
  let modelsOfTestUser;
  let modelsOfTestUserAndAdmin;

  beforeEach(async () => {
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

    modelsOfUselessUser = await generateTestModels(uselessUser);
    modelsOfTestAdmin = await generateTestModels(testAdmin);
    modelsOfTestUser = await generateTestModels(testUser);
    modelsOfTestUserAndAdmin = await generateTestModels(testUserAndAdmin);
  });

  afterEach(async () => {
    //Clearing users in database after each test
    await User.deleteMany({});

    //Clearing models
    await Model.deleteMany({});

    await server.close();
  });

  describe("GET/:userId/:id", () => {
    //jwt used to authenticate when posting
    let jwt;
    let userId;
    let modelId;

    beforeEach(async () => {
      jwt = await testAdmin.generateJWT();
      userId = testUser._id;
      modelId = modelsOfTestUser[1]._id;
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .get(`/api/model/${userId}/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else
        return request(server)
          .get(`/api/model/${userId}/${modelId}`)
          .send();
    };

    it("should return 200 and model of given id - if user exists", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedModel = modelsOfTestUser[1];

      let expectedPayload = {
        _id: expectedModel._id.toString(),
        name: expectedModel.name,
        user: expectedModel.user.toString()
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should return 404 - if model doesnt exist", async () => {
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model or user not found");
    });

    it("should return 404 - if user doesnt exist", async () => {
      userId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model or user not found");
    });

    it("should return 404 - if user and model dont exist", async () => {
      userId = mongoose.Types.ObjectId();
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model or user not found");
    });

    it("should return 404 - if user Id is invalid", async () => {
      userId = "abcd";

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid user id...");
    });

    it("should return 404 - if model Id is invalid", async () => {
      modelId = "abcd";

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid id...");
    });

    it("should not return any model and return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any model and return 403 if jwt of user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any model and return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
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

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedModel = modelsOfTestUser[1];

      let expectedPayload = {
        _id: expectedModel._id.toString(),
        name: expectedModel.name,
        user: expectedModel.user.toString()
      };

      expect(response.body).toEqual(expectedPayload);
    });

    it("should not return any model and return 400 if invalid jwt has been given", async () => {
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

    it("should not return any model and return 400 if jwt from different private key was provided", async () => {
      let fakeUserPayload = {
        _id: testAdmin._id,
        email: testAdmin.email,
        name: testAdmin.name,
        permissions: testAdmin.permissions
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

  describe("GET/:userId", () => {
    //jwt used to authenticate when posting
    let jwt;
    let userId;

    beforeEach(async () => {
      jwt = await testAdmin.generateJWT();
      userId = testUser._id;
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .get(`/api/model/${userId}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else
        return request(server)
          .get(`/api/model/${userId}`)
          .send();
    };

    it("should return 200 and all models of given user - if user exists", async () => {
      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = [
        {
          _id: modelsOfTestUser[0]._id.toString(),
          name: modelsOfTestUser[0].name,
          user: modelsOfTestUser[0].user.toString()
        },
        {
          _id: modelsOfTestUser[1]._id.toString(),
          name: modelsOfTestUser[1].name,
          user: modelsOfTestUser[1].user.toString()
        },
        {
          _id: modelsOfTestUser[2]._id.toString(),
          name: modelsOfTestUser[2].name,
          user: modelsOfTestUser[2].user.toString()
        }
      ];

      expect(response.body).toEqual(expectedPayload);
    });

    it("should return 404 - if user doesnt exist", async () => {
      userId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found...");
    });

    it("should return 200 and empty array - if user exists but there is no models assigned", async () => {
      //Deleting userId
      await Model.deleteMany({ user: userId });

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);
      expect(response.body).toEqual([]);
    });

    it("should return 200 and array with one element - if user exists but has only one model assigned", async () => {
      //Deleting userId
      await Model.deleteOne({ _id: modelsOfTestUser[0]._id });
      await Model.deleteOne({ _id: modelsOfTestUser[2]._id });

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = [await modelsOfTestUser[1].getPayload()];
      expect(response.body).toEqual(expectedPayload);
    });

    it("should return 404 - if user Id is invalid", async () => {
      userId = "abcd";

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid user id...");
    });

    it("should not return any model and return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any model and return 403 if jwt of user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any model and return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE
    });

    it("should return all models of given user if jwt of adminAndUser user is given", async () => {
      jwt = await testUserAndAdmin.generateJWT();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = [
        {
          _id: modelsOfTestUser[0]._id.toString(),
          name: modelsOfTestUser[0].name,
          user: modelsOfTestUser[0].user.toString()
        },
        {
          _id: modelsOfTestUser[1]._id.toString(),
          name: modelsOfTestUser[1].name,
          user: modelsOfTestUser[1].user.toString()
        },
        {
          _id: modelsOfTestUser[2]._id.toString(),
          name: modelsOfTestUser[2].name,
          user: modelsOfTestUser[2].user.toString()
        }
      ];

      expect(response.body).toEqual(expectedPayload);
    });

    it("should not return any model and return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE
    });

    it("should not return any model and return 400 if jwt from different private key was provided", async () => {
      let fakeUserPayload = {
        _id: testAdmin._id,
        email: testAdmin.email,
        name: testAdmin.name,
        permissions: testAdmin.permissions
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
});
