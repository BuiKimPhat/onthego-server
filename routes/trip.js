const sql = require("mssql");
const router = require("express").Router();
const auth = require("../middlewares/auth");

router.get("/", auth, async (req, res) => {
  try {
    let pool = await sql.connect();
    let userTrips = await pool
      .request()
      .input("UID", sql.Int, req.uid)
      .query(
        "select Trip.id, Trip.[name], [User].[name] as [owner], cUser.createdAt from Trip join (select tripId, createdAt from User_Trip where userId = @UID) as cUser on Trip.id = cUser.tripId left join [User] on Trip.ownerId = [User].id order by cUser.createdAt desc"
      );
    res.send(userTrips.recordset);
  } catch (err) {
    res.status(400).send({ error: err.message });
    console.log(err);
  }
});

router.post("/add", auth, async (req, res) => {
  try {
    let pool = await sql.connect();
    if (req.body.tripId) {
      //add existing trip to User_Trip
      let checkTripExist = await pool
        .request()
        .input("tripID", sql.Int, req.body.tripId)
        .query("select id from Trip where id = @tripID");
      if (checkTripExist.rowsAffected[0] <= 0)
        throw new Error("Không tồn tại chuyến đi này!");
      let checkTripList = await pool
        .request()
        .input("UID", sql.Int, req.uid)
        .input("tripID", sql.Int, req.body.tripId)
        .query(
          "select * from User_Trip where userId = @UID and tripId = @tripID"
        );
      if (checkTripList.rowsAffected[0] > 0)
        throw new Error("Chuyến đi đã tồn tại trong danh sách của bạn!");
      let addExistTrip = await pool
        .request()
        .input("UID", sql.Int, req.uid)
        .input("tripID", sql.Int, req.body.tripId)
        .query(
          "insert into User_Trip values (@UID, @tripID, CURRENT_TIMESTAMP)"
        );
      if (addExistTrip.rowsAffected[0] > 0)
        res.send({ message: "Đã thêm chuyến đi vào danh sách" });
      else throw new Error("Không thể thêm chuyến đi");
    } else {
      //create a brand new trip
      let newTrip = await pool
        .request()
        .input("UID", sql.Int, req.uid)
        .input("name", sql.NVarChar(100), req.body.name)
        .query(
          "insert into Trip (ownerId, [name]) values (@UID, @name)"
        );
      if (newTrip.rowsAffected[0] > 0) {
        // insert trip destinations
        if (req.body.destinations) {
          for (var i = 0; i < req.body.destinations.length; i++) {
            let newTripDestinations = await pool
              .request()
              .input("destinationID", sql.Int, req.body.destinations[i].id)
              .input(
                "startTime",
                sql.DateTimeOffset,
                req.body.destinations[i].startTime != null
                  ? new Date(req.body.destinations[i].startTime)
                  : null
              )
              .input(
                "finishTime",
                sql.DateTimeOffset,
                req.body.destinations[i].finishTime != null
                  ? new Date(req.body.destinations[i].finishTime)
                  : null
              )
              .query(
                "insert into Trip_Destination(tripId, destinationId, startTime, finishTime) values (IDENT_CURRENT('Trip'), @destinationID, @startTime, @finishTime)"
              );
            if (newTripDestinations.rowsAffected[0] <= 0)
              throw new Error(
                "Đã tạo chuyến đi nhưng không thể thêm điểm đến " +
                  req.body.destinations[i].id
              );
          }
        }
        let addUserTrip = await pool
          .request()
          .input("UID", sql.Int, req.uid)
          .query(
            "insert into User_Trip values (@UID, IDENT_CURRENT('Trip'), CURRENT_TIMESTAMP)"
          );
        if (addUserTrip.rowsAffected[0] <= 0)
          throw new Error(
            "Đã tạo chuyến đi nhưng không thể thêm vào danh sách của bạn"
          );
        let returnNewTripID = await pool
          .request()
          .input("UID", sql.Int, req.uid)
          .query(
            "select id from Trip where ownerId = @UID and id = IDENT_CURRENT('Trip')"
          );
        res.send({
          message:
            "Tạo chuyến đi mới thành công! ID: " +
            returnNewTripID.recordset[0].id,
        });
      } else throw new Error("Không thể thêm chuyến đi");
    }
  } catch (err) {
    res.status(400).send({ error: err.message });
    console.log(err);
  }
});

