let mongoose = require("mongoose");

//Method for checking if object id is valid - in order not to return 500
module.exports = function(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id))
    return res.status("404").send("Invalid id...");

  next();
};
