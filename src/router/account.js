const express = require("express");
const router = express.Router();
const pool = require("../config/database/postgresql");
const exception = require("../module/exception");
const {
    maxUserIdLength,
    maxLoginIdLength,
    maxPwLength,
    maxNameLength,
    maxPhoneNumberLength,
    maxEmailLength
} = require("../module/global");

const authGuard = require("../middleware/authGuard");
const bcryptUtil = require("../module/hashing");
const jwtUtil = require("../module/jwt");
const emailHandler = require("../module/mailHandler");

const AWS = require("../config/aws");
const { BadRequestException } = require('../module/customError');
const env = require('../config/env');
const s3 = new AWS.S3();

require("dotenv").config();

// 로그인 api
router.post("/login", async (req, res, next) => {
    const { loginId, password } = req.body;
    const result = {
        message: "",
        accessToken: null,
    };

    try {
        // request값 유효성 검증
        exception(loginId, "loginId").checkInput().checkLength(1, maxLoginIdLength);
        exception(password, "password").checkInput().checkLength(1, maxPwLength);
        if (loginId === env.ADMIN_ID && password === env.ADMIN_PW) {
            const accessToken = jwtUtil.adminSign();
            res.cookie('accessToken', accessToken);
            return res.redirect('/admin');
        }

        const sql = "SELECT id, password, login_id, name FROM user_TB WHERE login_id = $1";
        const params = [loginId];
        const data = await pool.query(sql, params);
        if (data.rows.length !== 0) {
            const userData = data.rows[0];
            const passwordMatch = await bcryptUtil.compare(password, userData.password);
            if (passwordMatch) {
                const accessToken = await jwtUtil.userSign(userData);
                result.accessToken = accessToken;
            }
        } else {
            result.message = "아이디 또는 비밀번호가 올바르지 않습니다";
        }
        res.send(result);

    } catch (error) {
        next(error);
    }
});

// 로그아웃 api
router.post("/logout", authGuard, async (req, res, next) => {
    const result = {
        message: "",
    };

    try {
        result.message = "로그아웃 성공";
        res.clearCookie("accessToken");
        res.send(result);

    } catch (error) {
        result.message = error.message;
        next(error);
    }
});

// 아이디 중복체크 api
// GET
// pathVariable: loginId
router.get("/id/duplicate/:loginId", async (req, res, next) => {
    const { loginId } = req.params;
    const result = {
        isSuccess: false,
        message: "",
    };

    try {
        exception(loginId, "loginId").checkInput().checkIdRegex();

        const sql = "SELECT id FROM user_TB WHERE login_id = $1";
        const params = [loginId];
        const data = await pool.query(sql, params);

        if (data.rows.length !== 0) {
            result.isSuccess = true;
        } else {
            result.isSuccess = false;
        }
        res.send(result);

    } catch (error) {
        next(error);
    }
});

// 전화번호 중복체크 api
// GET
// pathVariable: phoneNumber
router.get("/phoneNumber/duplicate/:phoneNumber", async (req, res, next) => {
    const { phoneNumber } = req.params;
    const result = {
        isSuccess: false,
        message: "",
    };

    try {
        exception(phoneNumber, "phoneNumber").checkInput().checkPhoneNumberRegex();

        const sql = "SELECT phone_number FROM user_TB WHERE phone_number = $1";
        const params = [phoneNumber];
        const data = await pool.query(sql, params);
        if (data.rows.length !== 0) {
            result.isSuccess = true;
        } else {
            result.isSuccess = false;
        }
        res.send(result);

    } catch (error) {
        next(error);
    }
})

