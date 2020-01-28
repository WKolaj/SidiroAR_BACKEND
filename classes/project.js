const config = require("config");
const path = require("path");
const {
  exists,
  createDirIfNotExists,
  removeDirectoryIfExists
} = require("../utilities/utilities");

class Project {
  static _getProjectDirName() {
    return config.get("projectDir");
  }

  static _getUsersDirName() {
    return config.get("userDir");
  }

  static _getFileDirName() {
    return config.get("fileDir");
  }

  static _getTemporaryFileDirName() {
    return config.get("tempFileDirName");
  }

  static _getTemporaryFileDirPath() {
    let projectDirPath = Project._getProjectDirPath();
    let tempFileDirPath = Project._getTemporaryFileDirName();

    return path.join(projectDirPath, tempFileDirPath);
  }

  static _getProjectDirPath() {
    let dirPath = "./";
    let projectDirName = Project._getProjectDirName();

    return path.join(dirPath, projectDirName);
  }

  static _getUserDirPath(user) {
    if (!exists(user)) throw new Error("User cannot be empty");
    if (!exists(user._id)) throw new Error("User id cannot be empty");

    let projectDirPath = Project._getProjectDirPath();
    let usersDirName = Project._getUsersDirName();
    let userDirName = user._id.toString();

    return path.join(projectDirPath, usersDirName, userDirName);
  }

  static _getFileDirPath(user) {
    let userDirPath = Project._getUserDirPath(user);
    let fileDirName = Project._getFileDirName();

    return path.join(userDirPath, fileDirName);
  }

  static _getModelFileName(model) {
    if (!exists(model)) throw new Error("Model cannot be empty");
    if (!exists(model._id)) throw new Error("Model id cannot be empty");

    return path.join(`${model._id.toString()}.smdl`);
  }

  /**
   * @description Method for getting model file based on user and model
   * @param {Object} user User of model
   * @param {Object} model Object of model
   */
  static getModelFilePath(user, model) {
    let userFileDirPath = Project._getFileDirPath(user);
    let modelFileName = Project._getModelFileName(model);

    return path.join(userFileDirPath, modelFileName);
  }

  /**
   * @description Method for generating project directory if they not exist
   */
  static async generateProjectDirectories() {
    //Generating project path if not exist
    const projectDirPath = Project._getProjectDirPath();
    await createDirIfNotExists(projectDirPath);

    //Generating temporart files directory if not exist
    const temporaryFileDirPath = Project._getTemporaryFileDirPath();
    await createDirIfNotExists(temporaryFileDirPath);

    //Generating users directory if not exist
    const usersDirPath = path.join(projectDirPath, Project._getUsersDirName());
    await createDirIfNotExists(usersDirPath);
  }

  /**
   * @description Method for generating directory of user
   * @param {Object} user User of application
   */
  static async generateUserDirectory(user) {
    //Creating user dir
    let userDirPath = Project._getUserDirPath(user);
    await createDirIfNotExists(userDirPath);

    //Creating file dir
    let fileDirPath = Project._getFileDirPath(user);
    await createDirIfNotExists(fileDirPath);
  }

  /**
   * @description Method for removing directory of user
   * @param {Object} user User of application
   */
  static async removeUserDirectory(user) {
    //Removing user dir
    let userDirPath = Project._getUserDirPath(user);
    await removeDirectoryIfExists(userDirPath);
  }

  /**
   * @description Method for generating directories for users
   * @param {Object} users All users of application
   */
  static async generateUserDirectories(users) {
    for (let user of users) {
      //generating user directory
      await Project.generateUserDirectory(user);
    }
  }
}

module.exports = Project;
