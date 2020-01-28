const Project = require("../../../classes/project");
const path = require("path");
let testDirPath = "__testDir";
let projectDirPath = Project._getProjectDirPath();
let temporaryDirPath = Project._getTemporaryFileDirPath();
let usersDirPath = path.join(projectDirPath, Project._getUsersDirName());
const {
  clearDirectoryAsync,
  checkIfDirectoryExistsAsync,
  createDirAsync
} = require("../../../utilities/utilities");

describe("Project", () => {
  beforeEach(async () => {
    //Clearing project diretory
    await clearDirectoryAsync(testDirPath);
  });

  afterEach(async () => {
    //Clearing project diretory
    await clearDirectoryAsync(testDirPath);
  });

  describe("generateProjectDirectories", () => {
    let exec = async () => {
      await Project.generateProjectDirectories();
    };

    it("should create project, users directories and temporary file directory - if they not exist", async () => {
      await exec();

      let projectDirExists = await checkIfDirectoryExistsAsync(projectDirPath);
      expect(projectDirExists).toEqual(true);

      let tempFileDirExists = await checkIfDirectoryExistsAsync(
        temporaryDirPath
      );
      expect(tempFileDirExists).toEqual(true);

      let userDirExists = await checkIfDirectoryExistsAsync(usersDirPath);
      expect(userDirExists).toEqual(true);
    });

    it("should not throw and create users directories - if project directory already exists", async () => {
      await createDirAsync(projectDirPath);

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            return reject(err);
          }
        })
      ).resolves.toBeDefined();

      let projectDirExists = await checkIfDirectoryExistsAsync(projectDirPath);
      expect(projectDirExists).toEqual(true);

      let userDirExists = await checkIfDirectoryExistsAsync(usersDirPath);
      expect(userDirExists).toEqual(true);
    });

    it("should not throw  - if project and users directory already exists", async () => {
      await createDirAsync(projectDirPath);
      await createDirAsync(usersDirPath);

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            return reject(err);
          }
        })
      ).resolves.toBeDefined();

      let projectDirExists = await checkIfDirectoryExistsAsync(projectDirPath);
      expect(projectDirExists).toEqual(true);

      let userDirExists = await checkIfDirectoryExistsAsync(usersDirPath);
      expect(userDirExists).toEqual(true);
    });

    it("should not throw  - if project and temporarty file directory already exists", async () => {
      await createDirAsync(projectDirPath);
      await createDirAsync(temporaryDirPath);

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            return reject(err);
          }
        })
      ).resolves.toBeDefined();

      let projectDirExists = await checkIfDirectoryExistsAsync(projectDirPath);
      expect(projectDirExists).toEqual(true);

      let userDirExists = await checkIfDirectoryExistsAsync(usersDirPath);
      expect(userDirExists).toEqual(true);
    });
  });

  describe("generateUserDirectory", () => {
    let generateProjectDir;
    let userPayload;

    beforeEach(async () => {
      generateProjectDir = true;

      userPayload = {
        _id: "user1"
      };
    });

    let exec = async () => {
      if (generateProjectDir) await Project.generateProjectDirectories();

      return Project.generateUserDirectory(userPayload);
    };

    it("should create directory for user", async () => {
      await exec();

      //Checking if user dir exist
      let userDirPath = Project._getUserDirPath(userPayload);
      let userExist = await checkIfDirectoryExistsAsync(userDirPath);
      expect(userExist).toEqual(true);

      //Checking if user file dir exist
      let userFileDirPath = Project._getFileDirPath(userPayload);
      let userFileDirExists = await checkIfDirectoryExistsAsync(
        userFileDirPath
      );
      expect(userFileDirExists).toEqual(true);
    });

    it("should not throw if directory for users already exists", async () => {
      await createDirAsync(projectDirPath);
      await createDirAsync(usersDirPath);

      let userDirPath = Project._getUserDirPath(userPayload);
      await createDirAsync(userDirPath);

      //Creating user file dir
      let userFileDirPath = Project._getFileDirPath(userPayload);
      await createDirAsync(userFileDirPath);

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            return reject(err);
          }
        })
      ).resolves.toBeDefined();

      //Checking if user dir exist
      let userExist = await checkIfDirectoryExistsAsync(userDirPath);
      expect(userExist).toEqual(true);

      //Checking if user file dir exist
      let userFileDirExists = await checkIfDirectoryExistsAsync(
        userFileDirPath
      );
      expect(userFileDirExists).toEqual(true);
    });

    it("should throw if there is no project directory", async () => {
      generateProjectDir = false;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            return reject(err);
          }
        })
      ).rejects.toBeDefined();
    });
  });

  describe("generateUserDirectories", () => {
    let generateProjectDir;
    let usersPayload;

    beforeEach(async () => {
      generateProjectDir = true;

      usersPayload = [
        {
          _id: "user1"
        },
        {
          _id: "user2"
        },
        {
          _id: "user3"
        }
      ];
    });

    let exec = async () => {
      if (generateProjectDir) await Project.generateProjectDirectories();

      return Project.generateUserDirectories(usersPayload);
    };

    it("should create directory for all users", async () => {
      await exec();

      for (let user of usersPayload) {
        //Checking if user dir exist
        let userDirPath = Project._getUserDirPath(user);
        let userExist = await checkIfDirectoryExistsAsync(userDirPath);
        expect(userExist).toEqual(true);

        //Checking if user file dir exist
        let userFileDirPath = Project._getFileDirPath(user);
        let userFileDirExists = await checkIfDirectoryExistsAsync(
          userFileDirPath
        );
        expect(userFileDirExists).toEqual(true);
      }
    });

    it("should not throw if directories for users already exists", async () => {
      await createDirAsync(projectDirPath);
      await createDirAsync(usersDirPath);

      for (let user of usersPayload) {
        //Creating user dir
        let userDirPath = Project._getUserDirPath(user);
        await createDirAsync(userDirPath);

        //Creating user file dir
        let userFileDirPath = Project._getFileDirPath(user);
        await createDirAsync(userFileDirPath);
      }

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            return reject(err);
          }
        })
      ).resolves.toBeDefined();

      //All directories should not be deleted
      for (let user of usersPayload) {
        //Checking if user dir exist
        let userDirPath = Project._getUserDirPath(user);
        let userExist = await checkIfDirectoryExistsAsync(userDirPath);
        expect(userExist).toEqual(true);

        //Checking if user file dir exist
        let userFileDirPath = Project._getFileDirPath(user);
        let userFileDirExists = await checkIfDirectoryExistsAsync(
          userFileDirPath
        );
        expect(userFileDirExists).toEqual(true);
      }
    });

    it("should throw if there is no project directory", async () => {
      generateProjectDir = false;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            return reject(err);
          }
        })
      ).rejects.toBeDefined();
    });
  });

  describe("removeUserDirectory", () => {
    let generateProjectDir;
    let generateUsersDir;
    let usersPayload;
    let userToDelete;

    beforeEach(async () => {
      generateProjectDir = true;
      generateUsersDir = true;

      usersPayload = [
        {
          _id: "user1"
        },
        {
          _id: "user2"
        },
        {
          _id: "user3"
        }
      ];

      userToDelete = usersPayload[1];
    });

    let exec = async () => {
      if (generateProjectDir) await Project.generateProjectDirectories();
      if (generateUsersDir) await Project.generateUserDirectories(usersPayload);

      return Project.generateUserDirectories(usersPayload);
    };

    it("should remove directory for given user", async () => {
      await exec();

      for (let user of usersPayload) {
        //Checking if user dir exist
        let userDirPath = Project._getUserDirPath(user);
        let userExist = await checkIfDirectoryExistsAsync(userDirPath);

        //if user is a user to delete - there should be no associated directory, otherwise directory should not have been deleted
        if (user === userToDelete) expect(userExist).toEqual(true);
        else expect(userExist).toEqual(true);
      }
    });

    it("should not throw if there is no directory for given user", async () => {
      generateUsersDir = false;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            return reject(err);
          }
        })
      ).resolves.toBeDefined();
    });

    it("should throw if there is no project directory", async () => {
      generateProjectDir = false;
      generateUsersDir = false;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            return reject(err);
          }
        })
      ).rejects.toBeDefined();
    });
  });
});
