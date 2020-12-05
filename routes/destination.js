const axios = require("axios");
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
          "select id, [name], address, description, rating, rateNum, latitude, longitude from Destination where category = @category order by rateNum desc"
        );
      res.send(fetchDestinations.recordset);
    } else {
      let fetchDestinations = await pool
        .request()
        .query(
          "select id, [name], address, description, rating, rateNum, latitude, longitude from Destination order by rateNum desc"
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
          "select id, [name], address, description, rating, rateNum, latitude, longitude, startTime, finishTime from Destination join Trip_Destination on Destination.id = Trip_Destination.destinationId where Trip_Destination.tripId = @tripId"
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
router.get("/weather", auth, async (req, res) => {
  try {
    axios.get(`http://api.openweathermap.org/data/2.5/weather?lat=${req.query.lat}&lon=${req.query.lon}&appid=1c022451d102533da0d4e741102da575&units=metric&lang=vi`)
    .then(apiRes => {
      res.send({temp: apiRes.data.main.temp, description: apiRes.data.weather[0].description, icon: apiRes.data.weather[0].icon});
    })
    .catch(error => {
      throw error;
    });
  } catch (err){
    res.status(400).send({error: err.message});
    console.log(err);
  }
});
module.exports = router;
