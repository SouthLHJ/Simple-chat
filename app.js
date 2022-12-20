const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const expressWS = require("express-ws");
const dotenv = require("dotenv");
const session = require("express-session");
dotenv.config();
const app = express();
const wsInstance = expressWS(app);

const accountRouter = require("./router/account");
const chatRouter = require("./router/chat");
//몽구스 연결!
!async function (){
    // console.log(process.env.MONGODB_URI)
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri,{dbName : "study"});
}();

//셋팅
app.set("view engine","ejs");
app.set("views", path.join(__dirname,"view"));

//미들웨어
app.use(session({
    secret : "accounts", //암호화
    resave : false,
    saveUninitialized : false, // 로그인하면 생성되도록하기.
}));
    /* session 선언하는 부분이 미들웨어이기때문에 라우터 보다 위쪽에 둬서
     거치고나서 라우터로 가게 하자.. 안그러면 선언안됬다고 뜸. */

         //사진첨부
app.use(express.static(path.join(__dirname,"static")))
app.use(express.urlencoded({"extended":true}));
app.use("/user",(req,res,next)=>{
    //로그인 상태가 맞는지 확인.
    if(req.session.cookie){ //쿠키생성되있으면.
        next();
    }
})

app.use("/account",accountRouter);
app.use("/chat",chatRouter);


//라우터
app.get("/",(req,res)=>{
    res.redirect("/account/signin")
})


app.listen(8080);

