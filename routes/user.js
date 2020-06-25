const express = require("express");
const router = express.Router();
const { User, validateUser } = require("../models/user");
const Project = require("../classes/project");
const { sendMail } = require("../services/EmailService/EmailService");
const validate = require("../middleware/validate");
const validateObjectId = require("../middleware/validateObjectId");
const {
  exists,
  hashString,
  hashedStringMatch,
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

    //Checking if user permissions are admin - making it possible only for superAdmin to create admins or superAdmins and superAdmin users
    if (
      (User.isAdmin(req.body.permissions) ||
        User.isSuperAdmin(req.body.permissions)) &&
      !User.isSuperAdmin(req.user.permissions)
    )
      return res
        .status(401)
        .send("Access denied. Only superAdmin can create admins");

    //Setting password as random one if user's password do not exist
    if (!exists(req.body.password))
      req.body.password = User.generateRandomPin();

    let passwordBeforeHash = req.body.password;

    //Hash password
    req.body.password = await hashString(req.body.password);

    //Create and save new user
    user = new User(
      _.pick(req.body, [
        "name",
        "email",
        "password",
        "permissions",
        "defaultLang",
        "additionalInfo",
      ])
    );

    await user.save();

    //Generating user directory
    await Project.generateUserDirectory(user);

    //Generating email text
    let emailText = await User.generateEmailText(
      user.name,
      user.email,
      passwordBeforeHash
    );

    //Sending email - it is not neccessary to wait until it has been finished
    sendMail(user.email, "Rejestracja SidiroAR", emailText);

    //Building payload to return
    let payloadToReturn = await user.getPayload();

    //Assigning password additionaly
    payloadToReturn.password = passwordBeforeHash;

    logger.action(`User ${req.user.email} created user ${user.email}`);

    return res.status(200).send(payloadToReturn);
  }
);

router.delete(
  "/:id",
  [hasUser, isAdmin, validateObjectId],
  async (req, res) => {
    let user = await User.findById(req.params.id);
    if (!exists(user)) return res.status(404).send("User not found");

    //Checking if user permissions are admin - making it possible only for superAdmin to delete admins or superAdmins and superAdmin users
    if (
      (User.isAdmin(user.permissions) || User.isSuperAdmin(user.permissions)) &&
      !User.isSuperAdmin(req.user.permissions)
    )
      return res
        .status(401)
        .send("Access denied. Only superAdmin can delete admins");

    let payloadToReturn = await user.getPayload();

    //Deleting models of given user
    await user.deleteModels();

    //Deleting user
    await User.deleteOne({ _id: req.params.id });

    //Remvoing user directory
    await Project.removeUserDirectory(user);

    logger.action(`User ${req.user.email} deleted user ${user.email}`);

    return res.status(200).send(payloadToReturn);
  }
);

router.put(
  "/me",
  [hasUser, isUser, validate(validateUser)],
  async (req, res) => {
    let user = await User.findOne({ _id: req.user._id });
    if (!exists(user)) return res.status(404).send("User not found");

    //Checking if given email is proper
    if (req.body.email !== user.email)
      return res.status(400).send("Invalid email for given user");

    //Checking if given permissions is proper
    if (req.body.permissions !== user.permissions)
      return res.status(400).send("Invalid permissions for given user");

    if (exists(req.body.name)) user.name = req.body.name;
    if (exists(req.body.additionalInfo))
      user.additionalInfo = req.body.additionalInfo;
    if (exists(req.body.defaultLang)) user.defaultLang = req.body.defaultLang;

    //Checking if password exists - and edit it if exists
    if (exists(req.body.password)) {
      //old Password should also be defined and has to be valid
      if (!exists(req.body.oldPassword))
        return res.status(400).send("Old password should be provided");

      let oldPasswordMatches = await hashedStringMatch(
        req.body.oldPassword,
        user.password
      );
      if (!oldPasswordMatches)
        return res.status(400).send("Invalid old password");

      //changing password
      user.password = await hashString(req.body.password);
    }

    //Saving changes
    await user.save();

    let payloadToReturn = await user.getPayload();

    logger.action(`User ${req.user.email} updated their profile data`);

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

    //Checking if user permissions are admin - making it possible only for superAdmin to change admins or superAdmins users
    if (
      (User.isAdmin(user.permissions) || User.isSuperAdmin(user.permissions)) &&
      !User.isSuperAdmin(req.user.permissions)
    )
      return res
        .status(401)
        .send("Access denied. Only superAdmin can edit admins");

    if (exists(req.body.name)) user.name = req.body.name;
    if (exists(req.body.additionalInfo))
      user.additionalInfo = req.body.additionalInfo;
    if (exists(req.body.defaultLang)) user.defaultLang = req.body.defaultLang;

    if (exists(req.body.permissions)) {
      //Checking if new permissions are admin or userAdmin - making it possible only for superAdmin to change update users to admin or superAdmins
      if (
        (User.isAdmin(req.body.permissions) ||
          User.isSuperAdmin(req.body.permissions)) &&
        !User.isSuperAdmin(req.user.permissions)
      )
        return res
          .status(401)
          .send("Access denied. Only superAdmin can promote users to admins");

      user.permissions = req.body.permissions;
    }

    //Changing password if given
    let passwordToChange = null;
    if (exists(req.body.password)) {
      passwordToChange = req.body.password;

      //Hash and set new password
      user.password = await hashString(passwordToChange);
    }

    //Saving changes
    await user.save();

    logger.action(
      `User ${req.user.email} updated profile data of user ${user.email}`
    );

    let payloadToReturn = await user.getPayload();

    return res.status(200).send(payloadToReturn);
  }
);

module.exports = router;
