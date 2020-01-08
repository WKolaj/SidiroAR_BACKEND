const logger = require("../logger/logger");
const error = require("../middleware/error");
const userRouter = require("../routes/user");

module.exports = async function(app) {
  logger.info("initializing routes...");

  //HERE PUT A CODE TO INITIALIZE API ENDPOINTS

  //TO DO LATER

  // app.use("/api/users", users);
  // logger.info("Users route initialized");

  logger.info("Route error handler initialized");

  app.use("/api/user", userRouter);

  logger.info("User route initialized");

  logger.info("routes initialized");

  app.use(error);
};
