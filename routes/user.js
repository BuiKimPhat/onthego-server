const sql = require("mssql");
const router = require("express").Router();
const bcrypt = require("bcrypt");
const genToken = require("../middlewares/genToken");
const auth = require("../middlewares/auth");
const { request } = require("express");

router.post("/login", async (req, res) => {
  try {
    let pool = await sql.connect();
    let checkCreds = await pool
      .request()
      .input("email", sql.VarChar(100), req.body.email)
      .query("select id, [password] from [User] where email = @email");
    if (checkCreds.recordset.length == 0) {
      res.status(401).send({ error: "Tài khoản hoặc mật khẩu không đúng!" });
    } else {
      let isPwdMatch = await bcrypt.compare(
        req.body.password,
        checkCreds.recordset[0].password
      );
      if (isPwdMatch) {
        let token = genToken(checkCreds.recordset[0].id);
        let insertToken = await pool
          .request()
          .input("UID", sql.Int, checkCreds.recordset[0].id)
          .input("token", sql.VarChar(200), token)
          .query(
            "insert into [User_Token](userId, token, createdAt) values (@UID, @token, CURRENT_TIMESTAMP)"
          );
        if (insertToken.rowsAffected[0] > 0) {
          let userInfo = await pool
            .request()
            .input("UID", sql.Int, checkCreds.recordset[0].id)
            .query(
              "select [name], isAdmin, birthday, [address] from [User] where id = @UID"
            );
          res.send({ ...userInfo.recordset[0], token });
        } else throw new Error("Không thể tạo mới người dùng");
      } else
          res.status(401).send({ error: "Tài khoản hoặc mật khẩu không đúng!" });
    }
  } catch (err) {
    res.status(400).send({ error: err });
    console.log(err);
  }
});

router.post("/signup", async (req, res) => {
  try {
    console.log(req);
    let pool = await sql.connect();

    // check unique email
    let mailCheck = await pool
      .request()
      .input("email", sql.VarChar, req.body.email)
      .query("select * from [User] where email = @email");
    // console.log(mailCheck);

    if (mailCheck.recordset.length == 0) {
      let hashedPwd = await bcrypt.hash(req.body.password, 10);
      let insert = await pool
        .request()
        .input("email", sql.VarChar, req.body.email)
        .input("password", sql.VarChar, hashedPwd)
        .input("name", sql.NVarChar, req.body.name)
        .input(
          "birthday",
          sql.Date,
          req.body.birthday != null ? new Date(req.body.birthday) : null
        )
        .input("address", sql.NVarChar(50), req.body.address)
        .query(
          "insert into [User] (email,[password],[name], createdAt, isAdmin, birthday, address) values (@email, @password, @name, CURRENT_TIMESTAMP, 0, @birthday, @address)"
        );
      //   console.log(insert);
      if (insert.rowsAffected[0] > 0) {
        let getUserID = await pool
          .request()
          .query("select id from [User] where id = IDENT_CURRENT('User')");
        // console.log(getUserID);
        let token = genToken(getUserID.recordset[0].id);
        let insertToken = await pool
          .request()
          .input("UID", sql.Int, getUserID.recordset[0].id)
          .input("token", sql.VarChar, token)
          .query(
            "insert into [User_Token] (userId,token,createdAt) values (@UID, @token, CURRENT_TIMESTAMP)"
          );
        if (insertToken.rowsAffected[0] > 0) res.status(201).send({ token });
      }
    } else {
      res.status(403).send({ error: "Email đã tồn tại" });
    }
  } catch (err) {
    // ... error checks
    res.status(400).send({ error: err });
    console.log(err);
  }
});

router.get("/trip", auth, async (req, res) => {
  try {
    let pool = await sql.connect();
    let userTrips = await pool
      .request()
      .input("UID", sql.Int, req.uid)
      .query(
        "select Trip.id, Trip.[name], [User].[name] as [owner], Trip.createdAt from Trip join (select tripId from User_Trip where userId = @UID) as cUser on Trip.id = cUser.tripId join [User] on Trip.ownerId = [User].id"
      );
    res.send(userTrips.recordset);
  } catch (err) {
    res.status(400).send({ error: err });
    console.log(err);
  }
});

// An , lấy số lượng user
router.get("/admin_User",auth,async(req,res)=>{
  try{
    let pool = await sql.connect();
    let listUser = await pool
      .request()
      .input("UID",sql.Int,req.uid)
      .query(
        "select id ,name, email from [User]"
      );
    res.send(listUser.recordset);
  }catch(err){
    res.status(400).send({ error: err });
    console.log(err);
  }
});
//An , lấy thông tin user trừ password 
router.get("/getUserInfor",auth,async(req,res)=>{
  try{
    let pool = await sql.connect();
    let user = await pool
      .request()
      .input("id",sql.Int,req.id)
      .query(
        "select  name , email , isAdmin , birthday , address , token from [User] where id = @id" 
      );
    res.send(user.recordset);
  }catch(err){
    res.status(400).send({ error: err });
    console.log(err);
  }
});
// An , xóa user 
router.get("/deleteUser/:id",auth,async(req,res)=>{
  try{
    let pool = await sql.connect();
    let result = await pool
    .request()
    .input("id",sql.Int,req.id)
    .query(
      "delete from [User_Trip] where userid = @id delete form [User] where id = @id"
    );
    if(result.rowsAffected[0]<=0) throw new Error("Không thể xóa chuyến đi khỏi danh sách");
    else res.send({message : "Delete Success"});
  }catch(err){
    res.status(400).send({ error: err });
    console.log(err);
  }
});
router.get("/getUserCount",auth,async(req,res)=>{
  try{
    let pool = await sql.connect();
    let count = await pool
    .request()
    .query(
      "select COUNT (*) as numOfUsers from [User];"
    );
    res.send(count.recordset);
  }catch(err){
    res.status(400).send({ error: err });
    console.log(err);
  }
})

module.exports = router;

