const { exists } = require("../utilities/utilities");
const config = require("config");
const FileService = require("../services/FileService");
const path = require("path");

const modelFileExtension = config.get("modelFileExtension");

class Model {
  /**
   * @description class representing model object
   * @param {string} id id of model
   * @param {string} name name of model
   * @param {string} userId id of user
   */
  constructor(id, name, userId) {
    //Throws if there is something wrong with name or id
    if (!exists(id)) throw new Error("id in model cannot be empty");
    if (!exists(name)) throw new Error("name in model cannot be empty");
    if (!exists(userId)) throw new Error("userId in model cannot be empty");

    this._id = id;
    this._name = name;
    this._userId = userId;
  }

  /**
   * @description Id of model
   */
  get Id() {
    return this._id;
  }

  /**
   * @description Name of model
   */
  get Name() {
    return this._name;
  }

  /**
   * @description Id of model's user
   */
  get UserId() {
    return this._userId;
  }

  /**
   * @description virtual path of file
   */
  get FilePath() {
    return path.join(this.UserId, `${this.Id}.${modelFileExtension}`);
  }

  /**
   * @description getting read stream to models file
   */
  getFileReadStream() {
    return FileService.getFileReadStream(this.FilePath);
  }

  /**
   * @description getting write stream to models file
   */
  getFileWriteStream() {
    return FileService.getFileWriteStream(this.FilePath);
  }
}

module.exports = Model;
