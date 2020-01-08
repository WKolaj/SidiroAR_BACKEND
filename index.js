const { User, validate } = require("./models/user");
const { generateRandomNumberString } = require("./utilities/utilities");

for (let i = 0; i < 10; i++) {
  console.log(generateRandomNumberString(4));
}
