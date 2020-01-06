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
  snooze,
  readStreamToString,
  writeStringToStream
} = require("../../utilities/utilities");

const modelFileExtension = config.get("modelFileExtension");
const filesDirPath = config.get("filesDir");

//Override this method after moving to server api
let createFileOnServer = async (filePath, fileContent) => {
  //creating dir if not exists
  let dirPath = path.dirname(filePath);
  let dirExists = await checkIfDirectoryExistsAsync(dirPath);
  if (!dirExists) await createDirAsync(dirPath);

  //creating file
  await createFileAsync(filePath, fileContent);
};

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

    let getModel1FileStream;
    let getModel2FileStream;

    beforeEach(() => {
      model1Name = "testModel1";
      model1Id = "testModel1Name";
      model1UserId = "testModel1UserId";
      model2Name = "testModel2";
      model2Id = "testModel2Name";
      model2UserId = "testModel2UserId";

      fileContent1 = "testFile1Content";
      fileContent2 = "testFile2Content";

      getModel1FileStream = true;
      getModel2FileStream = true;
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

      //Creating files based on their content
      if (fileContent1) await createFileOnServer(file1Path, fileContent1);
      if (fileContent2) await createFileOnServer(file2Path, fileContent2);

      model1 = new Model(model1Id, model1Name, model1UserId);
      model2 = new Model(model2Id, model2Name, model2UserId);

      let result = {};

      //Getting file stream based on getModelXFileStreamX
      if (getModel1FileStream) result.result1 = model1.getFileReadStream();
      if (getModel2FileStream) result.result2 = model2.getFileReadStream();

      return result;
    };

    it("should return stream read to file of given model file - if files are from different users", async () => {
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

    it("should return stream read to file of given model file - if files are from same user", async () => {
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

    it("should return stream read to file of given model file - if only one file exists", async () => {
      //Disabling creating file2 and reading stream 2
      fileContent2 = null;
      getModel2FileStream = null;

      let result = await exec();
      expect(result).toBeDefined();
      expect(result.result1).toBeDefined();
      expect(result.result2).not.toBeDefined();

      let streamToFile1 = result.result1;

      let readResult1 = await readStreamToString(streamToFile1);

      expect(readResult1).toEqual(fileContent1);
    });

    it("should not throw but return stream that will throw when trying to read it - if there is no file", async () => {
      //Disabling creating file2 and reading stream 2
      fileContent2 = null;
      getModel2FileStream = null;

      fileContent1 = null;

      let result = await exec();
      expect(result).toBeDefined();
      expect(result.result1).toBeDefined();
      expect(result.result2).not.toBeDefined();

      let streamToFile1 = result.result1;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await readStreamToString(streamToFile1);
            return resolve(1);
          } catch (err) {
            return reject(err);
          }
        })
      ).rejects.toThrow();
    });
  });

  describe("getFileWriteStream", () => {
    let model1;
    let model1Name;
    let model1Id;
    let model1UserId;

    let model2;
    let model2Name;
    let model2Id;
    let model2UserId;

    let getModel1FileStream;
    let getModel2FileStream;

    let createUser1Dir;
    let createUser2Dir;

    beforeEach(() => {
      model1Name = "testModel1";
      model1Id = "testModel1Name";
      model1UserId = "testModel1UserId";
      model2Name = "testModel2";
      model2Id = "testModel2Name";
      model2UserId = "testModel2UserId";

      getModel1FileStream = true;
      getModel2FileStream = true;
      createUser1Dir = true;
      createUser2Dir = true;
    });

    let exec = async () => {
      //creating users directories if not exists
      if (createUser1Dir)
        await FileService.createUserDirIfNotExists(model1UserId);
      if (createUser2Dir)
        await FileService.createUserDirIfNotExists(model2UserId);

      model1 = new Model(model1Id, model1Name, model1UserId);
      model2 = new Model(model2Id, model2Name, model2UserId);

      let result = {};

      //Getting file stream based on getModelXFileStreamX
      if (getModel1FileStream) result.result1 = model1.getFileWriteStream();
      if (getModel2FileStream) result.result2 = model2.getFileWriteStream();

      return result;
    };

    it("should return stream write to file of given model file - if files are from different users", async () => {
      let result = await exec();
      expect(result).toBeDefined();
      expect(result.result1).toBeDefined();
      expect(result.result2).toBeDefined();

      let streamToFile1 = result.result1;
      let streamToFile2 = result.result2;

      let fileContent1 = "fileContent1";
      let fileContent2 = "fileContent2";

      //Writeing content to stream
      await writeStringToStream(streamToFile1, fileContent1);
      await writeStringToStream(streamToFile2, fileContent2);

      //streams should have created files successfully

      //Now read them and check if file content has been written successfully

      let readStream1 = model1.getFileReadStream();
      let writtenFileContent1 = await readStreamToString(readStream1);
      expect(writtenFileContent1).toEqual(fileContent1);

      let readStream2 = model2.getFileReadStream();
      let writtenFileContent2 = await readStreamToString(readStream2);
      expect(writtenFileContent2).toEqual(fileContent2);
    });

    it("should return stream write to file of given model file - if files are from same users", async () => {
      //Setting model users as the same
      model1UserId = model2UserId;

      let result = await exec();
      expect(result).toBeDefined();
      expect(result.result1).toBeDefined();
      expect(result.result2).toBeDefined();

      let streamToFile1 = result.result1;
      let streamToFile2 = result.result2;

      let fileContent1 = "fileContent1";
      let fileContent2 = "fileContent2";

      //Writeing content to stream
      await writeStringToStream(streamToFile1, fileContent1);
      await writeStringToStream(streamToFile2, fileContent2);

      //streams should have created files successfully

      //Now read them and check if file content has been written successfully

      let readStream1 = model1.getFileReadStream();
      let writtenFileContent1 = await readStreamToString(readStream1);
      expect(writtenFileContent1).toEqual(fileContent1);

      let readStream2 = model2.getFileReadStream();
      let writtenFileContent2 = await readStreamToString(readStream2);
      expect(writtenFileContent2).toEqual(fileContent2);
    });

    it("should return stream write to file of given model file - if only one file exists", async () => {
      //Setting not to create user2 dir and file 2
      createUser2Dir = false;
      getModel2FileStream = false;

      let result = await exec();
      expect(result).toBeDefined();
      expect(result.result1).toBeDefined();
      expect(result.result2).not.toBeDefined();

      let streamToFile1 = result.result1;

      let fileContent1 = "fileContent1";

      //Writeing content to stream
      await writeStringToStream(streamToFile1, fileContent1);

      //streams should have created files successfully

      //Now read them and check if file content has been written successfully

      let readStream1 = model1.getFileReadStream();
      let writtenFileContent1 = await readStreamToString(readStream1);
      expect(writtenFileContent1).toEqual(fileContent1);
    });

    it("should return stream write to file of given model file and override file - if file already exists", async () => {
      //Setting not to create user2 dir and file 2
      createUser2Dir = false;
      getModel2FileStream = false;

      let result = await exec();
      expect(result).toBeDefined();
      expect(result.result1).toBeDefined();
      expect(result.result2).not.toBeDefined();

      //Creating file on server
      let file1Path = path.join(
        filesDirPath,
        model1UserId,
        `${model1Id}.${config.get("modelFileExtension")}`
      );
      await createFileOnServer(file1Path, "newTestContent2");

      let streamToFile1 = result.result1;

      let fileContent1 = "fileContent1";

      //Writeing content to stream
      await writeStringToStream(streamToFile1, fileContent1);

      //streams should have created files successfully

      //Now read them and check if file content has been written successfully

      let readStream1 = model1.getFileReadStream();
      let writtenFileContent1 = await readStreamToString(readStream1);
      //nt2 comes from overriding previous file
      expect(writtenFileContent1).toEqual(fileContent1 + "nt2");
    });
  });
});
