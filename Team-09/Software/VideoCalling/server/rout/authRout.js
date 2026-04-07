import express from "express"
import {  SignUp ,Login, LogOut} from "../routController/authControler.js";
import isLogin from "../middleware/isLogin.js";

const router = express.Router();

router.post('/login',Login)

router.post('/signup',SignUp)

router.post('/logout',isLogin,LogOut)


export default router