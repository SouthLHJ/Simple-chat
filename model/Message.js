const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    roomId : {
        type : mongoose.Schema.Types.ObjectId, 
        ref : "room",
        required : true,
    },
    talker : {type : String,required : true},

    beingRead : {
        type : [String],
        required : true,
    },  

    data : {type : String, required : true},
    content : String,
    createdAt : {type: Date, default : Date.now},
    
});

module.exports = mongoose.model("message", messageSchema)