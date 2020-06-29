const { User } = require("../../models/user");
const { Model } = require("../../models/model");
const {
  exists,
  hashString,
  generateRandomNumberString,
} = require("../../utilities/utilities");
const Project = require("../../classes/project");
const testUselessUserEmail = "useless@test1234abcd.com.pl";
const testAdminEmail = "admin@test1234abcd.com.pl";
const testUserEmail = "user@test1234abcd.com.pl";
const testUserAndAdminEmail = "userandadmin@test1234abcd.com.pl";
const testSuperAdminEmail = "superadmin@test1234abcd.com.pl";

const testUselessUserPassword = "11111111";
const testAdminPassword = "12341234";
const testUserPassword = "43214321";
const testUserAndAdminPassword = "12431243";
const testSuperAdminPassword = "98129812";

//Method for generating useless (without permissions) user directly into database
module.exports.generateUselessUser = async () => {
  let user = await User.findOne({ email: testUselessUserEmail });
  if (exists(user)) return user;

  user = new User({
    name: "testUselessUser",
    email: testUselessUserEmail,
    password: await hashString(testUselessUserPassword),
    permissions: 0,
    defaultLang: "pl",
  });

  await user.save();

  return user;
};

//Method for generating test admin user directly into database
module.exports.generateTestAdmin = async () => {
  let admin = await User.findOne({ email: testAdminEmail });
  if (exists(admin)) return admin;

  admin = new User({
    name: "testAdmin",
    email: testAdminEmail,
    password: await hashString(testAdminPassword),
    permissions: 2,
    defaultLang: "pl",
  });

  await admin.save();

  return admin;
};

//Method for generating test  user directly into database
module.exports.generateTestUser = async () => {
  let user = await User.findOne({ email: testUserEmail });
  if (exists(user)) return user;

  user = new User({
    name: "testUser",
    email: testUserEmail,
    password: await hashString(testUserPassword),
    permissions: 1,
    defaultLang: "pl",
  });

  await user.save();

  return user;
};

//Method for generating test user that is also an admin directly into database
module.exports.generateTestAdminAndUser = async () => {
  let user = await User.findOne({ email: testUserAndAdminEmail });
  if (exists(user)) return user;

  user = new User({
    name: "testUserAndAdmin",
    email: testUserAndAdminEmail,
    password: await hashString(testUserAndAdminPassword),
    permissions: 3,
    defaultLang: "pl",
  });

  await user.save();

  return user;
};

//Method for generating test su[er admin user directly into database
module.exports.generateTestSuperAdmin = async () => {
  let admin = await User.findOne({ email: testSuperAdminEmail });
  if (exists(admin)) return admin;

  admin = new User({
    name: "testSuperAdmin",
    email: testSuperAdminEmail,
    password: await hashString(testSuperAdminPassword),
    permissions: 7,
    defaultLang: "pl",
  });

  await admin.save();

  return admin;
};

//Method for generating test models for given user
module.exports.generateTestModels = async (users) => {
  let modelsToReturn = [
    new Model({
      name: `testModel${generateRandomNumberString(4)}`,
      user: users.map((user) => user._id),
    }),
    new Model({
      name: `testModel${generateRandomNumberString(4)}`,
      user: users.map((user) => user._id),
    }),
    new Model({
      name: `testModel${generateRandomNumberString(4)}`,
      user: users.map((user) => user._id),
    }),
  ];

  for (let model of modelsToReturn) {
    await model.save();
  }

  return modelsToReturn;
};
