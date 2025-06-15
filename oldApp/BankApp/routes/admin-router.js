const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Customer = require("../models/customer-model");
const Account = require("../models/accounts-model");
const Transaction = require("../models/transaction-model");
const util = require("util");

bcrypt.hash = util.promisify(bcrypt.hash);

const router = express.Router();

// Get create new user/customer form
router.get("/register-user", (req, res) => {
    res.render("pages/admin/register-user");
});

// Create a new user (customer)
router.post("/register-user", async(req, res) => {
    console.log("Request recieved in /register-user route");
    const {
        fullname,
        email,
        password,
        confirmPassword,
        accountNumber,
        routingNumber,
        accountBalance,
        accountType,
        creationDate } = req.body;
    
    if (password !== confirmPassword) {
        // console.log("Password and confirm password does not match");
        return res.status(400).json({message: "Passwords does not match"});
    }
    if (!fullname || !email || !password || !accountNumber || !accountBalance || !routingNumber) {
        // console.log("Required fields missing");
        // console.log(req.body);
        return res.status(400).json({message: "Required fields missing"});
    }   
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const customer = await Customer.create({
            fullName: fullname,
            email,
            passwordHash: hashedPassword,
            createdAt: creationDate || Date.now(),
            accounts: [],
            otpSettings: {
                transfer: {
                  enabled: true,
                  checkpoints: [40, 70],
                  codes: ['OTP1', 'OTP2'], // can be generated or set manually
                  msgs: ["C.O.T code", "T.A.C code"]
                },
                withdrawal: {
                  enabled: true,
                  checkpoints: [30, 60],
                  codes: ['WOTP1', 'WOTP2'],
                  msgs: ["C.O.W code", "W.A.C code"]
                },
                deposit: {
                  enabled: true,
                  checkpoints: [50],
                  codes: ['DOTP1'],
                  msgs: ["D.A.C code"]
                }
              }
        });
        // console.log("user in db = ", customer);
        const customerAccount = await Account.create({
            customerId: customer._id,
            accountType,
            accountNumber,
            routingNumber,
            balance: parseFloat(accountBalance).toFixed(2)
        });
        customer.accounts.push(customerAccount._id);
        await customer.save();
        // console.log("User created successfully");
        return res.status(200).json({message: "Created successfully"});
    } catch (error) {
        // console.log("Error occured registering user: ", error.message);
        return res.status(500).json({message: "Server error"});
    }
})

