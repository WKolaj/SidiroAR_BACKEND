const Joi = require("joi");
const mongoose = require("mongoose");
const config = require("config");
const {
  generateRandomString,
  getBit,
  checkIfFileExistsAsync,
  removeFileOrDirectoryAsync,
} = require("../utilities/utilities");
const jwt = require("jsonwebtoken");
const jwtPrivateKey = config.get("jwtPrivateKey");
const { Model } = require("./model");
const {
  generateEmailContent,
  generateEmailSubject,
} = require("../services/EmailService/EmailService");
const { getModelFilePath, getModelIOSFilePath } = require("../classes/project");
const { urlencoded } = require("express");

const possibleLanguages = ["pl", "en"];

//hashed password can be longer than 4 signs - use no limition accoridng to max min length
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 100,
  },
  email: {
    type: String,
    minlength: 5,
    maxlength: 255,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    maxlength: 255,
  },
  permissions: {
    type: Number,
    required: true,
    min: 0,
    max: 255,
    validate: {
      validator: Number.isInteger,
      message: "{VALUE} is not an integer value",
    },
  },
  defaultLang: {
    type: String,
    enum: possibleLanguages,
    default: possibleLanguages[0],
  },
  additionalInfo: {
    type: Object,
    default: {},
  },
});

function validateUser(user) {
  const schema = {
    name: Joi.string().min(3).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(255),
    oldPassword: Joi.string(),
    permissions: Joi.number().integer().min(0).max(255).required(),
    defaultLang: Joi.valid(possibleLanguages).optional(),
    additionalInfo: Joi.object().optional(),
  };

  return Joi.validate(user, schema);
}

//Method for generating random password for user
userSchema.statics.generateRandomPassword = function () {
  return generateRandomString(8);
};

//Method for checking if user is super admin
userSchema.statics.isSuperAdmin = function (permissions) {
  return getBit(permissions, 2);
};

//Method for checking if user is admin
userSchema.statics.isAdmin = function (permissions) {
  return getBit(permissions, 1);
};

//Method for checking if user is user
userSchema.statics.isUser = function (permissions) {
  return getBit(permissions, 0);
};

//Method for generating email text
userSchema.statics.generateEmailText = async function (
  name,
  login,
  password,
  defaultLang
) {
  return await generateEmailContent(login, password, defaultLang);
};

//Method for generating users subject
userSchema.statics.generateEmailSubject = async function (defaultLang) {
  return await generateEmailSubject(defaultLang);
};

//Method for generating JWT Token of user
userSchema.methods.generateJWT = async function () {
  let userPayload = {
    _id: this._id.toString(),
    email: this.email,
    name: this.name,
    permissions: this.permissions,
    defaultLang: this.defaultLang,
    additionalInfo: this.additionalInfo,
  };

  return jwt.sign(userPayload, jwtPrivateKey);
};

//Method for generating model lists of user from database
userSchema.methods.getModels = async function () {
  return Model.find({ user: this._id });
};

//Method for all deleting model assigned to user
userSchema.methods.deleteModels = async function () {
  //Getting all models
  let modelsOfUser = await Model.find({ user: this._id });

  //Deleting all files of models - if they exists and user was the only user
  for (let model of modelsOfUser) {
    if (
      model.user.length === 1 &&
      model.user.toString() === this._id.toString()
    ) {
      //User is the only user of given model

      //deleting model from db
      await model.remove();

      let filePath = getModelFilePath(model);
      if (await checkIfFileExistsAsync(filePath))
        await removeFileOrDirectoryAsync(filePath);

      let iosFilePath = getModelIOSFilePath(model);
      if (await checkIfFileExistsAsync(iosFilePath))
        await removeFileOrDirectoryAsync(iosFilePath);
    } else {
      //User is not the only user of given model

      //Updating model
      model.user = model.user.filter(
        (user) => user._id.toString() !== this._id.toString()
      );

      await model.save();
    }
  }
};

//Method for generating two lists of ids and names of models
userSchema.methods.getModelLists = async function () {
  let modelList = await this.getModels();

  let modelIds = [];
  let modelNames = [];
  let fileExists = [];
  let iosFileExists = [];

  for (let model of modelList) {
    modelIds.push(model._id.toString());
    modelNames.push(model.name.toString());
    fileExists.push(await model.fileExists());
    iosFileExists.push(await model.iosFileExists());
  }

  return {
    ids: modelIds,
    names: modelNames,
    filesExist: fileExists,
    iosFilesExist: iosFileExists,
  };
};

//Method for generating payload of user
userSchema.methods.getPayload = async function () {
  let { ids, names, filesExist, iosFilesExist } = await this.getModelLists();

  let userPayload = {
    _id: this._id.toString(),
    email: this.email,
    name: this.name,
    permissions: this.permissions,
    defaultLang: this.defaultLang,
    additionalInfo: this.additionalInfo,
    modelNames: names,
    modelIds: ids,
    filesExist: filesExist,
    iosFilesExist: iosFilesExist,
  };

  return userPayload;
};

exports.User = mongoose.model("User", userSchema);
exports.validateUser = validateUser;
