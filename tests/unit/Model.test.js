const Model = require("../../classes/Model");
const config = require("config");
const FileService = require("../../services/FileService");
const path = require("path");
const {
  createDirAsync,
  createFileAsync,
  clearDirectoryAsync,
  checkIfDirectoryExistsAsync,
  checkIfFileExistsAsync,
  readStreamToString
} = require("../../utilities/utilities");

const modelFileExtension = config.get("modelFileExtension");
const filesDirPath = config.get("filesDir");

describe("Model", () => {
  beforeEach(async () => {
    await clearDirectoryAsync(filesDirPath);
  });

  afterEach(async () => {
    await clearDirectoryAsync(filesDirPath);
  });

  describe("constructor", () => {
    let modelName;
    let modelId;
    let userId;

    beforeEach(() => {
      modelName = "testName";
      modelId = "testId";
      userId = "testUserId";
    });

    let exec = () => {
      return new Model(modelId, modelName, userId);
    };

    it("should create new model with name and id set", () => {
      let result = exec();

      expect(result).toBeDefined();
      expect(result.Name).toEqual(modelName);
      expect(result.Id).toEqual(modelId);
      expect(result.UserId).toEqual(userId);
    });

    it("should throw if model name is not defined", () => {
      modelName = undefined;

      expect(() => {
        exec();
      }).toThrow();
    });

    it("should throw if model id is not defined", () => {
      modelId = undefined;

      expect(() => {
        exec();
      }).toThrow();
    });

    it("should throw if userId is not defined", () => {
      userId = undefined;

      expect(() => {
        exec();
      }).toThrow();
    });
  });

  describe("FilePath", () => {
    let modelName;
    let modelId;
    let userId;
    let model;

    beforeEach(() => {
      modelName = "testName";
      modelId = "testId";
      userId = "testUserId";
    });

    let exec = () => {
      model = new Model(modelId, modelName, userId);
      return model.FilePath;
    };

    it("should return virtual path to model file, containing userId and modelId", () => {
      let result = exec();
      expect(result).toBeDefined();

      let expectedResult = path.join(
        userId,
        `${modelId}.${modelFileExtension}`
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe("getFileReadStream", () => {
    let model1;
    let model1Name;
    let model1Id;
    let model1UserId;

    let model2;
    let model2Name;
    let model2Id;
    let model2UserId;

    let fileContent1;
    let fileContent2;

    //Override this method after moving to server api
    let createFileOnServer = async (filePath, fileContent) => {
      //creating dir if not exists
      let dirPath = path.dirname(filePath);
      let dirExists = await checkIfDirectoryExistsAsync(dirPath);
      if (!dirExists) await createDirAsync(dirPath);

      console.log(filePath);

      //creating file
      await createFileAsync(filePath, fileContent);
    };

    beforeEach(() => {
      model1Name = "testModel1";
      model1Id = "testModel1Name";
      model1UserId = "testModel1UserId";
      model2Name = "testModel2";
      model2Id = "testModel2Name";
      model2UserId = "testModel2UserId";

      fileContent1 = "testFile1Content";
      fileContent2 = "testFile2Content";
    });

    let exec = async () => {
      let file1Path = path.join(
        filesDirPath,
        model1UserId,
        `${model1Id}.${config.get("modelFileExtension")}`
      );
      let file2Path = path.join(
        filesDirPath,
        model2UserId,
        `${model2Id}.${config.get("modelFileExtension")}`
      );

      if (fileContent1) await createFileOnServer(file1Path, fileContent1);
      if (fileContent2) await createFileOnServer(file2Path, fileContent2);

      model1 = new Model(model1Id, model1Name, model1UserId);
      model2 = new Model(model2Id, model2Name, model2UserId);

      return {
        result1: model1.getFileReadStream(),
        result2: model2.getFileReadStream()
      };
    };

    it("should return stream read to file given model file - if files are from different users", async () => {
      let result = await exec();
      expect(result).toBeDefined();
      expect(result.result1).toBeDefined();
      expect(result.result2).toBeDefined();

      let streamToFile1 = result.result1;
      let streamToFile2 = result.result2;

      let readResult1 = await readStreamToString(streamToFile1);
      let readResult2 = await readStreamToString(streamToFile2);

      expect(readResult1).toEqual(fileContent1);
      expect(readResult2).toEqual(fileContent2);
    });

    it("should return stream read to file given model file - if files are from same user", async () => {
      //Setting model users as the same
      model1UserId = model2UserId;

      let result = await exec();
      expect(result).toBeDefined();
      expect(result.result1).toBeDefined();
      expect(result.result2).toBeDefined();

      let streamToFile1 = result.result1;
      let streamToFile2 = result.result2;

      let readResult1 = await readStreamToString(streamToFile1);
      let readResult2 = await readStreamToString(streamToFile2);

      expect(readResult1).toEqual(fileContent1);
      expect(readResult2).toEqual(fileContent2);
    });
  });
});
