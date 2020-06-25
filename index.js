const appStart = require("./startup/app");

const { generateTestSuperAdmin } = require("./tests/utilities/testUtilities");

let exec = async () => {
  await appStart();

  await generateTestSuperAdmin();

  console.log("generated");
};

exec();
