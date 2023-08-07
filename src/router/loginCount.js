const express = require("express");
const router = express.Router();

const redisClient = require("redis").createClient();
const createClient = require("../../config/database/postgresql");


router.get("/hour", async (req, res, next) => {
    const result = {
        isSuccess: false,
        data: null,
    };

    try {
        await redisClient.connect();
        const count = await redisClient.sCard("dailyLoginUser");
        result.data = count;
        result.isSuccess = true;
        res.send(result);
        
    } catch (error) {
        console.error(error);
        next(error);
    } finally {
        await redisClient.disconnect();
    }
});

router.get("/total", async (rea, res, next) => {
    const result = {
        isSuccess: false,
        data: null,
    };
    let pgClient = null;

    try {
        pgClient = createClient();
        await pgClient.connect();

        const sql = "SELECT count(*) FROM logged_in_user";
        const data = await pgClient.query(sql);
        result.isSuccess = true;
        result.data = data.rows[0].count;
        res.send(result);
    } catch (error) {
        console.error(error);
        next(error);
    } finally {
        await pgClient.end();
    }
})

module.exports = router;