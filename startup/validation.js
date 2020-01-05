const logger = require("../logger/logger");
const Joi = require("joi");

module.exports = async function() {
  logger.info("initializing validation...");

  //Assigning object id type to Joi validation
  Joi.objectId = require("joi-objectid")(Joi);

  logger.info("validation initialized");
};
