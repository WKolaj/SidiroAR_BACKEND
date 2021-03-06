const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Project = require("../classes/project");
const { User } = require("../models/user");
const { Model, validateModel } = require("../models/model");
const validate = require("../middleware/validate");
const validateObjectId = require("../middleware/validateObjectId");
const {
  exists,
  checkIfFileExistsAsync,
  removeFileOrDirectoryAsync,
} = require("../utilities/utilities");
const hasUser = require("../middleware/auth/hasUser");
const isAdmin = require("../middleware/auth/isAdmin");
const isUser = require("../middleware/auth/isUser");
const _ = require("lodash");
const jsonValidation = require("../middleware/jsonError");
const logger = require("../logger/logger");

//assigning JSON parsing to router
router.use(express.json());

//assigning JSON parsing error validation
router.use(jsonValidation);

router.get("/:userId", [hasUser, isAdmin], async (req, res) => {
  //Returning if userId is not defined or invalid
  if (!mongoose.Types.ObjectId.isValid(req.params.userId))
    return res.status("404").send("Invalid user id...");

  //Check if user exists
  let user = await User.findOne({ _id: req.params.userId });
  if (!exists(user)) return res.status("404").send("User not found...");

  //Finding model based on user id
  let models = await Model.find({
    user: req.params.userId,
  });

  //Returning all models payload
  let payloadToReturn = [];

  for (let model of models) {
    let payload = await model.getPayload();
    payloadToReturn.push(payload);
  }

  return res.status(200).send(payloadToReturn);
});

router.get(
  "/:userId/:id",
  [hasUser, isAdmin, validateObjectId],
  async (req, res) => {
    //Returning if userId is not defined or invalid - id was checked previously by validateObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.userId))
      return res.status("404").send("Invalid user id...");

    //Finding model based on user id and model id
    let model = await Model.findOne({
      _id: req.params.id,
      user: req.params.userId,
    });
    if (!exists(model)) return res.status(404).send("Model or user not found");

    //Returning model
    let payloadToReturn = await model.getPayload();
    return res.status(200).send(payloadToReturn);
  }
);

router.post(
  "/:userId",
  [hasUser, isAdmin, validate(validateModel)],
  async (req, res) => {
    //Returning if userId is not defined or invalid
    if (!mongoose.Types.ObjectId.isValid(req.params.userId))
      return res.status("404").send("Invalid user id...");

    //Check if user exists
    let user = await User.findOne({ _id: req.params.userId });
    if (!exists(user)) return res.status("404").send("User not found...");

    //Generating new model
    let model = new Model({ name: req.body.name, user: [req.params.userId] });

    await model.save();

    //Generating payload to return
    let payloadToReturn = await model.getPayload();

    logger.action(`User ${req.user.email} created new model ${model._id}`);

    return res.status(200).send(payloadToReturn);
  }
);

router.delete(
  "/:userId/:id",
  [hasUser, isAdmin, validateObjectId],
  async (req, res) => {
    //Returning if userId is not defined or invalid
    if (!mongoose.Types.ObjectId.isValid(req.params.userId))
      return res.status("404").send("Invalid user id...");

    //Check if user exists
    let user = await User.findOne({ _id: req.params.userId });
    if (!exists(user)) return res.status("404").send("User not found...");

    //Finding model to delete
    let model = await Model.findOne({
      _id: req.params.id,
      user: req.params.userId,
    });

    //Returning if model not found
    if (!exists(model)) return res.status("404").send("Model not found...");

    //Removing userId from model
    model.user = model.user.filter(
      (element) => element.toString() !== user._id.toString()
    );

    //Generating payload to return of deleted model
    let payloadToReturn = null;

    //Checking if model should be deleted or edited
    if (model.user.length > 0) {
      //Editing model only
      await model.save();

      payloadToReturn = await model.getPayload();
    } else {
      //Deleting model
      payloadToReturn = await model.getPayload();

      //removing model
      await Model.deleteOne({ _id: req.params.id });

      //removing model file if exists
      let modelFilePath = Project.getModelFilePath(model);
      let modelFileExists = await checkIfFileExistsAsync(modelFilePath);
      if (modelFileExists) await removeFileOrDirectoryAsync(modelFilePath);

      //removing model file if exists
      let modelIOSFilePath = Project.getModelIOSFilePath(model);
      let modelIOSFileExists = await checkIfFileExistsAsync(modelIOSFilePath);
      if (modelIOSFileExists)
        await removeFileOrDirectoryAsync(modelIOSFilePath);
    }

    logger.action(`User ${req.user.email} deleted model ${model._id}`);

    return res.status(200).send(payloadToReturn);
  }
);

router.put(
  "/:userId/:id",
  [hasUser, isAdmin, validateObjectId, validate(validateModel)],
  async (req, res) => {
    //Returning if userId is not defined or invalid
    if (!mongoose.Types.ObjectId.isValid(req.params.userId))
      return res.status("404").send("Invalid user id...");

    //Check if user exists
    let user = await User.findOne({ _id: req.params.userId });
    if (!exists(user)) return res.status("404").send("User not found...");

    //Finding model to edit
    let model = await Model.findOne({
      _id: req.params.id,
      user: req.params.userId,
    });

    //Returning if model not found
    if (!exists(model)) return res.status("404").send("Model not found...");

    //Editing users if exist
    if (exists(req.body.user)) {
      //If user exists in body - checking if users exists for given array body
      for (let userId of req.body.user) {
        newUser = await User.findOne({ _id: userId });
        if (!exists(newUser))
          return res.status("404").send("User in user property not found ...");
      }

      model.user = req.body.user;
    }

    //Editing name if exists
    if (exists(req.body.name)) model.name = req.body.name;

    //saving edited parameters to database
    await model.save();

    //Generating payload to return of deleted model
    let payloadToReturn = await model.getPayload();

    logger.action(`User ${req.user.email} edited model ${model._id}`);

    return res.status(200).send(payloadToReturn);
  }
);

module.exports = router;
