const Joi = require("joi");
const { User } = require("./user");
const mongoose = require("mongoose");
const path = require("path");

const modelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 50
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
});

function validateModel(model) {
  const schema = {
    name: Joi.string()
      .min(3)
      .max(50)
      .required(),
    user: Joi.objectId().required()
  };

  return Joi.validate(model, schema);
}

//Method for generating payload of model
modelSchema.methods.getPayload = async function() {
  let userPayload = {
    _id: this._id.toString(),
    name: this.name,
    user: this.user
  };

  return userPayload;
};

module.exports.Model = mongoose.model("Model", modelSchema);
module.exports.validateModel = validateModel;
