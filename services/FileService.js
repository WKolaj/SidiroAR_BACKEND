const fs = require("fs");
const config = require("config");
const path = require("path");

const filesDirPath = config.get("filesDir");

const getFilePathWithFileDir = filePath => {
  return path.join(filesDirPath, filePath);
};

/**
 * Function for getting read file stream based on virtual path
 */
module.exports.getFileReadStream = function(filePath) {
  //Can be changed to cloud download version
  return fs.createReadStream(getFilePathWithFileDir(filePath));
};

/**
 * Function for getting write file stream based on virtual path
 */
module.exports.getFileWriteStream = function(filePath) {
  //Can be changed to cloud upload version
  return fs.createWriteStream(getFilePathWithFileDir(filePath));
};
