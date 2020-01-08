const Joi = require("joi");
const mongoose = require("mongoose");
const { generateRandomNumberString } = require("../utilities/utilities");

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
    permissions: Joi.number().integer()
  };

  return Joi.validate(user, schema);
}

//Method for setting default permissions of user
userSchema.statics.setDefaultPermissions = function(userPayload) {
  //Default permissions - 1 (User)
  userPayload.permissions = 1;
};

//Method for generating random pin for user
userSchema.statics.generateRandomPin = function() {
  return generateRandomNumberString(4);
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

exports.User = mongoose.model("User", userSchema);
exports.validateUser = validateUser;
