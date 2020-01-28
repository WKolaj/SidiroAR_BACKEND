const express = require("express");
const router = express.Router();
const validateObjectId = require("../middleware/validateObjectId");
const fs = require("fs");
const Project = require("../classes/project");
const hasUser = require("../middleware/auth/hasUser");
const isUser = require("../middleware/auth/isUser");
const { Model } = require("../models/model");
const {
  exists,
  checkIfFileExistsAsync,
  statAsync
} = require("../utilities/utilities");
const _ = require("lodash");
const formidable = require("formidable");
const util = require("util");

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

  let fileStream = fs.createReadStream(modelFilePath);
  fileStream.pipe(res);
});

router.post(
  "/me/:id",
  [hasUser, isUser, validateObjectId],
  async (req, res) => {
    var model = await Model.findOne({ _id: req.params.id, user: req.user._id });

    //returning 404 if model does not exist
    if (!exists(model)) return res.status(404).send("Model not found...");

    let modelFilePath = Project.getModelFilePath(req.user, model);

    let form = new formidable.IncomingForm();

    form.parse(req, (err, fields, files) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.write("received upload:\n\n");
      res.end(util.inspect({ fields: fields, files: files }));
    });

    return;
  }
);

module.exports = router;
