const appStart = require("./startup/app");

const {
  generateTestSuperAdmin,
  generateTestAdmin,
  generateTestUser,
  generateUselessUser,
  generateTestModels,
} = require("./tests/utilities/testUtilities");

let exec = async () => {
  await appStart();

  await generateTestModels(await generateTestSuperAdmin());
  await generateTestModels(await generateTestAdmin());
  await generateTestModels(await generateTestUser());
  await generateTestModels(await generateUselessUser());

  console.log("generated");
};

exec();
