const express = require("express");
// const serverless = require("serverless-http");
const app = express();
const router = express.Router();
const Routers = require("./routes/index");

// router.get("/", (req, res) => {
//   res.json({
//     hello: "hi!"
//   });
// });

app.use(`/.netlify/functions/api`, Routers);

// module.exports = app;
// module.exports.handler = serverless(app);
