const Project = require("../../../classes/project");
const path = require("path");
let testDirPath = "__testDir";
let projectDirPath = Project._getProjectDirPath();
let modelsDirPath = Project._getModelsDirPath();
const {
  clearDirectoryAsync,
  checkIfDirectoryExistsAsync,
  createDirAsync,
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

    it("should create project and models directories  - if they not exist", async () => {
      await exec();

      let projectDirExists = await checkIfDirectoryExistsAsync(projectDirPath);
      expect(projectDirExists).toEqual(true);

      let modelsDirExists = await checkIfDirectoryExistsAsync(modelsDirPath);
      expect(modelsDirExists).toEqual(true);
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

      let modelsDirExists = await checkIfDirectoryExistsAsync(modelsDirPath);
      expect(modelsDirExists).toEqual(true);
    });

    it("should not throw  - if project and models directory already exists", async () => {
      await createDirAsync(projectDirPath);
      await createDirAsync(modelsDirPath);

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

      let modelsDirExists = await checkIfDirectoryExistsAsync(modelsDirPath);
      expect(modelsDirExists).toEqual(true);
    });
  });
});
