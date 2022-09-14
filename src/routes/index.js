const express = require("express");
const router = express.Router();
const fileRoute = require("../services/file-upload");
const serverless = require("serverless-http");

router.use("/file", fileRoute);

module.exports = router;

module.exports.handler = serverless(router);