// Get unused accounts for user (used internally)
router.get("/user-missing-accounts/:userId", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.userId)) {
        console.log("Invalid user id in req.params.userId");
        return res.status(404).json({ error: "Invalid user id" });
    }
    const userId = req.params.userId;
    const allTypes = ["checking", "savings", "credit"];
  
    try {
      const user = await Customer.findById(userId).populate("accounts");
      if (!user) return res.status(404).json({ error: "User not found" });
  
      const existingTypes = user.accounts.map(acc => acc.accountType.toLowerCase());
      const missingTypes = allTypes.filter(type => !existingTypes.includes(type));
  
      return res.json({ missingTypes });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

router.get("/update-user", async (req, res) => {
    // console.log("User to update in update-user route id = ", req.params.id);
    let users;
    try {
        users = await Customer.find().select("-passwordHash");
        if (users.length === 0) {
            console.log("No users found");
            return res.render("pages/admin/update-user-account", {
                users: [],
            });
        }
        console.log("Here is users list = ", users);       
        res.render("pages/admin/update-user-account", {
            users,
        });
    } catch (error) {
        return res.render("pages/admin/update-user-account", {
            message: "Error occured fetching users",
            users: [],
        });
    }
});

// Add more accounts to user
router.put("/update-user/:id", async (req, res) => {
    console.log("User to update in update-user route id = ", req.params.id);
    if (!mongoose.isValidObjectId(req.params.id)) {
        console.log("Invalid user id in req.params.id");
        return res.status(404).json({ error: "Invalid user id" });
    }
    const userId = req.params.id;

    const { accountType, routingNumber, accountNumber, accountBalance, updateDate } = req.body;
    if (!accountType || !routingNumber || !accountNumber || !accountBalance) {
        console.log("Required fields missing");
        return res.status(400).json({message: "Required fields missing"});        
    }
    try {
        // const user = await Customer.findOne({_id: userId}).select("-passwordHash").populate("accounts");
        // user.accounts.push(userId);
        // await user.save();
        // console.log("Customer updated and saved");

        const userAccount = await Account.create({
            customerId: userId,
            accountType,
            accountNumber,
            routingNumber,
            balance: accountBalance,
            createdAt: updateDate || Date.now(),
        });

        if (!userAccount) {
            console.log("Account update was not successful");
            return res.status(500).json({message: "Account update was not successful"});
        }

        await Customer.findByIdAndUpdate(
            userId,
            { $push: { accounts: userAccount._id } },
            { new: true }
        );
        console.log("Account successfully updated and redirecting to same page via PRG!!!");
        // Send success JSON response
        return res.status(200).json({ message: "Account added successfully" }); 

    } catch (error) {
        console.log("Account update was not successful: ", error.message);
    }
});

// Get set-otp page
router.get("/set-otp", async(req, res) => {
    try {
        const users = await Customer.find().select("-passwordHash");
        if (users) {
            return res.render("pages/admin/otp-settings", {users});
            // return res.status(200).json({users});
        }
    } catch (error) {
        console.log("Error in set-otp route: ", error.message);
        return;        
    }
});

// Set OTP
router.put('/set-otp', async (req, res) => {
    try {
      const {
        user, // customerId
        transactionType,
        enableDisableOtp,
        otpLevel,
        checkpoints,
        codes,
        otpMsgs,
        deliveryMode
      } = req.body;
  
      const customer = await Customer.findById(user);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
  
      const isEnabled = enableDisableOtp === 'enable';
  
      let checkpointArray = [];
      let codeArray = [];
      let msgArray = [];
  
      if (otpLevel === '1') {
        checkpointArray = [50];
        codeArray = [codes?.split(',')[0] || '1020A'];
        msgArray = [otpMsgs?.split(',')[0] || 'C.O.T'];
      } else if (otpLevel === 'multiple') {
        checkpointArray = checkpoints.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
        codeArray = codes.split(',').map(c => c.trim());
        msgArray = otpMsgs.split(',').map(m => m.trim());
  
        if (checkpointArray.length !== codeArray.length || checkpointArray.length !== msgArray.length) {
          return res.status(400).json({ error: 'Mismatch between checkpoints, codes, and otpMsgs lengths' });
        }
      } else {
        // If no valid otp level, default to empty
        checkpointArray = [];
        codeArray = [];
        msgArray = [];
      }
  
      customer.otpSettings[transactionType] = {
        enabled: isEnabled,
        checkpoints: checkpointArray,
        codes: codeArray,
        otpMsgs: msgArray,
        deliveryMode: deliveryMode || 'manual'
      };
  
      await customer.save();
      res.json({ success: true, message: 'OTP settings updated successfully' });
    } catch (err) {
      console.error('Error in /admin/set-otp:', err);
      res.status(500).json({ error: 'Server error' });
    }
});
  

// Validate checkpoint
router.get('/checkpoint', async (req, res) => {
    const { transactionId, percent, type } = req.query;
    const customerId = req.session.userId;

    const customer = await Customer.findById(customerId);
    if (!customer || !customer.otpSettings?.[type]?.enabled) return res.json({ requiresOtp: false });

    const checkpoints = customer.otpSettings[type].checkpoints;
    const percentNum = parseInt(percent);
    const index = checkpoints.findIndex(cp => cp === percentNum);
    if (index === -1) return res.json({ requiresOtp: false });

    const txn = await Transaction.findById(transactionId);
    if (!txn.usedCheckpoints.includes(percentNum)) {
        return res.json({ requiresOtp: true, index });
    }

    res.json({ requiresOtp: false });
});

// Validate OTP
router.post('/verify', async (req, res) => {
    const { transactionId, code, type, percent } = req.body;
    const customerId = req.session.userId;
  
    const customer = await Customer.findById(customerId);
    const txn = await Transaction.findById(transactionId);
  
    const settings = customer.otpSettings?.[type];
    if (!settings?.enabled) return res.status(400).json({ success: false });
  
    const percentNum = parseInt(percent);
    const index = settings.checkpoints.findIndex(cp => cp === percentNum);
    if (index === -1) return res.status(400).json({ success: false });
  
    if (settings.codes[index] !== code) return res.json({ success: false });
  
    if (!txn.usedCheckpoints.includes(percentNum)) {
      txn.usedCheckpoints.push(percentNum);
      await txn.save();
    }
  
    res.json({ success: true });
  });
  
module.exports = router;