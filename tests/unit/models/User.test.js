const { User } = require("../../../models/user");
const { setBit, clearBit } = require("../../../utilities/utilities");

describe("User", () => {
  describe("isAdmin", () => {
    let permissions;

    beforeEach(() => {
      permissions = 2;
    });

    let exec = () => {
      return User.isAdmin(permissions);
    };

    it("should return true if bit 1 of permissions is set to 1", () => {
      permissions = setBit(0, 1);

      let result = exec();

      expect(result).toEqual(true);
    });

    it("should return false if bit 1 of permissions is set to 0", () => {
      permissions = clearBit(255, 1);

      let result = exec();

      expect(result).toEqual(false);
    });

    it("should return true if several bits (also 1) are set", () => {
      permissions = 255;

      let result = exec();

      expect(result).toEqual(true);
    });

    it("should return false if several bits (also 1) are cleared", () => {
      permissions = 0;

      let result = exec();

      expect(result).toEqual(false);
    });
  });

  describe("isUser", () => {
    let permissions;

    beforeEach(() => {
      permissions = 1;
    });

    let exec = () => {
      return User.isUser(permissions);
    };

    it("should return true if bit 0 of permissions is set to 1", () => {
      permissions = setBit(0, 0);

      let result = exec();

      expect(result).toEqual(true);
    });

    it("should return false if bit 1 of permissions is set to 0", () => {
      permissions = clearBit(255, 0);

      let result = exec();

      expect(result).toEqual(false);
    });

    it("should return true if several bits (also 1) are set", () => {
      permissions = 255;

      let result = exec();

      expect(result).toEqual(true);
    });

    it("should return false if several bits (also 1) are cleared", () => {
      permissions = 0;

      let result = exec();

      expect(result).toEqual(false);
    });
  });
});
