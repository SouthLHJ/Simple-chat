const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");


const Room = require("../model/Room");
const Message = require("../model/Message");

const router = express.Router();


// 파일 업로드 multer 설정
const upload = multer.diskStorage({
    destination : function(req,file,callback){
        //룸id는 쿼리로 받았음. 왜인지 post body로 roomId가 안받아져온다.
        const uploadPath = path.join(__dirname,"..","static","room",req.query.roomId);
        if(!fs.existsSync(uploadPath)){ 
            fs.mkdirSync(uploadPath,{recursive:true});  
        }
        callback(null,uploadPath);
    },

    filename : function(req,file,callback){
        let newName = "room_" + Date.now() + "_" + path.parse(file.originalname).ext ;
        // let newName = Date.now() + file.originalname.split(".")[1];
        callback(null,newName);
    }

})
const roomUpload = multer({storage: upload})

//미들웨어
router.use(express.json({"limit":"100mb"}));
router.use((req,res,next)=>{
    if(req.session.loggedIn){
        next();
    }else{
        res.redirect("/account/signin")
    }
})





//로그인한 클라이언트 관리
const clients = new Set();
router.ws("/sse",(ws,req)=>{
    //누군가가 클라이언트 쪽에서 웹소켓 연걸이 일어났을 때 작동한다.
    console.log(req.originalUrl+"  connect by " + req.session.id);
    clients.add(ws);
    ws.on("close", ()=>{
        console.log("closed...");
        clients.delete(ws);
    })
});


//방에 참여자 또는 나가는 사람이 생길 경우 클라이언트에서 새로운 WebSocket이 생성된다.
const roomWss = new Map();
router.ws("/room",(ws,req)=>{
    //클라이언트에서 ws 연결 시 뒤쪽에 query형식으로 req를 줬다.
    // console.log("ws://~room "+req.session.userid + "..." + req.query.room_id);
    //룸 입장 시 내 ws 값을 서버에 넣어놓는다.
            //key : userid, value : ws, roomId
    roomWss.set(req.session.userid, {ws,roomId:req.query.room_id});

    //룸 퇴장 시 내 ws 값을 서버에서 뺀다.
    // console.log(roomWss);
    ws.on("close",()=>{
        roomWss.delete(req.session.userid);
        // console.log(roomWss);
    })
})

//{type : "join", id : "req.session.userid"}

//라우터

//방 목록 출력
router.route("/")
    .get(async(req,res)=>{
        id= req.session.userid;
        let rooms = await Room.find({"joiners.joiner" : {$all :[id]}}).sort("-createdAt").populate("key").lean();

        //key에 roomId에 해당되는 메세지들이 뽑아져온다.
        rooms.forEach((room)=>{
            // console.log(room.key)
            // console.log(room.key.length);
            room.unReadCnt = room.key.filter((msg)=>{
                return msg.beingRead.includes(req.session.userid);
            }).length;
            if(room.key.length>0){
                // console.log(room.key)
                // console.log(room.key[room.key.length-1].content ?? "");
                room.lastMsg = room.key[room.key.length-1].content ?? "";
            }
        })
        res.locals.rooms= rooms;
        

        // console.log(rooms);
        res.render("chats/index",{id, option : "참여방"});
    })
    .post(async(req,res)=>{
        let option = req.body.roomOption;
        let id= req.session.userid;
        let rooms;
        switch(option){
            case "전체" : 
                rooms = await Room.find({}).sort("-createdAt").populate("key").lean();



                break;

            case "참여방" :
                rooms = await Room.find({"joiners.joiner" : {$all :[id]}}).sort("-createdAt").populate("key").lean();

                
                break;

            case "비참여방" :
                rooms = await Room.find({"joiners.joiner" : {$nin :[id]}}).sort("-createdAt").populate("key").lean();

                break;

        }
        //key에 roomId에 해당되는 메세지들이 뽑아져온다.
        rooms.forEach((room)=>{
            room.unReadCnt = room.key.filter((msg)=>{
                return msg.beingRead.includes(req.session.userid);
            }).length;
        })
        

        res.locals.rooms =  rooms;
        // console.log(option,id,rooms);
        res.render("chats/index",{id , option});

    })

