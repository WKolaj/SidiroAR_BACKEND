const express = require("express");
const path = require("path");
const logger = require("../logger/logger");
const error = require("../middleware/error");
const jsonValidation = require("../middleware/jsonError");
const userRouter = require("../routes/user");
const authRouter = require("../routes/auth");
const modelRouter = require("../routes/model");
const fileRouter = require("../routes/file");

module.exports = async function(app) {
  logger.info("initializing routes...");

  //file route should be initialzied before JSON route
  app.use("/sidiroar/api/file", fileRouter);

  logger.info("File route initialized");

  app.use(express.json());

  logger.info("JSON middleware initialized");

  app.use(jsonValidation);

  logger.info("JSON error validation middleware initialized");

  app.use("/sidiroar/api/auth", authRouter);

  logger.info("Auth route initialized");

  app.use("/sidiroar/api/user", userRouter);

  logger.info("User route initialized");

  app.use("/sidiroar/api/model", modelRouter);

  logger.info("Model route initialized");

  logger.info("routes initialized");

  app.use(error);
};
