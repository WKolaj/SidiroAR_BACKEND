const fs = require("fs");
const config = require("config");
const path = require("path");
const filesDirPath = config.get("filesDir");
const {
  checkIfDirectoryExistsAsync,
  createDirAsync,
  removeFileOrDirectoryAsync
} = require("../utilities/utilities");

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

  //Attention! - if directory for file to create exists, it throws automatically without possibility to catch this err
  //therefore should include .on("error",()=>{}) catching mechanism for write streams!
  return fs.createWriteStream(getFilePathWithFileDir(filePath));
};

/**
 * @description Method for creating user directory on server
 */
module.exports.createUserDirIfNotExists = async function(userId) {
  let userDirPath = getFilePathWithFileDir(userId);
  if (!(await checkIfDirectoryExistsAsync(userDirPath))) {
    await createDirAsync(userDirPath);
  }
};

/**
 * @description Method for deleting file if it exists
 */
module.exports.deleteFileIfExists = async function(filePath) {
  let filePathWithFileDir = getFilePathWithFileDir(filePath);
  if (!(await checkIfDirectoryExistsAsync(filePathWithFileDir))) {
    await removeFileOrDirectoryAsync(filePathWithFileDir);
  }
};
