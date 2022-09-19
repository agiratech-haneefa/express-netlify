const express = require("express");
const serverless = require("serverless-http");
const app = express();
const router = express.Router();
const process = require("process");

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
    process.traceDeprecation = true;

    const targetable_id = e["Contract ID"];
    const fileLocation = e["File Location"];

    // get extension name (ex: .pdf .png)
    const extension = path.extname(fileLocation);

    //get file from s3
    let datetime = new Date().getTime();

    let __dirname = path.resolve();

    //ex : 1020310_1021012100.pdf (expand is : targetableId_datetime.pdf)
    const filePath = path.join(
      __dirname,
      `../../${targetable_id}_${datetime}${extension}`
    );

    var dir = `./files/${targetable_id}_${datetime}${extension}`;

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    console.log("pr 1:", process.traceDeprecation);

    var stream = fs.createWriteStream(filePath);
    console.log("pr 2:", process.traceDeprecation);

    try {
      const fileStream = await s3
        .getObject({
          Bucket: "freshsales.fileupload",
          Key: fileLocation.toString(),
        })
        .createReadStream();

      console.log("pr 3 :", process.traceDeprecation);

      await fileStream.pipe(stream).on("finish", async () => {
        let argsParams = {
          stream: stream,
          filePath: filePath,
          datetime: datetime,
          targetable_id: targetable_id,
          csvFilePath: csvFilePath,
        };

        try {
          await createFile(argsParams);
        } catch (error) {
          console.log("createFile function err :", error);
        }
      });
    } catch (error) {
      console.log("fileStream - Get files from s3 err :", error);
    }
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

  var csvDir = `./csvFile`;

  if (!fs.existsSync(csvDir)) {
    var a = fs.mkdirSync(csvDir, { recursive: true });

    console.log(a);
    // const csvFilePath = path.join(a, `TEST file import.csv`);
    // console.log("csv file path :", csvFilePath);
  }

  return;
  try {
    const s3Stream = await s3.getObject(bucketParams).createReadStream();

    const stream = await fs.createWriteStream(csvFilePath);

    s3Stream.pipe(stream).on("finish", () => {
      const results = [];

      fs.createReadStream(csvFilePath.toString())
        .pipe(csv({}))
        .on("data", (data) => results.push(data))
        .on("end", async () => {
          try {
            await readCsvFile(results, s3, csvFilePath);
          } catch (error) {
            console.log(" readCsvFile -read csv file function error :", error);
          }
        });
    });
  } catch (error) {
    console.log("s3Stream - Get csv from s3 error :", error);
  }
});

// ------- File upload Part End ------------

app.use(`/.netlify/functions/api`, router);

app.listen(3000, (error) => {
  if (!error)
    console.log(
      "Server is Successfully Running,and App is listening on port " + 3000
    );
  else console.log("Error occurred, server can't start", error);
});

module.exports = app;
module.exports.handler = serverless(app);
