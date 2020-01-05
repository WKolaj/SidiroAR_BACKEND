const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const getFullPath = pathName => {
  return path.resolve(pathName);
};

//Method for checking if object is empty
module.exports.isObjectEmpty = function(obj) {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
};

//Method for getting current application version
module.exports.getCurrentAppVersion = function() {
  let pjson = require("../package.json");

  return pjson.version;
};

//Creating promise from non promise functions
module.exports.statAsync = promisify(fs.stat);
module.exports.readFileAsync = promisify(fs.readFile);
module.exports.writeFileAsync = promisify(fs.writeFile);
module.exports.readDirAsync = promisify(fs.readdir);
module.exports.appendFileAsync = promisify(fs.appendFile);
module.exports.createDirAsync = promisify(fs.mkdir);
module.exports.unlinkAnsync = promisify(fs.unlink);

module.exports.checkIfDirectoryExistsAsync = async function(directoryPath) {
  return new Promise(async (resolve, reject) => {
    fs.stat(directoryPath, function(err) {
      if (!err) {
        return resolve(true);
      }
      return resolve(false);
    });
  });
};

module.exports.checkIfFileExistsAsync = async function(filePath) {
  return new Promise(async (resolve, reject) => {
    fs.stat(filePath, function(err) {
      if (!err) {
        return resolve(true);
      }
      return resolve(false);
    });
  });
};

module.exports.createFileAsync = async function(filePath, fileContent) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, fileContent, function(err) {
      if (err) {
        return reject(err);
      }

      return resolve(true);
    });
  });
};

/**
 * @description Method for deleting file
 * @param {string} file file or directory to delete
 */
module.exports.removeFileOrDirectoryAsync = async function(filePath) {
  return new Promise(function(resolve, reject) {
    fs.lstat(filePath, function(err, stats) {
      if (err) {
        return reject(err);
      }
      if (stats.isDirectory()) {
        resolve(module.exports.removeDirectoryAsync(filePath));
      } else {
        fs.unlink(filePath, function(err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      }
    });
  });
};

/**
 * @description Method for clearing whole directory
 * @param {string} directory directory to clear
 */
module.exports.clearDirectoryAsync = async function(directory) {
  return new Promise(function(resolve, reject) {
    fs.access(directory, function(err) {
      if (err) {
        return reject(err);
      }
      fs.readdir(directory, function(err, files) {
        if (err) {
          return reject(err);
        }
        Promise.all(
          files.map(function(file) {
            var filePath = path.join(directory, file);
            return module.exports.removeFileOrDirectoryAsync(filePath);
          })
        )
          .then(function() {
            return resolve();
          })
          .catch(reject);
      });
    });
  });
};

/**
 * @description Method for removing directory
 * @param {string} directory directory to clear
 */
module.exports.removeDirectoryAsync = async function(directory) {
  return new Promise(function(resolve, reject) {
    fs.access(directory, function(err) {
      if (err) {
        return reject(err);
      }
      fs.readdir(directory, function(err, files) {
        if (err) {
          return reject(err);
        }
        Promise.all(
          files.map(function(file) {
            var filePath = path.join(directory, file);
            return module.exports.removeFileOrDirectoryAsync(filePath);
          })
        )
          .then(function() {
            fs.rmdir(directory, function(err) {
              if (err) {
                return reject(err);
              }
              resolve();
            });
          })
          .catch(reject);
      });
    });
  });
};

/**
 * @description Method for sleeping thread
 * @param {number} ms number of miliseconds for thread to sleep
 */
module.exports.snooze = function(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * @description Method for hashing password
 * @param {String} stringToHash string to hash
 */
module.exports.hashString = async function(stringToHash) {
  return bcrypt.hash(stringToHash, saltRounds);
};

/**
 * @description Method for checking string
 * @param {String} normalString normal string
 * @param {String} hashedString hashed string
 */
module.exports.hashedStringMatch = async function(normalString, hashedString) {
  return bcrypt.compare(normalString, hashedString);
};

module.exports.exists = function(object) {
  return object !== null && object !== undefined;
};

module.exports.existsAndIsNotEmpty = function(object) {
  return module.exports.exists(object) && !module.exports.isObjectEmpty(object);
};

module.exports.isCorrectValue = function(value) {
  if (!module.exports.exists(value)) return false;
  if (!module.exports.isObjectEmpty(value)) return false;
  //If value is Boolean it is still valid
  if (value === true) return true;
  if (value === false) return true;
  if (isNaN(value)) return false;

  return true;
};
