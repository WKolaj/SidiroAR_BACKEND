const logger = require("../logger/logger");

module.exports = function(err, req, res, next) {
  logger.error(err.message, err);
  return res.status(500).send("Ups.. Something fails..");
};
