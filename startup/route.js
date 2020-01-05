const logger = require("../logger/logger");
const error = require("../middleware/error");

module.exports = async function(app) {
  logger.info("initializing routes...");

  //HERE PUT A CODE TO INITIALIZE API ENDPOINTS

  //TO DO LATER

  // app.use("/api/users", users);
  // logger.info("Users route initialized");

  app.use(error);

  logger.info("Route error handler initialized");

  logger.info("routes initialized");
};
