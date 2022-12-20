const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
    id : String,
    pw : String,
    email : String,
    name : String,
    contact : String,
    birth : String,
    log : Date,
    image : String,
},{
    statics : {
        findByUserId(val){
            return this.findOne({id : val});
        }
    }
})

module.exports = mongoose.model("account",accountSchema);