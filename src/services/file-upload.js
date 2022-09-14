const express = require("express");
const router = express.Router();
const fs = require("node-fs");
const csv = require("csv-parser");
const request = require("request");
const path = require("path");
const AWS = require("aws-sdk");
const serverless = require("serverless-http");

// require("dotenv").config();

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
      // ${process.env.freshDeskToken}`,
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

function readCsvFile(results, data, s3, csvFilePath) {
  results.map(async (e) => {
    const targetable_id = e["Contract ID"];
    const fileLocation = e["File Location"];

    data.Contents.filter(async (e) => {
      if (e.Key === fileLocation) {
        // get extension name (ex: .pdf .png)
        const extension = path.extname(e.Key);

        //get file from s3
        let datetime = new Date().getTime();

        let __dirname = path.resolve();

        //ex : 1020310_1021012100.pdf (expand is : targetableId_datetime.pdf)
        const filePath = path.join(
          __dirname,
          `/${targetable_id}_${datetime}${extension}`
        );

        var stream = fs.createWriteStream(filePath);

        const fileStream = await s3
          .getObject({
            Bucket: "freshsales.fileupload",
            Key: e.Key.toString(),
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
      }
    });
  });
  if (csvFilePath) {
    fs.unlinkSync(csvFilePath);
  }
}

router.get("/upload", (req, res) => {
  const accessParams = {
    accessKeyId: "AKIATKMMBEY4V2L6DA3S",
    // `${process.env.accessKeyId}`,
    secretAccessKey: "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",
    //  `${process.env.secretAccessKey}`,
    region: "us-east-1",
  };

  AWS.config.update(accessParams);

  const s3 = new AWS.S3();

  const bucketParams = {
    Bucket: "freshsales.fileupload",
  };

  s3.listObjects(bucketParams, async function (err, data) {
    if (err) {
    } else {
      data.Contents.filter(async (e) => {
        if (e.Key === "TEST file import.csv") {
          const options = {
            Bucket: "freshsales.fileupload",
            Key: e.Key.toString(),
          };

          let __dirname = path.resolve();

          const csvFilePath = path.join(__dirname, `/TEST file import.csv`);

          const s3Stream = await s3.getObject(options).createReadStream();

          const stream = await fs.createWriteStream(csvFilePath);

          s3Stream.pipe(stream).on("finish", () => {
            const results = [];

            fs.createReadStream(csvFilePath.toString())
              .pipe(csv({}))
              .on("data", (data) => results.push(data))
              .on("end", () => {
                readCsvFile(results, data, s3, csvFilePath);
              });
          });

          return csvFilePath;
        }
      });
      res.send("Success");
    }
  });
});

router.get("/test", (req, res) => {
  let hello = "Hello from file upload.js";
  res.json({ hello: hello });

  return hello;
});

module.exports = router;

module.exports.handler = serverless(router);