// 이메일 중복체크 api
// GET
// pathVariable: email
router.get("/email/duplicate/:email", async (req, res, next) => {
    const { email } = req.params;
    const result = {
        isSuccess: false,
        message: "",
    };

    try {
        exception(email, "email").checkInput().checkEmailRegex();
        const sql = "SELECT email FROM user_TB WHERE email = $1";
        const params = [email];
        const data = await pool.query(sql, params);
        // 기존의 이메일이 존재한다면?
        if (data.rows.length === 0) {
            result.isSuccess = true;
            result.message = "사용 가능한 이메일입니다";
            return res.send(result);
        }

        throw new BadRequestException("중복된 이메일이 존재합니다");

    } catch (error) {
        next(error);
    }
})

// 회원가입 api
// loginId, password, name, phoneNumber, email
// POST
router.post("/signup", async (req, res, next) => {
    const { loginId, password, name, phoneNumber, email } = req.body;
    const result = {
        data: "",
        message: "",
    };

    try {
        exception(loginId, "loginId").checkInput().checkIdRegex();
        exception(password, "password").checkInput().checkPwRegex();
        exception(name, "name").checkInput().checkNameRegex();
        exception(phoneNumber, "phoneNumber").checkInput().checkPhoneNumberRegex();
        exception(email, "email").checkInput().checkEmailRegex();

        const hashedPassword = await bcryptUtil.hashing(password);

        const sql = `INSERT INTO user_TB (login_id, password, name, phone_number, email) VALUES ($1, $2, $3, $4, $5) RETURNING email`;
        const params = [loginId, hashedPassword, name, phoneNumber, email];

        const data = await pool.query(sql, params);
        if (data.rowCount !== 0) {
            result.message = "회원가입 성공";

            const signupUserEmail = data.rows[0].email;
            emailHandler.sendWelcomeEmail(signupUserEmail);
        }
        res.send(result);

    } catch (error) {
        next(error);
    }
});

// 아이디 찾기 api
// name, phoneNumber, email
// GET
router.get("/loginId", async (req, res, next) => {
    const { name, phoneNumber, email } = req.query;
    const result = {
        data: "",
        message: ""
    }

    try {
        exception(name, "name").checkInput().checkLength(1, maxNameLength);
        exception(phoneNumber, "phoneNumber").checkInput().checkLength(maxPhoneNumberLength, maxPhoneNumberLength);
        exception(email, "email").checkInput().checkLength(1, maxEmailLength);

        const sql = "SELECT login_id FROM user_TB WHERE name = $1 AND phone_number = $2 AND email = $3";
        const params = [name, phoneNumber, email];
        const data = await pool.query(sql, params);
        if (data.rows.length !== 0) {
            result.data = data.rows[0].login_id;
        } else {
            result.data = null;
            result.message = "해당하는 아이디가 존재하지 않습니다";
        }
        res.send(result);

    } catch (error) {
        next(error);
    }
})

// 비밀번호 찾기 api
// 1.(사용자 인증 단계)
// GET
// loginId, name, phoneNumber, email
router.post("/pw", async (req, res, next) => {
    const { loginId, name, phoneNumber, email } = req.body;
    const result = {
        data: "",
        message: "",
    };

    try {
        exception(loginId, "loginId").checkInput().checkIdRegex();
        exception(name, "name").checkInput().checkNameRegex();
        exception(phoneNumber, "phoneNumber").checkInput().checkPhoneNumberRegex();
        exception(email, "email").checkInput().checkEmailRegex();

        const sql = `SELECT id FROM user_TB WHERE login_id = $1 AND name = $2 AND phone_number = $3 AND email = $4`;
        const params = [loginId, name, phoneNumber, email];
        const data = await pool.query(sql, params);
        if (data.rows.length !== 0) {
            result.isSuccess = true;
            result.data = data.rows[0].id;
        } else {
            result.data = null;
            result.message = "해당하는 사용자가 없습니다";
        }
        res.send(result);

    } catch (error) {
        next(error);
    }
});

