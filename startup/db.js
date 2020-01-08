const logger = require("../logger/logger");
const mongoose = require("mongoose");
const config = require("config");

module.exports = async function() {
  logger.info("database initializing database...");

  const connectionString = config.get("dbConnectionString");

  await mongoose.connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  mongoose.set("useCreateIndex", true);

  logger.info("database initialized");
};
