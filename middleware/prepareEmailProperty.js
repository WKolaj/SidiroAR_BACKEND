let { exists } = require("../utilities/utilities");

module.exports = function (req, res, next) {
  if (!exists(req.body.email))
    return res.status(400).send("Invalid request - email cannot be empty");

  req.body.email = req.body.email.toLowerCase();

  next();
};
