const express = require("express");
const router = express.Router();
const pool = require("../config/database/postgresql");
const redisClient = require("../config/database/redis");

router.get("/hour", async (req, res, next) => {
    const result = {
        isSuccess: false,
        data: null,
    };

    try {
        const count = await redisClient.sCard("dailyLoginUser");
        result.data = count;
        result.isSuccess = true;
        res.send(result);

    } catch (error) {
        next(error);
    }
});

router.get("/total", async (req, res, next) => {
    const result = {
        isSuccess: false,
        data: null,
    };

    try {
        const sql = "SELECT count(*) FROM logged_in_user";
        const data = await pool.query(sql);
        result.isSuccess = true;
        result.data = data.rows[0].count;
        res.send(result);
    } catch (error) {
        next(error);
    }
});

module.exports = router;