//방 개설 및 리스트 보이기
router.route("/open")
    .get(async(req,res)=>{

    })
    .post (async(req,res)=>{
        // console.log(req.session);
        // Room Model의 형식 중 joiners가 스키마일때
        // let data =  {...req.body, owner : req.session.userid, joiners : [{joiner :req.session.userid}]};
        let data =  {...req.body, owner : req.session.userid, joiners : {joiner :req.session.userid, joinTime : Date.now()}};
                    // body안에 필수 입력인, title,type,password란 이름이 있어야한다. 
        // console.log(data);
        //서버측에서 변경이 생겼을 때 클라이언트(브라우저)에게 변경사항이 있다고 알람을 띄워주려고한다.

        Room.create(data).then((rst)=>{
            // console.log(rst);
            Message.create({roomId: rst._id, talker : req.session.userid, data : "alarm", content : req.session.userid+"님이 입장하였습니다."});
            return rst;
        }).then((rst)=>{
            clients.forEach((ws)=>{
                ws.send(JSON.stringify({type : "new", session : req.session.userid }));
            })
            res.status(200).redirect(`/chat/room?room_id=${rst._id}`);
        })
    })


//방 입장
router.get("/room",async (req,res)=>{
    if(await Room.findById(req.query.room_id).lean()){
        let joinTime;
        //방 입장시 joiners 확인
        let chkjoiner = await Room.findOne({_id : req.query.room_id, "joiners.joiner" : req.session.userid});
        // console.log( req.session.userid);
        // console.log("test",chkjoiner);
    
        if(!chkjoiner){
            // 없던 유저일 때에는 joiner에 값 넣어주고.
            await Room.updateOne({_id:req.query.room_id},{$addToSet:{joiners: {joiner :req.session.userid,joinTime : Date.now()}}});
            joinTime = Date.now();
            //참여한거 message에 남기기
            await Message.create({roomId: req.query.room_id, talker : req.session.userid, data : "alarm", content : req.session.userid+"님이 입장하였습니다."});
    
            //방 정보 얻어오기
            const room = await Room.findById(req.query.room_id).lean();
    
            // roomWss에 저장되어있는 ws 유저들에게 나 들어왔다고 ws message 전송하기
            roomWss.forEach((value,userid)=>{
                value.ws.send(JSON.stringify({type : "join", apply : req.query.room_id, id : req.session.userid, joiner : room.joiners}));
            })
        }else{
            //있던 유저라면....
            //최초 입장 시간을 추출한다.
            let idx;
            chkjoiner.joiners.forEach((joiner,i)=>{
                if(joiner.joiner == req.session.userid){
                    idx=i;
                }
            });
            // console.log(idx);
            joinTime = chkjoiner.joiners[idx].joinTime;
    
            //입장하면서 beingRead에서 userid 빼기.
            await Message.updateMany({roomId:req.query.room_id},{$pull :{beingRead : req.session.userid}})
    
            //입장하면서 beingRead했다고 신호주기...
            roomWss.forEach((value,userid)=>{
                value.ws.send(JSON.stringify({type : "read", apply : req.query.room_id, id : req.session.userid}));
            })
        }
    
        // 입장 시간에 맞춰 메세지 얻어오기
        // console.log(joinTime, typeof joinTime);
        const contents = await Message.find({roomId: req.query.room_id}).where("createdAt").gte(joinTime).sort("createdAt").lean();
    
        //방 정보 얻어오기
        const room = await Room.findById(req.query.room_id).lean();
    
        // console.log("now",contents);
        res.locals.contents = contents.map((one)=>{
            return {...one, type : one.talker == req.session.userid ? "right" : "left"};
        })
    
        res.locals.room = room;
    
        
    
        res.render("chats/room",{userid : req.session.userid})

    }else{
        res.write("<script>alert('The Room already was deleted by owener..')</script>");
        res.write("<script>location.href='/chat'</script>");
    }
    
});
//방 아예 나가기
router.post("/outRoom",async(req,res)=>{
    // console.log("방나가기 post 입장")
    let roomId = req.body.roomId;
    let userid = req.body.userid;

    //퇴장하면서 해당 룸에 대한 메세지의 beingRead에서 userid 빼기.
    await Message.updateMany({roomId:roomId},{$pull :{beingRead : req.session.userid}})
    //beingRead 수정해야한다고 신호주기...
    roomWss.forEach((value,userid)=>{
        value.ws.send(JSON.stringify({type : "read", apply : req.query.room_id, id : req.session.userid}));
    })

    //해당 룸에 있는 joiners 에서 userid 빼기
    let result = await Room.findByIdAndUpdate(roomId,{$pull :{joiners :{joiner : userid}}},{returnDocument : "after"});

    await Message.create({roomId:req.body.roomId, talker : req.session.userid, data : "alarm", content : req.session.userid+"님이 퇴장하였습니다."});
    // console.log(result);

    roomWss.forEach((value,userid)=>{
        // console.log("??????")
        // console.log("퇴장후 결과",result);
        value.ws.send(JSON.stringify({type : "exit", apply : roomId, id : req.session.userid, joiners : result.joiners}));
    })

    res.redirect("/chat")

})

