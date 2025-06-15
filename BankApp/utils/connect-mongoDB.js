const mongoose = require("mongoose");
const localMongo = "mongodb://127.0.0.1:27017/bankDB";
const cloudMongo = "";
const mongoUri = localMongo;

const connectMongo = () => {
    mongoose.connect(mongoUri)
    .then(() => console.log("Mongodb connected successfully")
    )
    .catch((err) => console.log("Mongodb connection error", err)
    );
}

module.exports = connectMongo;

