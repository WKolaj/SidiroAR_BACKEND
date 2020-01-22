const express = require("express");
const router = express.Router();
const config = require("config");
const _ = require("lodash");
const User = require("../models/user").User;
const Model = require("../models/model").Model;
const {
  existsAndIsNotEmpty,
  exists,
  hashedStringMatch
} = require("../utilities/utilities");
const headerName = config.get("tokenHeader");

router.post("/", async (req, res) => {
  if (!exists(req.body)) return res.status(400).send("Invalid request");
  if (!exists(req.body.email))
    return res.status(400).send("Invalid request - email cannot be empty");
  if (!exists(req.body.password))
    return res.status(400).send("Invalid request - password cannot be empty");

  //converting password to string if it is not a string
  req.body.password = req.body.password.toString();

  let user = await User.findOne({ email: req.body.email });

  if (!existsAndIsNotEmpty(user))
    return res.status(400).send("Invalid email or password");

  if (!(await hashedStringMatch(req.body.password, user.password)))
    return res.status(400).send("Invalid email or password");

  //Creating payload to return
  let payloadToReturn = await user.getPayload();

  //assigning jwt to payload to return
  let jwt = await user.generateJWT();
  payloadToReturn.jwt = jwt;

  return res
    .status(200)
    .set(headerName, jwt)
    .send(payloadToReturn);
});

module.exports = router;