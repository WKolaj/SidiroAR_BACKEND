const express = require("express");
const router = express.Router();
const { User, validateUser } = require("../models/user");
const { sendMail } = require("../services/EmailService");
const validate = require("../middleware/validate");
const validateObjectId = require("../middleware/validateObjectId");
const { exists, hashString } = require("../utilities/utilities");
const hasUser = require("../middleware/auth/hasUser");
const isAdmin = require("../middleware/auth/isAdmin");
const isUser = require("../middleware/auth/isUser");
const _ = require("lodash");

router.get("/", [hasUser, isAdmin], async (req, res) => {
  var allUsers = await User.find();

  let payloadToReturn = [];

  for (let user of allUsers) {
    payloadToReturn.push(await user.getPayload());
  }

  return res.status(200).send(payloadToReturn);
});

router.get("/me", [hasUser, isUser], async (req, res) => {
  let user = await User.findOne({ _id: req.user._id });
  if (!exists(user)) return res.status(404).send("User not found");

  //Building payload to return
  let payloadToReturn = await user.getPayload();

  return res.status(200).send(payloadToReturn);
});

router.get("/:id", [hasUser, isAdmin, validateObjectId], async (req, res) => {
  let user = await User.findOne({ _id: req.params.id });
  if (!exists(user)) return res.status(404).send("User not found");

  //Building payload to return
  let payloadToReturn = await user.getPayload();

  return res.status(200).send(payloadToReturn);
});

router.post(
  "/",
  [hasUser, isAdmin, validate(validateUser)],
  async (req, res) => {
    //Checking if email is defined - has to be defined when posting, but not when putting
    if (!exists(req.body.email))
      return res.status(400).send('"email" property has to be defined!');

    //Checking if user already exists
    let user = await User.findOne({ email: req.body.email });
    if (exists(user)) return res.status(400).send("User already registered.");

    //Setting password as random one if user's password do not exist
    if (!exists(req.body.password))
      req.body.password = User.generateRandomPin();

    let passwordBeforeHash = req.body.password;

    //Hash password
    req.body.password = await hashString(req.body.password);

    //Create and save new user
    user = new User(
      _.pick(req.body, ["name", "email", "password", "permissions"])
    );
    await user.save();

    //Sending email - it is not neccessary to wait until it has been finished
    sendMail(
      user.email,
      "Rejestracja SidiroAR",
      User.generateEmailText(user.name, user.email, passwordBeforeHash)
    );

    //Building payload to return
    let payloadToReturn = await user.getPayload();

    //Assigning password additionaly
    payloadToReturn.password = passwordBeforeHash;

    return res.status(200).send(payloadToReturn);
  }
);

router.delete(
  "/:id",
  [hasUser, isAdmin, validateObjectId],
  async (req, res) => {
    let user = await User.findById(req.params.id);
    if (!exists(user)) return res.status(404).send("User not found");

    let payloadToReturn = await user.getPayload();

    //Deleting models of given user
    await user.deleteModels();

    //Deleting user
    await User.deleteOne({ _id: req.params.id });

    return res.status(200).send(payloadToReturn);
  }
);

router.put(
  "/:id",
  [hasUser, isAdmin, validateObjectId, validate(validateUser)],
  async (req, res) => {
    //Id has to be defined
    let user = await User.findById(req.params.id);
    if (!exists(user)) return res.status(404).send("User not found");

    //Checking if given email is proper
    if (req.body.email !== user.email)
      return res.status(400).send("Invalid email for given user");

    if (exists(req.body.name)) user.name = req.body.name;
    if (exists(req.body.permissions)) user.permissions = req.body.permissions;

    //Changing password if given
    let passwordToChange = null;
    if (exists(req.body.password)) {
      passwordToChange = req.body.password;

      //Hash and set new password
      user.password = await hashString(passwordToChange);
    }

    //Saving changes
    await user.save();

    let payloadToReturn = await user.getPayload();

    return res.status(200).send(payloadToReturn);
  }
);

module.exports = router;
