const express = require("express");
const app = express();
const sql = require("mssql");
require("dotenv").config();
const port = 6996;
app.use(express.json());

// db credentials
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PWD,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  options: {
      enableArithAbort: true
  }
};

sql.connect({
  ...dbConfig,
  beforeConnect: (conn) => {
    conn.once("connect", (err) => {
      err ? console.error(err) : console.log("mssql connected");
    });
    conn.once("end", (err) => {
      err ? console.error(err) : console.log("mssql disconnected");
    });
  }
});

//router
const userRouter = require("./routes/user");
app.use("/api/user", userRouter);
const desitnationRouter = require("./routes/destination");
app.use("/api/destination", desitnationRouter);

// listen
app.listen(port, () => console.log(`Server is listening on port ${port}`));
