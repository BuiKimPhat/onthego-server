const jwt = require("jsonwebtoken");
const sql = require("mssql");
const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", ""); // get token from authorization header
    if (!token) throw new Error();
    const data = jwt.verify(token, process.env.JWT_KEY);
    let pool = await sql.connect();
    let tokenCheck = await pool
    .request()
    .input("userId", sql.Int, data.uid)
    .input("token", sql.VarChar, token)
    .query("select * from User_Token where userId = @userId and token = @token");
    if (tokenCheck.recordset.length == 0) {
      throw new Error("Token không hợp lệ");
    }
    req.uid = data.uid;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).send({ error: "Token đã hết hạn, vui lòng đăng nhập lại!" });
  }
};
module.exports = auth;
