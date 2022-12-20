const mongoose = require("mongoose");

// const joinerSchema = new mongoose.Schema({
//     joiner : String,
//     joinTime : {
//         type : Date, 
//         default : Date.now()},
// })
// joinerSchema.remove("_id");

const roomSchema = new mongoose.Schema({
    title : {type :String, required : true},
    type : {type :String, required : true},
    password : {type :String, required : true},
    
    owner : String,
    // joiners : [joinerSchema],
    joiners : [{
            joiner :String,
            joinTime: {type : Date,default:Date.now}
    }],
    
    createdAt : {type : Date, default : Date.now},
},{
    toObject : {virtuals :true} //만약에 뽑아내면 key라는 필드도 뽑아낼꺼야
})

roomSchema.virtual("key",{
    localField:"_id",       //room의 _id가
    ref : "message",        //message의 
    foreignField : "roomId" // 호출할때의 roomId가 같은 메세지들을 뽑아낼꺼임
})

module.exports = mongoose.model("room",roomSchema);
