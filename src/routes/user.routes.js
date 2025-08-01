const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const postController = require('../controllers/postController');
const authentication = require('../auth/authentication');
const multer = require('multer');

router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/logout', userController.logout);

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new CustomError(400, 'Only JPEG, JPG, PNG, or GIF images are allowed'));
        }
    },
});

// Correctly apply the middleware to only the updateProfile route
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

module.exports = router;