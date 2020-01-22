const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { User } = require("../models/user");
const { Model, validateModel } = require("../models/model");
const validate = require("../middleware/validate");
const validateObjectId = require("../middleware/validateObjectId");
const { exists } = require("../utilities/utilities");
const hasUser = require("../middleware/auth/hasUser");
const isAdmin = require("../middleware/auth/isAdmin");
const isUser = require("../middleware/auth/isUser");
const _ = require("lodash");

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
      user: req.params.userId
    });
    if (!exists(model)) return res.status(404).send("Model or user not found");

    //Returning model
    let payloadToReturn = await model.getPayload();
    return res.status(200).send(payloadToReturn);
  }
);

module.exports = router;
