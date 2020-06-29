const config = require("config");
const path = require("path");
const {
  exists,
  createDirIfNotExists,
  removeDirectoryIfExists,
} = require("../utilities/utilities");
const mongoose = require("mongoose");

class Project {
  static _getProjectDirName() {
    return config.get("projectDir");
  }

  static _getModelsDirName() {
    return config.get("modelsDir");
  }

  static _getProjectDirPath() {
    let dirPath = "./";
    let projectDirName = Project._getProjectDirName();

    return path.join(dirPath, projectDirName);
  }

  static _getModelsDirPath() {
    let projectDirPath = Project._getProjectDirPath();
    let modelsDirName = Project._getModelsDirName();

    return path.join(projectDirPath, modelsDirName);
  }

  static _getModelFileName(model) {
    if (!exists(model)) throw new Error("Model cannot be empty");
    if (!exists(model._id)) throw new Error("Model id cannot be empty");

    return path.join(`${model._id.toString()}.smdl`);
  }

  static _getModelIOSFileName(model) {
    if (!exists(model)) throw new Error("Model cannot be empty");
    if (!exists(model._id)) throw new Error("Model id cannot be empty");

    return path.join(`${model._id.toString()}.ismdl`);
  }

  /**
   * @description Method for getting model file based on user and model
   * @param {Object} model Object of model
   */
  static getModelFilePath(model) {
    let modelsDirPath = Project._getModelsDirPath();
    let modelFileName = Project._getModelFileName(model);

    return path.join(modelsDirPath, modelFileName);
  }

  /**
   * @description Method for getting model file based on user and model
   * @param {Object} model Object of model
   */
  static getModelIOSFilePath(model) {
    let modelsDirPath = Project._getModelsDirPath();
    let modelFileName = Project._getModelIOSFileName(model);

    return path.join(modelsDirPath, modelFileName);
  }

  /**
   * @description Method for generating project directory if they not exist
   */
  static async generateProjectDirectories() {
    //Generating project path if not exist
    const projectDirPath = Project._getProjectDirPath();
    await createDirIfNotExists(projectDirPath);

    //Generating users directory if not exist
    const modelsDirPath = Project._getModelsDirPath();
    await createDirIfNotExists(modelsDirPath);
  }
}

module.exports = Project;
