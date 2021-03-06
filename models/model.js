const Joi = require("@hapi/joi");
const Project = require("../classes/project");
const mongoose = require("mongoose");
const { checkIfFileExistsAsync } = require("../utilities/utilities");

const modelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 100,
  },
  user: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

//user has to be optional - it is given as params in endpoint
function validateModel(model) {
  const schema = Joi.object({
    name: Joi.string().min(3).max(100).required(),
    user: Joi.array().items(Joi.objectId()).min(1),
  });

  return schema.validate(model);
}

//Method for checking if model file exists
modelSchema.methods.fileExists = async function () {
  return await checkIfFileExistsAsync(Project.getModelFilePath(this));
};

//Method for checking if model file exists
modelSchema.methods.iosFileExists = async function () {
  return await checkIfFileExistsAsync(Project.getModelIOSFilePath(this));
};

//Method for generating payload of model
modelSchema.methods.getPayload = async function () {
  let modelPayload = {
    _id: this._id.toString(),
    name: this.name,
    user: this.user.map((user) => user.toString()),
    fileExists: await this.fileExists(),
    iosFileExists: await this.iosFileExists(),
  };

  return modelPayload;
};

module.exports.Model = mongoose.model("Model", modelSchema);
module.exports.validateModel = validateModel;
