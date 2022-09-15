const express = require("express");
const serverless = require("serverless-http");
const app = express();
const router = express.Router();

const fs = require("node-fs");
const csv = require("csv-parser");
const request = require("request");
const path = require("path");
const AWS = require("aws-sdk");

router.get("/test", (req, res) => {
  res.json({
    hello: "Hello world!",
  });
});

// ------- File upload Part Start ----------

async function createFile(argsParams) {
  let args = {
    file: {
      value: fs.createReadStream(argsParams.filePath),
      options: {
        filename: null,
        contentType: null,
      },
    },
    file_name: `${argsParams.targetable_id}_${argsParams.datetime}`,
    is_shared: "true",
    targetable_id: argsParams.targetable_id,
    targetable_type: "Deal",
  };

  const optionsParams = {
    method: "POST",
    url: "https://agira-487848471470802978.myfreshworks.com/crm/sales/api/documents",
    headers: {
      Authorization: `Token token=hdfUPukdvZL61x7FxKIptg`,
      "Content-Type": "application/json",
    },
    formData: args,
  };

  await request(optionsParams, function (error) {
    if (error) {
      console.log("create file API error :", error);
    } else {
      console.log("File created successfully ");

      fs.unlinkSync(argsParams.filePath);

      return true;
    }
  });
}

async function readCsvFile(results, s3, csvFilePath) {
  await results.map(async (e) => {
    const targetable_id = e["Contract ID"];
    const fileLocation = e["File Location"];

    // get extension name (ex: .pdf .png)
    const extension = path.extname(fileLocation);

    //get file from s3
    let datetime = new Date().getTime();

    let __dirname = path.resolve();

    //ex : 1020310_1021012100.pdf (expand is : targetableId_datetime.pdf)
    const filePath = path.join(`../${targetable_id}_${datetime}${extension}`);

    var stream = fs.createWriteStream(filePath);

    const fileStream = await s3
      .getObject({
        Bucket: "freshsales.fileupload",
        Key: fileLocation.toString(),
      })
      .createReadStream();

    await fileStream.pipe(stream).on("finish", async () => {
      let argsParams = {
        stream: stream,
        filePath: filePath,
        datetime: datetime,
        targetable_id: targetable_id,
        csvFilePath: csvFilePath,
      };

      await createFile(argsParams);
    });
  });
  if (csvFilePath) {
    fs.unlinkSync(csvFilePath);
  }
}

router.get("/file/upload", async (req, res) => {
  const accessParams = {
    accessKeyId: "AKIATKMMBEY4YXN2QPSG",
    secretAccessKey: "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",
    region: "us-east-1",
  };

  AWS.config.update(accessParams);

  const s3 = new AWS.S3();

  const bucketParams = {
    Bucket: "freshsales.fileupload",
    Key: "TEST file import.csv",
  };

  let __dirname = path.resolve();
  require();

  const csvFilePath = path.join("../TEST file import.csv");

  const s3Stream = await s3.getObject(bucketParams).createReadStream();

  const stream = await fs.createWriteStream(csvFilePath);

  s3Stream.pipe(stream).on("finish", () => {
    const results = [];

    fs.createReadStream(csvFilePath.toString())
      .pipe(csv({}))
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        await readCsvFile(results, s3, csvFilePath);
      });
  });
});

// ------- File upload Part End ------------

app.use(`/.netlify/functions/api`, router);

// app.listen(3000, (error) => {
//   if (!error)
//     console.log(
//       "Server is Successfully Running,and App is listening on port " + 3000
//     );
//   else console.log("Error occurred, server can't start", error);
// });

module.exports = app;
module.exports.handler = serverless(app);
