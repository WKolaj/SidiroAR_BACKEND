const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const validateObjectId = require("../middleware/validateObjectId");
const fs = require("fs");
const logger = require("../logger/logger");
const Project = require("../classes/project");
const hasUser = require("../middleware/auth/hasUser");
const isUser = require("../middleware/auth/isUser");
const isAdmin = require("../middleware/auth/isAdmin");
const { Model } = require("../models/model");
const { User } = require("../models/user");
const {
  exists,
  existsAndIsNotEmpty,
  checkIfFileExistsAsync,
  statAsync,
  renameAsync,
  removeFileOrDirectoryAsync
} = require("../utilities/utilities");
const _ = require("lodash");
const formidable = require("formidable");

//Routes for Android

router.get("/me/:id", [hasUser, isUser, validateObjectId], async (req, res) => {
  var model = await Model.findOne({ _id: req.params.id, user: req.user._id });

  //returning 404 if model does not exist
  if (!exists(model)) return res.status(404).send("Model not found...");

  let modelFilePath = Project.getModelFilePath(req.user, model);

  //Checking if file exists
  let fileExists = await checkIfFileExistsAsync(modelFilePath);
  if (!fileExists) return res.status(404).send("Model file not found...");

  //Calculating size of file
  let stat = await statAsync(modelFilePath);

  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Content-Length": stat.size
  });

  logger.action(
    `User ${req.user.email} started downloading android file for model ${model._id}`
  );

  let fileStream = fs.createReadStream(modelFilePath);
  fileStream.pipe(res);
});

router.post(
  "/:userId/:id",
  [hasUser, isAdmin, validateObjectId],
  async (req, res) => {
    //Returning if userId is not defined or invalid
    if (!mongoose.Types.ObjectId.isValid(req.params.userId))
      return res.status("404").send("Invalid user id...");

    //Check if user exists
    let user = await User.findOne({ _id: req.params.userId });
    if (!exists(user)) return res.status("404").send("User not found...");

    //Check if model exists
    var model = await Model.findOne({ _id: req.params.id, user: user._id });
    if (!exists(model)) return res.status(404).send("Model not found...");

    let modelFilePath = Project.getModelFilePath(user, model);

    //Setting up formidable
    let form = new formidable.IncomingForm();
    form.keepExtensions = false;
    //file size limit per model - 200 MB
    form.maxFileSize = 200 * 1024 * 1024;

    form.parse(req, async (err, fields, files) => {
      try {
        if (exists(err)) throw err;

        if (!existsAndIsNotEmpty(files) && !existsAndIsNotEmpty(files.file))
          throw new Error("File content not exists or is empty!");

        //Moving file to model directory
        let tmpFilePath = files.file.path;

        if (!exists(tmpFilePath))
          throw new Error("File path is empty after upload!");
        await renameAsync(tmpFilePath, modelFilePath);

        logger.action(
          `User ${req.user.email} uploaded android file for model ${model._id}`
        );

        //returning respone
        return res
          .status(200)
          .set("Content-Type", "text/plain")
          .send("File successfully uploaded!");
      } catch (error) {
        logger.error(error.message, error);
        return res.status(500).send("Error during uploading file...");
      }
    });
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

    //Check if model exists
    var model = await Model.findOne({ _id: req.params.id, user: user._id });
    if (!exists(model)) return res.status(404).send("Model not found...");

    let modelFilePath = Project.getModelFilePath(user, model);

    //Check if model file exists
    let fileExists = await checkIfFileExistsAsync(modelFilePath);
    if (!fileExists)
      return res.status(404).send("Model file does not exist...");

    await removeFileOrDirectoryAsync(modelFilePath);

    logger.action(
      `User ${req.user.email} deleted android file for model ${model._id}`
    );

    return res.status(200).send("File successfully deleted!");
  }
);

//Routes for IOS

router.get(
  "/ios/me/:id",
  [hasUser, isUser, validateObjectId],
  async (req, res) => {
    var model = await Model.findOne({ _id: req.params.id, user: req.user._id });

    //returning 404 if model does not exist
    if (!exists(model)) return res.status(404).send("Model not found...");

    let modelFilePath = Project.getModelIOSFilePath(req.user, model);

    //Checking if file exists
    let fileExists = await checkIfFileExistsAsync(modelFilePath);
    if (!fileExists) return res.status(404).send("Model file not found...");

    //Calculating size of file
    let stat = await statAsync(modelFilePath);

    logger.action(
      `User ${req.user.email} started downloading ios file for model ${model._id}`
    );

    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": stat.size
    });

    let fileStream = fs.createReadStream(modelFilePath);
    fileStream.pipe(res);
  }
);

router.post(
  "/ios/:userId/:id",
  [hasUser, isAdmin, validateObjectId],
  async (req, res) => {
    //Returning if userId is not defined or invalid
    if (!mongoose.Types.ObjectId.isValid(req.params.userId))
      return res.status("404").send("Invalid user id...");

    //Check if user exists
    let user = await User.findOne({ _id: req.params.userId });
    if (!exists(user)) return res.status("404").send("User not found...");

    //Check if model exists
    var model = await Model.findOne({ _id: req.params.id, user: user._id });
    if (!exists(model)) return res.status(404).send("Model not found...");

    let modelFilePath = Project.getModelIOSFilePath(user, model);

    //Setting up formidable
    let form = new formidable.IncomingForm();
    form.keepExtensions = false;
    //file size limit per model - 200 MB
    form.maxFileSize = 200 * 1024 * 1024;

    form.parse(req, async (err, fields, files) => {
      try {
        if (exists(err)) throw err;

        if (!existsAndIsNotEmpty(files) && !existsAndIsNotEmpty(files.file))
          throw new Error("File content not exists or is empty!");

        //Moving file to model directory
        let tmpFilePath = files.file.path;

        if (!exists(tmpFilePath))
          throw new Error("File path is empty after upload!");
        await renameAsync(tmpFilePath, modelFilePath);

        logger.action(
          `User ${req.user.email} uploaded ios file for model ${model._id}`
        );

        //returning respone
        return res
          .status(200)
          .set("Content-Type", "text/plain")
          .send("File successfully uploaded!");
      } catch (error) {
        logger.error(error.message, error);
        return res.status(500).send("Error during uploading file...");
      }
    });
  }
);

router.delete(
  "/ios/:userId/:id",
  [hasUser, isAdmin, validateObjectId],
  async (req, res) => {
    //Returning if userId is not defined or invalid
    if (!mongoose.Types.ObjectId.isValid(req.params.userId))
      return res.status("404").send("Invalid user id...");

    //Check if user exists
    let user = await User.findOne({ _id: req.params.userId });
    if (!exists(user)) return res.status("404").send("User not found...");

    //Check if model exists
    var model = await Model.findOne({ _id: req.params.id, user: user._id });
    if (!exists(model)) return res.status(404).send("Model not found...");

    let modelFilePath = Project.getModelIOSFilePath(user, model);

    //Check if model file exists
    let fileExists = await checkIfFileExistsAsync(modelFilePath);
    if (!fileExists)
      return res.status(404).send("Model file does not exist...");

    await removeFileOrDirectoryAsync(modelFilePath);

    logger.action(
      `User ${req.user.email} deleted ios file for model ${model._id}`
    );

    return res.status(200).send("File successfully deleted!");
  }
);

module.exports = router;
