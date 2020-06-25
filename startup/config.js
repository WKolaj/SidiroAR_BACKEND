const logger = require("../logger/logger");
const config = require("config");

let throwIfConfigDoesNotExist = (configName) => {
  if (!config.get(configName))
    throw new Error(`FATAL ERROR: ${configName} is not defined in config file`);
};

module.exports = async function () {
  logger.info("initializing app configuration files...");

  throwIfConfigDoesNotExist("dbConnectionString");
  throwIfConfigDoesNotExist("emailLogin");
  throwIfConfigDoesNotExist("emailPassword");
  throwIfConfigDoesNotExist("modelFileExtension");
  throwIfConfigDoesNotExist("port");
  throwIfConfigDoesNotExist("requestTimeout");
  throwIfConfigDoesNotExist("tokenHeader");
  throwIfConfigDoesNotExist("jwtPrivateKey");
  throwIfConfigDoesNotExist("projectDir");
  throwIfConfigDoesNotExist("userDir");
  throwIfConfigDoesNotExist("fileDir");
  throwIfConfigDoesNotExist("smtpServerURL");
  throwIfConfigDoesNotExist("smtpServerPort");
  throwIfConfigDoesNotExist("useTLS");
  throwIfConfigDoesNotExist("useNodemailerPool");
  throwIfConfigDoesNotExist("logging");
  throwIfConfigDoesNotExist("logging.logActions");
  throwIfConfigDoesNotExist("logging.info");
  throwIfConfigDoesNotExist("logging.info.path");
  throwIfConfigDoesNotExist("logging.info.maxsize");
  throwIfConfigDoesNotExist("logging.info.maxFiles");
  throwIfConfigDoesNotExist("logging.warning");
  throwIfConfigDoesNotExist("logging.warning.path");
  throwIfConfigDoesNotExist("logging.warning.maxsize");
  throwIfConfigDoesNotExist("logging.warning.maxFiles");
  throwIfConfigDoesNotExist("logging.error");
  throwIfConfigDoesNotExist("logging.error.path");
  throwIfConfigDoesNotExist("logging.error.maxsize");
  throwIfConfigDoesNotExist("logging.error.maxFiles");

  logger.info("app configuration files initialized");
};
