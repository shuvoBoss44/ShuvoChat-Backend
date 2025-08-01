const express = require('express');
const userController = require('../controllers/user.controller');
const postController = require('../controllers/postController');
const authentication = require('../auth/authentication');
const CustomError = require('../error/CustomError');

// Export a function that accepts the multer 'upload' instance
module.exports = (upload) => {
    const router = express.Router();

    router.post('/register', userController.register);
    router.post('/login', userController.login);
    router.post('/logout', userController.logout);

    // The middleware is correctly applied here and nowhere else
    router.patch('/updateProfile', authentication, upload.single('profilePicture'), userController.updateProfile);

    router.get('/profile/:id', authentication, userController.getProfile);
    router.get('/getMe', authentication, userController.getMe);
    router.get('/recommendations', authentication, userController.getRecommendedUsers);
    router.get('/friends', authentication, userController.getMyFriends);
    router.post('/friend-request/:id', authentication, userController.sendFriendRequest);
    router.delete('/cancel-friend-request/:id', authentication, userController.cancelFriendRequest);
    router.post('/accept-friend-request/:id', authentication, userController.acceptFriendRequest);
    router.delete('/reject-friend-request/:id', authentication, userController.rejectFriendRequest);
    router.get('/friend-requests', authentication, userController.getFriendRequests);
    router.get('/getOutgoingFriendRequests', authentication, userController.getOutgoingFriendRequests);
    router.get('/posts/:userId', authentication, postController.getUserPosts);

    return router;
};