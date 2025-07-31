const express = require("express")
const router = express.Router();
const authentication = require("../auth/authentication");
const chatController = require("../controllers/chat.controller");

router.get("/token", authentication, chatController.generateStreamToken);

module.exports = router;