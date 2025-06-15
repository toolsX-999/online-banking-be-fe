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
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use("/", sitenavRouter);
app.use("/user", userRouter);
app.use("/admin", adminRouter);
app.use('/transfer', transferRoutes);

// Default catchall route
app.all('/{*any}', (req, res, next) => {
    return res.status(404).render('pages/404', { url: req.originalUrl });;
})

app.listen(port, (req, res) => {
    console.log("Bank server is on and running on port: ", port);
})