const logger = require("../logger/logger");
const Project = require("../classes/project");
const { User } = require("../models/user");

module.exports = async function () {
  logger.info("initializing project...");

  await Project.generateProjectDirectories();

  logger.info("project directories initialized...");

  logger.info("project initialized");
};
