const Joi = require("joi");
const mongoose = require("mongoose");
const config = require("config");
const {
  generateRandomNumberString,
  getBit
} = require("../utilities/utilities");
const jwt = require("jsonwebtoken");
const jwtPrivateKey = config.get("jwtPrivateKey");
const { Model } = require("./model");

//hashed password can be longer than 4 signs - use no limition accoridng to max min length
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 100
  },
  email: {
    type: String,
    minlength: 5,
    maxlength: 255,
    unique: true,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  permissions: {
    type: Number,
    required: true,
    min: 0,
    max: 255,
    validate: {
      validator: Number.isInteger,
      message: "{VALUE} is not an integer value"
    }
  }
});

function validateUser(user) {
  const schema = {
    name: Joi.string()
      .min(3)
      .max(100)
      .required(),
    email: Joi.string()
      .email()
      .required(),
    password: Joi.string()
      .regex(/^\d+$/)
      .min(4)
      .max(4),
    permissions: Joi.number()
      .integer()
      .min(0)
      .max(255)
      .required()
  };

  return Joi.validate(user, schema);
}

//Method for generating random pin for user
userSchema.statics.generateRandomPin = function() {
  return generateRandomNumberString(4);
};

//Method for checking if user is admin
userSchema.statics.isAdmin = function(permissions) {
  return getBit(permissions, 1);
};

//Method for checking if user is user
userSchema.statics.isUser = function(permissions) {
  return getBit(permissions, 0);
};

//Method for generating random pin for user
userSchema.statics.generateEmailText = function(name, login, password) {
  return `<h1>Dzień dobry</h1>
            <p>Bardzo dziękuję za rejestrację</p>
            <p>Poniżej umieszczone są login oraz hasło do systemu:</p>
            <p>Login: <b>${login}</b></p>
            <p>Hasło: <b>${password}</b></p>
            <br/>
            <p>Z poważaniem</p>
            <p>SidiroAR</p>`;
};

//Method for generating JWT Token of user
userSchema.methods.generateJWT = async function() {
  let userPayload = {
    _id: this._id.toString(),
    email: this.email,
    name: this.name,
    permissions: this.permissions
  };

  return jwt.sign(userPayload, jwtPrivateKey);
};

//Method for generating model lists of user from database
userSchema.methods.getModels = async function() {
  return await Model.find({ user: this._id });
};

//Method for generating two lists of ids and names of models
userSchema.methods.getModelLists = async function() {
  let modelList = await this.getModels();

  let modelIds = [];
  let modelNames = [];

  for (let model of modelList) {
    modelIds.push(model._id);
    modelNames.push(model.name);
  }

  return {
    ids: modelIds,
    names: modelNames
  };
};

//Method for generating payload of user
userSchema.methods.getPayload = async function() {
  let { ids, names } = await this.getModelLists();

  let userPayload = {
    _id: this._id.toString(),
    email: this.email,
    name: this.name,
    permissions: this.permissions,
    modelNames: names,
    modelIds: ids
  };

  return userPayload;
};

exports.User = mongoose.model("User", userSchema);
exports.validateUser = validateUser;
