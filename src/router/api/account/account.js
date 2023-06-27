const express = require("express");
const router = express.Router();

const account = require("../account/account.controller");

// 로그인 api
// loginId, pw
// POST
router.post("/login", account.login);

// 회원가입 api
// loginId, pw, name, phoneNumber, email
// POST
router.post("/signup",account.signup);

// 아이디 찾기 api
// name, phoneNumber, email
// GET
router.get("/loginId", account.findId);

// 비밀번호 찾기 api
// 1.(사용자 인증 단계)
// loginId, name, phoneNumber, email
router.get("/pw", account.validateUser);

// 비밀번호 찾기 api
// 2.(비밀번호 재설정 단계)
// userId, newPw
router.post("/pw", account.resetPw);

// 프로필 보기 api
// userId
// GET
router.get("/:userId", account.viewProfile);

// 회원 정보 수정 api
// userId, name, phoneNumber, email
// PUT
router.put("/", account.modifyProfile);

// 회원 탈퇴 api
// userId
// DELETE
router.delete("/", account.deleteUser);

module.exports = router;