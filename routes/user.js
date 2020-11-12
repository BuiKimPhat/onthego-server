const sql = require("mssql");
const router = require("express").Router();
const genToken = require("../middlewares/genToken");
// new user
router.post("/new", async (req, res) => {
  try {
    let pool = await sql.connect();
    // Request using query params => vulnerable

    // check unique email
    let mailCheck = await pool
      .request()
      .input("email", sql.VarChar, req.query.email)
      .query("select id from [User] where email = @email");
    // console.log(mailCheck);

    if (mailCheck.recordset.length == 0) {
      let insert = await pool
        .request()
        .input("email", sql.VarChar, req.query.email)
        .input("password", sql.VarChar, req.query.password)
        .input("name", sql.NVarChar, req.query.name)
        .query(
          "insert into [User] (email,[password],[name], createdAt, isAdmin) values (@email, @password, @name, CURRENT_TIMESTAMP, 0)"
        );
      //   console.log(insert);
      if (insert.rowsAffected[0]) {
        let getUserID = await pool
          .request()
          .query(
            "select id, [name] from [User] where id = IDENT_CURRENT('User')"
          );
        // console.log(getUserID);
        let insertToken = await pool
          .request()
          .input("UID", sql.VarChar, getUserID.recordset[0].id)
          .input("token", sql.VarChar, genToken(getUserID.recordset[0].id))
          .query(
            "insert into [User_Token] (userId,token,createdAt) values (@UID, @token, CURRENT_TIMESTAMP)"
          );
        if (insertToken.rowsAffected[0]) res.send("Đăng kí thành công");
      }
    } else {
      res.send("Email đã tồn tại!");
      throw new Error("Email đã tồn tại!");
    }
  } catch (err) {
    // ... error checks
    console.log(err.message);
  }
});

module.exports = router;