router.post("/edit", auth, async (req, res) => {
  try {
    let pool = await sql.connect();
    // check if user is owner
    let checkEditRight = await pool
      .request()
      .input("UID", sql.Int, req.uid)
      .input("tripID", sql.Int, req.body.id)
      .query("select id from Trip where id = @tripID and ownerId = @UID");
    if (checkEditRight.rowsAffected[0] <= 0)
      res
        .status(403)
        .send({ error: "Bạn không có quyền chỉnh sửa chuyến đi này" });
    else {
      // update name
      let updateName = await pool
        .request()
        .input("tripID", sql.Int, req.body.id)
        .input("name", sql.NVarChar(100), req.body.name)
        .query("update Trip set [name] = @name where id = @tripID");
      if (updateName.rowsAffected[0] > 0) {
        // delete all trip destinations
        await pool
          .request()
          .input("tripID", sql.Int, req.body.id)
          .query("delete from Trip_Destination where tripId = @tripID");
        if (req.body.destinations) {
          for (var i = 0; i < req.body.destinations.length; i++) {
            // insert new trip destinations
            let newTripDestinations = await pool
              .request()
              .input("tripID", sql.Int, req.body.id)
              .input("destinationID", sql.Int, req.body.destinations[i].id)
              .input(
                "startTime",
                sql.DateTimeOffset,
                req.body.destinations[i].startTime != null
                  ? new Date(req.body.destinations[i].startTime)
                  : null
              )
              .input(
                "finishTime",
                sql.DateTimeOffset,
                req.body.destinations[i].finishTime != null
                  ? new Date(req.body.destinations[i].finishTime)
                  : null
              )
              .query(
                "insert into Trip_Destination(tripId, destinationId, startTime, finishTime) values (@tripID, @destinationID, @startTime, @finishTime)"
              );
            if (newTripDestinations.rowsAffected[0] <= 0)
              throw new Error(
                "Không thể thêm điểm đến " + req.body.destinations[i].id
              );
          }
        }
        res.send({ message: "Chỉnh sửa chuyến đi thành công" });
      } else throw new Error("Không thể chỉnh sửa tên chuyến đi");
    }
  } catch (err) {
    res.status(400).send({ error: err.message });
    console.log(err);
  }
});

router.post("/delete", auth, async (req, res) => {
  try {
    let pool = await sql.connect();
    let fromList = await pool
      .request()
      .input("UID", sql.Int, req.uid)
      .input("tripID", sql.Int, req.body.tripId)
      .query("delete from User_Trip where userId = @UID and tripId = @tripID");
    if (fromList.rowsAffected[0] <= 0)
      throw new Error("Không thể xóa chuyến đi khỏi danh sách");
    else {
      let checkTripUsers = await pool
        .request()
        .input("tripID", sql.Int, req.body.tripId)
        .query("select * from User_Trip where tripId = @tripID");
      if (checkTripUsers.rowsAffected[0] > 0) {
        res.send({ message: "Đã xóa chuyến đi khỏi danh sách" });
      } else {
        let checkEditRight = await pool
          .request()
          .input("UID", sql.Int, req.uid)
          .input("tripID", sql.Int, req.body.tripId)
          .query("select id from Trip where id = @tripID and ownerId = @UID");
        if (checkEditRight.rowsAffected[0] > 0) {
          // if user is owner
          // delete trip destinations
          await pool
            .request()
            .input("tripID", sql.Int, req.body.tripId)
            .query("delete from Trip_Destination where tripId = @tripID");
          let deleteTrip = await pool
            .request()
            .input("UID", sql.Int, req.uid)
            .input("tripID", sql.Int, req.body.tripId)
            .query("delete from Trip where id = @tripID and ownerId = @UID");
          if (deleteTrip.rowsAffected[0] > 0)
            res.send({ message: "Xóa chuyến đi thành công!" });
          else {
            res.send({ message: "Đã xóa chuyến đi khỏi danh sách" });
          }
        } else {
          res.send({ message: "Đã xóa chuyến đi khỏi danh sách" });
        }
      }
    }
  } catch (err) {
    res.status(400).send({ error: err.message });
    console.log(err);
  }
});
//An
router.get("/getTripCount",auth,async(req,res)=>{
  try{
    let pool = await sql.connect();
    let count = await pool
    .request()
    .query(
      "select COUNT (*) as numOfTrips from Trip;"
    );
    res.send(count.recordset);
  }catch(err){
    res.status(400).send({ error: err });
    console.log(err);
  }
})

router.get("/getListTrip",auth,async(req,res)=>{
  try{
    let pool = await sql.connect();
    let list = await pool
    .request()
    .query(
      "select Trip.id,ownerId,Trip.name from [Trip] ;"
    );
    res.send(list.recordset);
  }catch(err){
    res.status(400).send({ error: err });
    console.log(err);
  }
})
module.exports = router;
