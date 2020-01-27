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

describe("/sidiroar/api/models", () => {
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
          .get(`/sidiroar/api/model/${userId}/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else
        return request(server)
          .get(`/sidiroar/api/model/${userId}/${modelId}`)
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
          .get(`/sidiroar/api/model/${userId}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else
        return request(server)
          .get(`/sidiroar/api/model/${userId}`)
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

  describe("POST/:userId/", () => {
    //jwt used to authenticate when posting
    let jwt;
    let userId;
    let requestPayload;

    beforeEach(async () => {
      jwt = await testAdmin.generateJWT();
      userId = testUser._id;
      requestPayload = {
        name: "new test model"
      };
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .post(`/sidiroar/api/model/${userId}`)
          .set(config.get("tokenHeader"), jwt)
          .send(requestPayload);
      else
        return request(server)
          .post(`/sidiroar/api/model/${userId}`)
          .send(requestPayload);
    };

    it("should return 200, create new model and return it - if user exists", async () => {
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      //new id should be defined
      expect(response.body._id).toBeDefined();

      let expectedPayload = {
        _id: response.body._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload.push({
        _id: response.body._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      });

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404, and do not create new model  - if user do not exist", async () => {
      userId = mongoose.Types.ObjectId();

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);

      //new id should be defined
      expect(response.text).toEqual("User not found...");

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404, and do not create new model  - if userId is invalid", async () => {
      userId = "abcd";

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);

      //new id should be defined
      expect(response.text).toEqual("Invalid user id...");

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400, and do not create new model  - if name is not defined", async () => {
      delete requestPayload.name;

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      //new id should be defined
      expect(response.text).toEqual('"name" is required');

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400, and do not create new model  - if name is null", async () => {
      requestPayload.name = null;

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      //new id should be defined
      expect(response.text).toEqual('"name" must be a string');

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400, and do not create new model  - if name is empty", async () => {
      requestPayload.name = "";

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      //new id should be defined
      expect(response.text).toEqual('"name" is not allowed to be empty');

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400, and do not create new model  - if name is not a string", async () => {
      requestPayload.name = 123;

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      //new id should be defined
      expect(response.text).toEqual('"name" must be a string');

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400, and do not create new model  - if name is shorter than 3 signs", async () => {
      //2 signs
      requestPayload.name = new Array(3).join("n");

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      //new id should be defined
      expect(response.text).toEqual(
        '"name" length must be at least 3 characters long'
      );

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 200, create new model and return it - if name is exactly 3 signs", async () => {
      //3 signs
      requestPayload.name = new Array(4).join("n");

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      //new id should be defined
      expect(response.body._id).toBeDefined();

      let expectedPayload = {
        _id: response.body._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload.push({
        _id: response.body._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      });

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400, and do not create new model  - if name is longer than 100 signs", async () => {
      //101 signs
      requestPayload.name = new Array(102).join("n");

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      //new id should be defined
      expect(response.text).toEqual(
        '"name" length must be less than or equal to 100 characters long'
      );

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 200, create new model and return it - if name is exactly 100 signs", async () => {
      //100 signs
      requestPayload.name = new Array(101).join("n");

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      //new id should be defined
      expect(response.body._id).toBeDefined();

      let expectedPayload = {
        _id: response.body._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload.push({
        _id: response.body._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      });

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should not create any model and return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);

      //new id should be defined
      expect(response.text).toEqual("Access denied. No token provided");

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should not create any model and return 403 if jwt of user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);

      //new id should be defined
      expect(response.text).toEqual("Access forbidden.");

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should not create any model and return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);

      //new id should be defined
      expect(response.text).toEqual("Access forbidden.");

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 200, create new model and return it if jwt of adminAndUser user is given", async () => {
      jwt = await testUserAndAdmin.generateJWT();

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      //new id should be defined
      expect(response.body._id).toBeDefined();

      let expectedPayload = {
        _id: response.body._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload.push({
        _id: response.body._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      });

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should not create any model and return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      //new id should be defined
      expect(response.text).toEqual("Invalid token provided");

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should not create any model and return 400 if jwt from different private key was provided", async () => {
      let fakeUserPayload = {
        _id: testAdmin._id,
        email: testAdmin.email,
        name: testAdmin.name,
        permissions: testAdmin.permissions
      };

      jwt = await jsonWebToken.sign(fakeUserPayload, "differentTestPrivateKey");

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);

      //new id should be defined
      expect(response.text).toEqual("Invalid token provided");

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });
  });

  describe("DELETE/:userId/:id", () => {
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
          .delete(`/sidiroar/api/model/${userId}/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .send();
      else
        return request(server)
          .delete(`/sidiroar/api/model/${userId}/${modelId}`)
          .send();
    };

    it("should return 200, delete model and return its payload - if user and model exist", async () => {
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedModel = modelsOfTestUser[1];

      let expectedPayload = {
        _id: expectedModel._id.toString(),
        name: expectedModel.name,
        user: expectedModel.user.toString()
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        //Adding all models except the one to delete
        if (model._id !== modelId)
          expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404 and do not delete any model - if model doesnt exist", async () => {
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model not found...");

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404 and do not delete any model - if there is no model in database", async () => {
      //Deleting all models
      await Model.deleteMany({});

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model not found...");
    });

    it("should return 404 and do not delete any model - if user doesnt exist", async () => {
      userId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found...");

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404 and do not delete any model - if user and model dont exist", async () => {
      userId = mongoose.Types.ObjectId();
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found...");

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404 - if user Id is invalid", async () => {
      userId = "abcd";

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid user id...");

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404 - if model Id is invalid", async () => {
      modelId = "abcd";

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid id...");

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
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

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
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

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
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

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return users and return 200 with user payloadif jwt of adminAndUser user is given", async () => {
      jwt = await testUserAndAdmin.generateJWT();

      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedModel = modelsOfTestUser[1];

      let expectedPayload = {
        _id: expectedModel._id.toString(),
        name: expectedModel.name,
        user: expectedModel.user.toString()
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        //Adding all models except the one to delete
        if (model._id !== modelId)
          expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
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

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
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

      //#region CHECK_DATABASE

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find();

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload - database should contain only users added previously
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfUselessUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      for (let model of modelsOfTestUserAndAdmin) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });
  });

  describe("PUT/:userId/:id", () => {
    //jwt used to authenticate when posting
    let jwt;
    let userId;
    let modelId;
    let requestPayload;

    beforeEach(async () => {
      jwt = await testAdmin.generateJWT();
      userId = testUser._id;
      modelId = modelsOfTestUser[1]._id;
      requestPayload = {
        name: "new test model"
      };
    });

    let exec = async () => {
      if (exists(jwt))
        return request(server)
          .put(`/sidiroar/api/model/${userId}/${modelId}`)
          .set(config.get("tokenHeader"), jwt)
          .send(requestPayload);
      else
        return request(server)
          .put(`/sidiroar/api/model/${userId}/${modelId}`)
          .send(requestPayload);
    };

    it("should return 200, edit model and return it - if user and model exist", async () => {
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: modelsOfTestUser[1]._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        //Adding normal model to expected models
        //if it is a edited model - adding edited parameters
        if (model === modelsOfTestUser[1]) {
          expectedModelsPayload.push({
            _id: modelsOfTestUser[1]._id.toString(),
            name: requestPayload.name,
            user: userId.toString()
          });
        } else {
          expectedModelsPayload.push(await model.getPayload());
        }
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400 and not edit model  - if name is undefined", async () => {
      delete requestPayload.name;
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"name" is required');

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400 and not edit model  - if name is null", async () => {
      requestPayload.name = null;
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"name" must be a string');

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400 and not edit model  - if name is empty", async () => {
      requestPayload.name = "";
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain('"name" is not allowed to be empty');

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400 and not edit model  - if name is shorter than 3 signs", async () => {
      requestPayload.name = new Array(3).join("n");
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        '"name" length must be at least 3 characters long'
      );

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400 and not edit model  - if name is shorter than 100 signs", async () => {
      requestPayload.name = new Array(102).join("n");
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toContain(
        '"name" length must be less than or equal to 100 characters long'
      );

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 200 and edit model  - if name is exactly 3 signs", async () => {
      requestPayload.name = new Array(4).join("n");
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: modelsOfTestUser[1]._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        //Adding normal model to expected models
        //if it is a edited model - adding edited parameters
        if (model === modelsOfTestUser[1]) {
          expectedModelsPayload.push({
            _id: modelsOfTestUser[1]._id.toString(),
            name: requestPayload.name,
            user: userId.toString()
          });
        } else {
          expectedModelsPayload.push(await model.getPayload());
        }
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 200 and edit model  - if name is exactly 100 signs", async () => {
      requestPayload.name = new Array(101).join("n");
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: modelsOfTestUser[1]._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        //Adding normal model to expected models
        //if it is a edited model - adding edited parameters
        if (model === modelsOfTestUser[1]) {
          expectedModelsPayload.push({
            _id: modelsOfTestUser[1]._id.toString(),
            name: requestPayload.name,
            user: userId.toString()
          });
        } else {
          expectedModelsPayload.push(await model.getPayload());
        }
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 200 and edit model  - if user is defined in payload and it is exactly the user of model", async () => {
      requestPayload.user = modelsOfTestUser[1].user;
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: modelsOfTestUser[1]._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        //Adding normal model to expected models
        //if it is a edited model - adding edited parameters
        if (model === modelsOfTestUser[1]) {
          expectedModelsPayload.push({
            _id: modelsOfTestUser[1]._id.toString(),
            name: requestPayload.name,
            user: userId.toString()
          });
        } else {
          expectedModelsPayload.push(await model.getPayload());
        }
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 400 and not edit model  - if user is defined in payload but it is not the user of model", async () => {
      requestPayload.user = testUserAndAdmin._id;
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toEqual("Model of user cannot be changed");

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404 - if model doesnt exist", async () => {
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Model not found...");

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404 - if user doesnt exist", async () => {
      userId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found...");

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: testUser._id });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404 - if user and model dont exist", async () => {
      userId = mongoose.Types.ObjectId();
      modelId = mongoose.Types.ObjectId();

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("User not found...");

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: testUser._id });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404 - if user Id is invalid", async () => {
      userId = "abcd";

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid user id...");

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: testUser._id });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should return 404 - if model Id is invalid", async () => {
      modelId = "abcd";

      let response = await exec();

      expect(response).toBeDefined();
      expect(response.status).toEqual(404);
      expect(response.text).toEqual("Invalid id...");

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should not edit model and return 401 if jwt has not been given", async () => {
      jwt = undefined;

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(401);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access denied. No token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should not edit model and return 403 if jwt of user has been given", async () => {
      jwt = await testUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should not edit model and return 403 if jwt of useless (with permissions set to 0) user has been given", async () => {
      jwt = await uselessUser.generateJWT();

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(403);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Access forbidden");

      //#endregion CHECKING_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should edit model and return 200 with user payloadif jwt of adminAndUser user is given", async () => {
      jwt = await testUserAndAdmin.generateJWT();
      let response = await exec();

      //#region CHECK_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(200);

      let expectedPayload = {
        _id: modelsOfTestUser[1]._id.toString(),
        name: requestPayload.name,
        user: userId.toString()
      };

      expect(response.body).toEqual(expectedPayload);

      //#endregion CHECK_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        //Adding normal model to expected models
        //if it is a edited model - adding edited parameters
        if (model === modelsOfTestUser[1]) {
          expectedModelsPayload.push({
            _id: modelsOfTestUser[1]._id.toString(),
            name: requestPayload.name,
            user: userId.toString()
          });
        } else {
          expectedModelsPayload.push(await model.getPayload());
        }
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should not edit model and return 400 if invalid jwt has been given", async () => {
      jwt = "abcd1234";

      let response = await exec();

      //#region CHECKING_RESPONSE

      expect(response).toBeDefined();
      expect(response.status).toEqual(400);
      expect(response.text).toBeDefined();
      expect(response.text).toContain("Invalid token provided");

      //#endregion CHECKING_RESPONSE

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });

    it("should not edit model and return 400 if jwt from different private key was provided", async () => {
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

      //#region CHECK_DATABASE

      //Checking all models associated with this user - not only edited one

      //Generting and sorting  model payload from database
      let modelsFromDatabasePayload = [];

      let modelsFromDatabase = await Model.find({ user: userId });

      for (let model of modelsFromDatabase) {
        modelsFromDatabasePayload.push(await model.getPayload());
      }

      modelsFromDatabase = _.sortBy(modelsFromDatabase, "_id", "asc");

      //Generting and sorting expected model payload
      let expectedModelsPayload = [];

      for (let model of modelsOfTestUser) {
        expectedModelsPayload.push(await model.getPayload());
      }

      expectedModelsPayload = _.sortBy(expectedModelsPayload, "_id", "asc");

      //Both collection should be equal
      expect(modelsFromDatabasePayload).toEqual(expectedModelsPayload);

      //#endregion CHECK_DATABASE
    });
  });
});
