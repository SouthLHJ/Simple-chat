const express = require("express");
const Account = require("../model/Account");

const router = express.Router();


//미들웨어
router.use(express.urlencoded({"extended":true}));

//라우팅
    //변수
    //회원가입
router.route("/signup")
    .get((req,res)=>{
        res.render("signup",{
            msg : "",
        })
    })
    .post((req,res)=>{
        let submitchk = req.body.id && req.body.pw && req.body.name
                     && req.body.email&& req.body.contact&& req.body.birth;
        if(!submitchk || req.body.idchkRst == false){
            res.render("signup",{
                msg : "중복 아이디 확인 또는 전체 작성 해주시길 바랍니다.",
            })
        }else{
            let save = {
                id : req.body.id,
                pw : req.body.pw,
                email : req.body.email,
                name : req.body.name,
                contact : req.body.contact,
                birth : req.body.birth,
                log : new Date()
            }
            accounts.insertOne(save).then(rst =>{
                console.log(rst)
            }).finally(()=>{
                res.redirect("/account/signin")
            })
        }
    })

    //로그인
router.route("/signin")
    .get((req,res)=>{
        res.render("signin",{
            msg : "",
        })
    })
    .post((req,res)=>{
        Account.findByUserId(req.body.id).then(elm=>{
            //id체크
            if(elm == undefined){ // 찾아봤는데 elm이 없을경우.
                res.status(401).render("signin",{
                    msg : "사용하고 있지않은 아이디입니다.",
                })
            }else{
                //해당id랑 pw가 동일한 _id에있는지 체크
                let rstpw = elm.pw == req.body.pw;
                if(rstpw){
                    req.session.loggedIn = true;
                    req.session.userid = elm.id;
                    res.redirect("/chat");
                }else{
                    res.status(401).render("signin",{
                        msg : "잘못된 비밀번호입니다.",
                    })
                }
            }
        });
    })


module.exports = router;
