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
          "select id, [name], address, phone, description, city from Destination where category = @category"
        );
      res.send(fetchDestinations.recordset);
    } else {
      let fetchDestinations = await pool
        .request()
        .query(
          "select id, [name], address, phone, description, city from Destination"
        );
      res.send(fetchDestinations.recordset);
    }
  } catch (err) {
    console.log(err);
  }
});
router.get("/trip/:tripID", auth, async (req, res) => {
  try {
    console.log(req.params);
    let pool = await sql.connect();
    if (req.params.tripID) {
      let tripDestinations = await pool
        .request()
        .input("tripId", sql.Int, req.params.tripID)
        .query(
          "select id, [name], startTime, finishTime from Destination join Trip_Destination on Destination.id = Trip_Destination.destinationId where Trip_Destination.tripId = @tripId"
        );
      res.send(tripDestinations.recordset);
    } else throw new Error("Không có tripID");
  } catch (err) {
    console.log(err);
    res.status(400).send({ error: err });
  }
});

module.exports = router;
