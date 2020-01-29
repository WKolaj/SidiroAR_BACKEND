const { User } = require("../../models/user");
const { Model } = require("../../models/model");
const {
  exists,
  hashString,
  generateRandomNumberString
} = require("../../utilities/utilities");
const Project = require("../../classes/project");
const testUselessUserEmail = "useless@test1234abcd.com.pl";
const testAdminEmail = "admin@test1234abcd.com.pl";
const testUserEmail = "user@test1234abcd.com.pl";
const testUserAndAdminEmail = "userAndAdmin@test1234abcd.com.pl";

//Method for generating useless (without permissions) user directly into database
module.exports.generateUselessUser = async () => {
  let user = await User.findOne({ email: testUselessUserEmail });
  if (exists(user)) return user;

  user = new User({
    name: "testUselessUser",
    email: testUselessUserEmail,
    password: await hashString("1111"),
    permissions: 0
  });

  await user.save();

  //Generating user directory
  await Project.generateUserDirectory(user);

  return user;
};

//Method for generating test admin user directly into database
module.exports.generateTestAdmin = async () => {
  let admin = await User.findOne({ email: testAdminEmail });
  if (exists(admin)) return admin;

  admin = new User({
    name: "testAdmin",
    email: testAdminEmail,
    password: await hashString("1234"),
    permissions: 2
  });

  await admin.save();

  //Generating user directory
  await Project.generateUserDirectory(admin);

  return admin;
};

//Method for generating test  user directly into database
module.exports.generateTestUser = async () => {
  let user = await User.findOne({ email: testUserEmail });
  if (exists(user)) return user;

  user = new User({
    name: "testUser",
    email: testUserEmail,
    password: await hashString("4321"),
    permissions: 1
  });

  await user.save();

  //Generating user directory
  await Project.generateUserDirectory(user);

  return user;
};

//Method for generating test user that is also an admin directly into database
module.exports.generateTestAdminAndUser = async () => {
  let user = await User.findOne({ email: testUserAndAdminEmail });
  if (exists(user)) return user;

  user = new User({
    name: "testUserAndAdmin",
    email: testUserAndAdminEmail,
    password: await hashString("1243"),
    permissions: 3
  });

  await user.save();

  //Generating user directory
  await Project.generateUserDirectory(user);

  return user;
};

//Method for generating test models for given user
module.exports.generateTestModels = async user => {
  let modelsToReturn = [
    new Model({
      name: `testModel${generateRandomNumberString(4)}`,
      user: user._id
    }),
    new Model({
      name: `testModel${generateRandomNumberString(4)}`,
      user: user._id
    }),
    new Model({
      name: `testModel${generateRandomNumberString(4)}`,
      user: user._id
    })
  ];

  for (let model of modelsToReturn) {
    await model.save();
  }

  return modelsToReturn;
};
