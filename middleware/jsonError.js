module.exports = function(err, req, res, next) {
  if (err) {
    return res.status(400).send("Invalid request content");
  }

  next();
};
