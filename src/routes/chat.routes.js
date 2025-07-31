const express = require('express');
const router = express.Router();
const authentication = require('../auth/authentication');
const chatController = require('../controllers/chat.controller');

router.get('/token', authentication, chatController.getStreamToken);
router.get('/groups', authentication, chatController.getGroups);
router.post('/create-group', authentication, chatController.createGroup);

module.exports = router;