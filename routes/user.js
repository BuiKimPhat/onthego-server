const sql = require("mssql");
const router = require("express").Router();
const bcrypt = require("bcrypt");
const genToken = require("../middlewares/genToken");
const auth = require("../middlewares/auth");

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
    res.status(400).send({ error: err.message });
    console.log(err);
  }
});

router.post("/signup", async (req, res) => {
  try {
    let pool = await sql.connect();

    // check unique email
    let mailCheck = await pool
      .request()
      .input("email", sql.VarChar, req.body.email)
      .query("select id from [User] where email = @email");
    if (mailCheck.recordset.length == 0) {
      let hashedPwd = await bcrypt.hash(req.body.password, 10);
      let insert = await pool
        .request()
        .input("email", sql.VarChar, req.body.email)
        .input("password", sql.VarChar, hashedPwd)
        .input("name", sql.NVarChar, req.body.name)
        .input(
          "birthday",
          sql.DateTimeOffset,
          req.body.birthday != null ? new Date(req.body.birthday) : null
        )
        .input("address", sql.NVarChar(50), req.body.address)
        .query(
          "insert into [User] (email,[password],[name], createdAt, isAdmin, birthday, address) values (@email, @password, @name, CURRENT_TIMESTAMP, 0, @birthday, @address)"
        );
      if (insert.rowsAffected[0] > 0) {
        let getUserID = await pool
          .request()
          .query("select id from [User] where id = IDENT_CURRENT('User')");
        let token = genToken(getUserID.recordset[0].id);
        let insertToken = await pool
          .request()
          .input("UID", sql.Int, getUserID.recordset[0].id)
          .input("token", sql.VarChar, token)
          .query(
            "insert into [User_Token] (userId,token,createdAt) values (@UID, @token, CURRENT_TIMESTAMP)"
          );
        if (insertToken.rowsAffected[0] > 0) res.status(201).send({ token });
        else throw new Error("Lỗi tạo mới token");
      } else throw new Error("Lỗi tạo mới người dùng");
    } else {
      res.status(403).send({ error: "Email đã tồn tại" });
    }
  } catch (err) {
    res.status(400).send({ error: err.message });
    console.log(err);
  }
});

router.get("/logout", auth, async (req, res) => {
  try {
    let pool = await sql.connect();
    let logOut = await pool
      .request()
      .input("token", sql.VarChar(200), req.token)
      .query("delete from [User_Token] where token = @token");
    if (logOut.rowsAffected[0] > 0)
      res.send({ message: "Đăng xuất thành công!" });
    else throw new Error("Lỗi token");
  } catch (error) {
    res.status(400).send({ error: error.message });
    console.log(error);
  }
});

router.post("/edit", auth, async (req, res) => {
  try {
    let pool = await sql.connect();

    // check unique email
    let mailCheck = await pool
      .request()
      .input("email", sql.VarChar, req.body.email)
      .query("select id from [User] where email = @email");
    if (mailCheck.rowsAffected[0] > 0 && mailCheck.recordset[0].id != req.uid) {
      res.status(403).send({
        error: "Email đã có người sử dụng, vui lòng dùng email khác!",
      });
    } else {
      let editUser = await pool
        .request()
        .input("name", sql.NVarChar(100), req.body.name)
        .input("email", sql.VarChar(100), req.body.email)
        .input(
          "birthday",
          sql.DateTimeOffset,
          req.body.birthday != null ? new Date(req.body.birthday) : null
        )
        .input("address", sql.NVarChar(50), req.body.address)
        .input("UID", sql.Int, req.uid)
        .query(
          "update [User] set [name] = @name, email = @email, birthday = @birthday, [address] = @address where id = @UID"
        );
      if (editUser.rowsAffected[0] > 0)
        res.send({ message: "Cập nhật thành công!" });
      else throw new Error("Không tìm thấy người dùng");
    }
  } catch (error) {
    res.status(400).send({ error: error.message });
    console.log(error);
  }
});
router.post("/edit/pwd", auth, async (req, res) => {
  try {
    let pool = await sql.connect();
    let encryptedPwd = await pool
      .request()
      .input("UID", sql.Int, req.uid)
      .query("select [password] from [User] where id = @UID");
    if (encryptedPwd.rowsAffected[0] > 0) {
      let isPwdMatch = await bcrypt.compare(
        req.body.oldPwd,
        encryptedPwd.recordset[0].password
      );
      if (isPwdMatch) {
        let hashedPwd = await bcrypt.hash(req.body.newPwd, 10);
        let changePwd = await pool
          .request()
          .input("newPwd", sql.VarChar(100), hashedPwd)
          .input("UID", sql.Int, req.uid)
          .query("update [User] set [password] = @newPwd where id = @UID");
        if (changePwd.rowsAffected[0] > 0)
          res.send({ message: "Đổi mật khẩu thành công" });
        else throw new Error("Không thể đổi mật khẩu");
      } else res.status(401).send({ error: "Sai mật khẩu cũ" });
    } else throw new Error("Không tìm thấy người dùng");
  } catch (error) {
    res.status(400).send({ error: error.message });
    console.log(error);
  }
});

module.exports = router;

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
router.get("/getUserInfor/:id",auth,async(req,res)=>{
  try{
    let pool = await sql.connect();
    let user = await pool
      .request()
      .input("id",sql.Int,req.params.id)
      .query(
        "select name , email , isAdmin , birthday , address from [User] where id = @id" 
      );
    res.send(user.recordset);
  }catch(err){
    res.status(400).send({ error: err });
    console.log(err);
  }
});


// An , xóa user 
router.post("/deleteUser/:id",auth,async(req,res)=>{
  try{
    let pool = await sql.connect();
    let result = await pool
    .request()
    .input("id",sql.Int,req.params.id)
    .query(
      "delete from UserTrip where userId= @id"
    );
    if(result.rowsAffected[0]<=0) throw new Error("Không thể xóa người dùng!");
    else {
          await pool
          .request()
          .query("delete from User_Token where userId = @id");
          let deleteUser = await pool
            .request()
            .input("id",sql.Int,req.params.id)
            .query("delete from [User] where id =@id");
          if(deleteUser.rowsAffected[0]>0) res.send({message : "Xóa người dùng thành công"});
          else throw new Error ("Không thể xóa người dùng!");
    }
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
});
module.exports = router;

