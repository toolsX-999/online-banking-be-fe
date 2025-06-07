require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const methodOveride = require("method-override");
const connectMongo = require("./utils/connect-mongoDB");
const sitenavRouter = require("./routes/sitenav-router");
const userRouter = require("./routes/user-router");
const adminRouter = require("./routes/admin-router");
const transferRoutes = require('./routes/transfer-router');

const app = express();

const port = 3002;
connectMongo();

app.use(cors({
    credentials: true
}));

app.use(methodOveride("_method"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.use("/", sitenavRouter);
app.use("/user", userRouter);
app.use("/admin", adminRouter);
app.use('/transfer', transferRoutes);


app.get("*", (req, res) => {
    return res.send("404 Invalid route");
})

app.listen(port, (req, res) => {
    console.log("Bank server is on and running on port: ", port);
})