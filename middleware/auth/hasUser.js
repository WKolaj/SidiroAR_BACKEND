const config = require("config");
const jwt = require("jsonwebtoken");

const headerName = config.get("tokenHeader");
const jwtPrivateKey = config.get("jwtPrivateKey");

module.exports = function(req, res, next) {
  let token = req.header(headerName);
  if (!token) return res.status(401).send("Access denied. No token provided");

  try {
    req.user = jwt.verify(token, jwtPrivateKey);

    next();
  } catch (err) {
    return res.status(400).send("Invalid token provided");
  }
};
