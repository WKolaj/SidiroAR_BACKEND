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

module.exports.Model = mongoose.model("Model", modelSchema);
module.exports.validateModel = validateModel;