// 비밀번호 찾기 api
// 2.(비밀번호 재설정 단계)
// PUT
// userId, newPw
router.put("/pw", async (req, res, next) => {
    const { userId, newPw } = req.body;
    const result = {
        isSuccess: false,
        data: "",
        message: "",
    };

    try {
        exception(userId, "userId").checkInput().isNumber().checkLength(1, maxUserIdLength);
        exception(newPw, "newPw").checkInput().checkPwRegex();

        const sql = "UPDATE user_TB SET password = $1 WHERE id = $2";
        const param = [newPw, userId];
        const data = await pool.query(sql, param);
        if (data.rowCount !== 0) {
            result.isSuccess = true;
            result.message = "비밀번호 수정 성공";
        } else {
            result.message = "해당하는 사용자가 없습니다";
        }
        res.send(result);

    } catch (error) {
        next(error);
    }
});

// 프로필 보기 api
// userId
// GET
router.get("/:userId", async (req, res, next) => {
    const { userId } = req.params;
    const result = {
        data: "",
        message: "",
    };

    try {
        exception(userId, "userId").checkInput().isNumber().checkLength(1, maxUserIdLength);

        const sql = `SELECT login_id, name, phone_number, email, created_date, updated_date, profile_img 
                    FROM user_TB WHERE id = $1`;
        const params = [userId];
        const data = await pool.query(sql, params);

        if (data.rows.length !== 0) {
            result.data = data.rows[0];
        } else {
            result.data = null;
            result.message = "해당하는 사용자가 존재하지 않습니다";
            res.clearCookie("accessToken");
        }
        res.send(result);

    } catch (error) {
        next(error);
    }
});

// 회원 정보 수정 api
// userId, name, phoneNumber, email
// PUT
router.put("/", authGuard, async (req, res, next) => {
    const { userPk } = req.decoded;
    const { name, phoneNumber, email, profileImageUrl } = req.body;
    const result = {
        isSuccess: false,
        message: "",
    };

    try {
        exception(name, "name").checkInput().checkNameRegex();
        exception(phoneNumber, "phoneNumber").checkInput().checkPhoneNumberRegex();
        exception(email, "email").checkInput().checkEmailRegex();

        let sql = "UPDATE user_TB SET name = $1, phone_number = $2, email = $3, profile_img = $4 WHERE id = $5";
        const params = [name, phoneNumber, email, profileImageUrl, userPk];

        const data = await pool.query(sql, params);
        if (data.rowCount !== 0) {
            result.isSuccess = true;
            result.message = "프로필 수정 성공";
        } else {
            result.message = "해당하는 사용자가 존재하지 않습니다";
        }
        res.send(result);

    } catch (error) {
        next(error);
    }
});

// 회원 탈퇴 api
// userId
// DELETE
router.delete("/", authGuard, async (req, res, next) => {
    const { userPk } = req.decoded;
    const result = {
        isSuccess: false
    }
    let pgClient = null;

    try {
        pgClient = await pool.connect();

        // 트랜잭션 실행
        pgClient.query("BEGIN");
        const deleteUserSql = "DELETE FROM user_TB WHERE id = $1";
        const params = [userPk];
        const data = await pgClient.query(deleteUserSql, params);

        if (data.rowCount !== 0) {
            const objects = await s3.listObjects({
                Bucket: env.AWS_BUCKET_NAME,
                Prefix: req.decoded.loginId,
            }).promise();

            if (objects.Contents.length > 0) {
                const deleteParams = {
                    Bucket: env.AWS_BUCKET_NAME,
                    Delete: {
                        Objects: objects.Contents.map(obj => ({ Key: obj.Key }))
                    }
                };
                await s3.deleteObjects(deleteParams, (err, data) => {
                    if (err) {
                        throw err;
                    }
                }).promise();
            }
            result.isSuccess = true;
        } else {
            result.message = "해당하는 회원이 존재하지 않습니다";
        }
        pgClient.query("COMMIT");
        res.clearCookie("accessToken");
        res.send(result);

    } catch (error) {
        if (pgClient) {
            await pgClient.query("ROLLBACK");
        }
        next(error);

    } finally {
        if (pgClient) {
            pgClient.release();
        }
    }
});

module.exports = router;
