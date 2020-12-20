const sql = require("mssql");
const router = require("express").Router();
const auth = require("../middlewares/auth");

router.get("/", auth, async (req, res) => {
  try {
    let pool = await sql.connect();
    if (req.query.category) {
      let fetchDestinations = await pool
        .request()
        .input("category", sql.VarChar, req.query.category)
        .query(
          "select id, [name], address, phone, description, rating, city, position from Destination where category = @category order by rating desc"
        );
      res.send(fetchDestinations.recordset);
    } else {
      let fetchDestinations = await pool
        .request()
        .query(
          "select id, [name], address, phone, description, rating, city, position from Destination order by rating desc"
        );
      res.send(fetchDestinations.recordset);
    }
  } catch (err) {
    res.status(400).send({ error: err.message });
    console.log(err);
  }
});
router.get("/trip/:tripID", auth, async (req, res) => {
  try {
    let pool = await sql.connect();
    if (req.params.tripID) {
      let tripDestinations = await pool
        .request()
        .input("tripId", sql.Int, req.params.tripID)
        .query(
          "select id, [name], startTime, finishTime from Destination join Trip_Destination on Destination.id = Trip_Destination.destinationId where Trip_Destination.tripId = @tripId"
        );
      res.send(tripDestinations.recordset);
    } else throw new Error("Không tìm thấy chuyến đi");
  } catch (err) {
    console.log(err);
    res.status(400).send({ error: err.message });
  }
});
router.post("/trip/add", auth, async (req, res) => {
  try {
    let pool = await sql.connect();
    let checkEditRight = await pool
      .request()
      .input("UID", sql.Int, req.uid)
      .input("tripID", sql.Int, req.body.tripId)
      .query("select id from Trip where id = @tripID and ownerId = @UID");
    if (checkEditRight.rowsAffected[0] <= 0)
      res
        .status(403)
        .send({ error: "Bạn không có quyền chỉnh sửa chuyến đi này" });
    else {
      let checkDuplicate = await pool
        .request()
        .input("tripID", sql.Int, req.body.tripId)
        .input("destinationID", sql.Int, req.body.destinationId)
        .query(
          "select * from Trip_Destination where tripId = @tripID and destinationId = @destinationID"
        );
      if (checkDuplicate.rowsAffected[0] > 0)
        throw new Error("Điểm đến đã tồn tại trong chuyến đi");
      else {
        let addTripDestination = await pool
          .request()
          .input("tripID", sql.Int, req.body.tripId)
          .input("destinationID", sql.Int, req.body.destinationId)
          .query(
            "insert into Trip_Destination (tripId, destinationId) values (@tripID, @destinationID)"
          );
        if (addTripDestination.rowsAffected[0] > 0)
          res.send({ message: "Đã thêm điểm đến vào chuyến đi" });
        else throw new Error("Không thể thêm điểm đến vào chuyến đi");
      }
    }
  } catch (err) {
    res.status(400).send({ error: err.message });
    console.log(err);
  }
});
//An
router.get("/getDestinationCount",auth,async(req,res)=>{
  try{
    let pool = await sql.connect();
    let count = await pool
    .request()
    .query(
      "select COUNT (*) as numOfDestinations from [Destination];"
    );
    res.send(count.recordset);
  }catch(err){
    res.status(400).send({ error: err });
    console.log(err);
  }
})

router.get("/list", auth, async (req, res) => {
  try {
    let pool = await sql.connect();
    let fetchDestinations = await pool
        .request()
        .query(
          "select id, [name], address, description, category, rating,rateNum from Destination order by id asc"
        );
      res.send(fetchDestinations.recordset);    
  } catch (err) {
    res.status(400).send({ error: err.message });
    console.log(err);
  }
});

router.get("/getDes/:id",auth,async(req,res)=>{
  try{
    let pool = await sql.connect();
    let user = await pool
      .request()
      .input("id",sql.Int,req.params.id)
      .query(
        "select id, [name], address, description, category, rating, rateNum, latitude , longitude from Destination where id = @id" 
      );
    res.send(user.recordset);
  }catch(err){
    res.status(400).send({ error: err });
    console.log(err);
  }
});

router.post("/edit", auth, async (req, res)=>{
  try{
    let pool = await sql.connect();
    let updateDes = await pool
    .request()
    .input("desID", sql.Int, req.body.id)
    .input("name", sql.NVarChar(200), req.body.name)
    .input("address", sql.NVarChar(200), req.body.address)
    .input("cat", sql.NVarChar(200), req.body.cat)
    .input("description", sql.NVarChar(500), req.body.description)
    .input("latitude", sql.Float, req.body.latitude)
    .input("longitude", sql.Float, req.body.longitude)
    .query("update Trip set [name] = @name, [address]= @address , [description]= @description, category=@cat, latitude= @latitude , longitude=@longitude  where id = @desID");
    if(updateDes.rowsAffected[0]>0) res.send({ message: "Update diểm đến thành công thành công"});
    else res.send({ message: "Update diểm đến không thành công thành công"});
  }catch(err){
    res.status(400).send({ error: err.message });
    console.log(err);
  }
})

router.post("/add",auth,async(req,res)=>{
   try{
    let pool = await sql.connect();
    let add = await pool
    .request()
    .input("desID", sql.Int, req.body.id)
    .input("name", sql.NVarChar(200), req.body.name)
    .input("address", sql.NVarChar(200), req.body.address)
    .input("cat", sql.NVarChar(200), req.body.cat)
    .input("description", sql.NVarChar(500), req.body.description)
    .input("latitude", sql.Float, req.body.latitude)
    .input("longitude", sql.Float, req.body.longitude)
    .query("insert into Trip ( [name] , [address] , [description], category, latitude , longitude) value (@name,@address,@description,@cat,@latitude,@longitude)");
    if(add.rowsAffected[0]>0) res.send({ message: "Thêm diểm đến thành công thành công"});
    else res.send({ message: "Thêm diểm đến không thành công thành công"});
   }catch(err){
    res.status(400).send({ error: err.message });
    console.log(err);
  } 
})
module.exports = router;
