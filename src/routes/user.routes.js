const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const authentication = require("../auth/authentication");

router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/logout", userController.logout);
router.patch("/updateProfile", authentication, userController.updateProfile);
router.get("/profile/:id", authentication, userController.getProfile);
router.get("/getMe", authentication, userController.getMe);
router.get("/recommendations", authentication, userController.getRecommendedUsers); // Fixed typo
router.get("/friends", authentication, userController.getMyFriends);
router.post("/friend-request/:id", authentication, userController.sendFriendRequest);
router.delete("/cancel-friend-request/:id", authentication, userController.cancelFriendRequest);
router.post("/accept-friend-request/:id", authentication, userController.acceptFriendRequest); // Changed to POST
router.delete("/reject-friend-request/:id", authentication, userController.rejectFriendRequest); // Already DELETE
router.get("/friend-requests", authentication, userController.getFriendRequests);
router.get("/getOutgoingFriendRequests", authentication, userController.getOutgoingFriendRequests);

module.exports = router;