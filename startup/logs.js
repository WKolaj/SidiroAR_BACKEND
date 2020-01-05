const logger = require("../logger/logger");

module.exports = async function() {
  //Throwing on every unhandled rejection - in order for winston to log it inside datalogs
  process.on("unhandledRejection", err => {
    throw err;
  });

  logger.info("logging initialized");
};