//개설자가 방을 삭제하려할 때
router.post("/deleteRoom",async(req,res)=>{
    let roomId = req.body.roomId;
    let userid = req.body.userid;

    //폭파된 방에 있는 사용자에게 알람을 보내준다. 방이 폭파되었다고.
    roomWss.forEach((value,userid)=>{
        if(value.roomId == roomId){
            value.ws.send(JSON.stringify({type : "delete", apply : roomId}));
        }
    })
    //모델 Room에서는 방을 삭제하고
    await Room.deleteMany({_id:roomId})

    //메세지에서 Room에있는 모든 메세지를 삭제한다.
    await Message.deleteMany({roomId : roomId})

    //index로 돌아가!
    res.redirect("/chat")
})


// AJAX 처리용
    //메세지!
router.post("/api/message",async(req,res)=>{
    //req.body에 room_id랑 comment가 왔다는 조건하에
    try {
        //메세지 보낼 때 방 참가자들 뽑아내기
        let join = await Room.findById(req.body.roomId).select("joiners.joiner -_id");
        let joiners = join.joiners;
        joiners = joiners.map((joiner)=>{
            return joiner.joiner;
        })
        console.log(joiners);

        //접속자 중에 룸아이디 같은게 있으면 beingRead에서 joiner 이름을 빼버리자!
        roomWss.forEach((value,userid)=>{
            if(value.roomId==req.body.roomId){
                // console.log("현재 보는사람들 중에 동일한 룸아이디의 roomWss가 있다.")
                joiners.forEach((joiner,idx)=>{
                    if(joiner == userid){
                        joiners.splice(idx,1);
                    }
                })
                // console.log(joiners);
            }
        })

        let result =  await Message.create({...req.body, talker : req.session.userid, data : "chat", beingRead : joiners});
                                            // ㄴ roomId, content
        // console.log(result)
        result = result.toObject();
        roomWss.forEach((value,userid)=>{
            
            result.usertype = result.talker == userid ? "right" : "left"
            value.ws.send(JSON.stringify({type : "new",apply : req.body.roomId, data : result}));

        })
        
        res.json({"success" : true,"content" : result});
    }catch(err){
        res.json({"success" : false, "error" : err.message});
    }
})

    //파일 업로드
router.post("/api/upload",roomUpload.single("attach"),async(req,res)=>{
    //요청 사용자는 fetch로 요청을 보내고
    //업로드 처리가 되었다.
    try{
        //메세지 보낼 때 방 참가자들 뽑아내기
        let join = await Room.findById(req.query.roomId).select("joiners.joiner -_id");
        let joiners = join.joiners;
        joiners = joiners.map((joiner)=>{
            return joiner.joiner;
        })
        console.log(joiners);

        //접속자 중에 룸아이디 같은게 있으면 beingRead에서 joiner 이름을 빼버리자!
        roomWss.forEach((value,userid)=>{
            if(value.roomId==req.query.roomId){
                // console.log("현재 보는사람들 중에 동일한 룸아이디의 roomWss가 있다.")
                joiners.forEach((joiner,idx)=>{
                    if(joiner == userid){
                        joiners.splice(idx,1);
                    }
                })
                // console.log(joiners);
            }
        })


        let doc = {
            ...req.query,
            talker : req.session.userid,
            data : "file",
            content : `/room/${req.query.roomId}/${req.file.filename}`,
            beingRead : joiners
        };

        let result =  await Message.create(doc);
        result = result.toObject();
        // console.log(result);
        roomWss.forEach((value,userid)=>{

            result.usertype = result.talker == userid ? "right" : "left"
            value.ws.send(JSON.stringify({type : "new",apply : req.query.roomId, data : result}));

        })
        
        res.json({"success" : true,"content" : result});
    }catch(err){
        res.json({"success" : false, "error" : err.message});
    }


    //이걸 (DB)데이터 베이스에 저장하고..
    //이 요청을 했던 사용자에게 res.json으로 성공 여부를 알려주고

    //해당 방 사용자들이 파일이 추가됬다는걸 알 수 있게

    //메세지를 전송하는데 렌더링에 필요한 데이터를 같이 보내주면 된다.
})

module.exports = router;