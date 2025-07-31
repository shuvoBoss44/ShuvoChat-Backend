const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authentication = require('../auth/authentication');
const multer = require('multer');

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

router.post('/create', authentication, upload.single('image'), postController.createPost);
router.get('/friends', authentication, postController.getFriendsPosts);
router.post('/like/:postId', authentication, postController.likePost);
router.delete('/unlike/:postId', authentication, postController.unlikePost);
router.post('/comment/:postId', authentication, postController.commentOnPost);
router.get('/comments/:postId', authentication, postController.getPostComments);

module.exports = router;