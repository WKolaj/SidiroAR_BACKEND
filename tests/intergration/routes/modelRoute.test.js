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
  });
});
