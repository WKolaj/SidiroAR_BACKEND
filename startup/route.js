const logger = require("../logger/logger");
const error = require("../middleware/error");
const userRouter = require("../routes/user");
const authRouter = require("../routes/auth");
const modelRouter = require("../routes/model");

module.exports = async function(app) {
  logger.info("initializing routes...");

  //HERE PUT A CODE TO INITIALIZE API ENDPOINTS

  //TO DO LATER

  logger.info("Route error handler initialized");

  app.use("/sidiroar/api/auth", authRouter);

  logger.info("Auth route initialized");

  app.use("/sidiroar/api/user", userRouter);

  logger.info("User route initialized");

  app.use("/sidiroar/api/model", modelRouter);

  logger.info("Model route initialized");

  logger.info("routes initialized");

  app.use(error);
};
