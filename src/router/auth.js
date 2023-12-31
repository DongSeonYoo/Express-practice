const express = require("express");
const router = express.Router();

const authGuard = require("../middleware/authGuard");
const adminAuth = require('../middleware/adminAuth');
const passport = require("passport");
const exception = require("../module/exception");
const emailHandler = require("../module/mailHandler");
const redisClient = require("../config/database/redis");

const jwtUtil = require("../module/jwt");
require("dotenv").config();

// 카카오 로그인 페이지로 이동시켜주는 api
router.get("/kakao", passport.authenticate("kakao"));

// 카카오 인증 전략 실행
router.get('/kakao/callback', passport.authenticate("kakao", {
    session: false,
    failureRedirect: '/',
}), async (req, res, next) => {
    const userData = req.user.rows[0];
    const accessToken = await jwtUtil.userSign(userData);
    res.cookie("accessToken", accessToken, {
        httpOnly: false,
        secure: false
    });
    res.redirect("/");
});

// 인증번호 전송 api
router.post("/send-auth-email", (req, res, next) => {
    const { email } = req.body;
    const result = {
        message: ""
    }
    try {
        exception(email, "email").checkInput().checkEmailRegex();
        emailHandler.sendVerifyEmail(email);
    } catch (error) {
        next(error);
    }
    result.message = "이메일 전송 완료";

    res.send(result);
});

// 인증번호 체크
router.post("/check-auth-email", async (req, res, next) => {
    const { email, code } = req.body;
    const result = {
        isSuccess: false,
        message: "",
    }

    try {
        exception(email, "email").checkInput().checkEmailRegex();
        exception(code, "code").checkInput().isNumber();

        const data = await redisClient.get(email);
        if (!data) {
            result.message = "인증번호가 만료되었습니다. 다시 발급받아주세요";
        } else {
            if (data === code) {
                // 인증번호가 유효한 경우
                result.isSuccess = true;
                result.message = "인증이 완료되었습니다";
                await redisClient.del(email);
            } else {
                // 인증번호가 유효하지 않은 경우
                result.message = "인증이 실패되었습니다";
            }
        }
        res.send(result);

    } catch (error) {
        next(error);
    }
});

// 로그인 권한 체크 api
router.get("/login", authGuard, (req, res) => {
    req.decoded.iat = new Date(req.decoded.iat * 1000);
    res.status(200).send({
        data: req.decoded,
    });
});

// 관리자 권한 체크 api
router.get("/admin", adminAuth, (req, res) => {
    req.decoded.iat = new Date(req.decoded.iat * 1000);
    res.status(200).send({
        data: req.decoded,
    });
});

module.exports = router;
