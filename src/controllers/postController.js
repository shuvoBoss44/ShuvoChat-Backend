const Post = require('../schema/postSchema');
const Like = require('../schema/likeSchema');
const Comment = require('../schema/commentSchema');
const User = require('../schema/userSchema');
const CustomError = require('../error/CustomError');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

class postController {
    // Create a post
    static async createPost(req, res, next) {
        try {
            const { content } = req.body;
            let image;

            if (!content && !req.file) {
                return next(new CustomError(400, 'Content or image is required'));
            }

            if (req.file) {
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: 'image', folder: 'shuvochat_posts' },
                        (error, result) => {
                            if (error) reject(new CustomError(500, 'Failed to upload image to Cloudinary'));
                            resolve(result);
                        }
                    );
                    stream.end(req.file.buffer);
                });
                image = result.secure_url;
            }

            const post = new Post({
                user: req.user._id,
                content,
                image,
            });

            await post.save();

            const populatedPost = await Post.findById(post._id)
                .populate('user', 'fullName profilePicture')
                .select('-__v');

            res.status(201).json({ message: 'Post created successfully', post: populatedPost });
        } catch (error) {
            console.error('Error creating post:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // Get friends' posts
    static async getFriendsPosts(req, res, next) {
        try {
            const user = await User.findById(req.user._id).select('friends');
            if (!user) {
                return next(new CustomError(404, 'User not found'));
            }

            const posts = await Post.find({ user: { $in: [...user.friends, req.user._id] } })
                .populate('user', 'fullName profilePicture')
                .sort({ createdAt: -1 })
                .select('-__v');

            res.status(200).json({ message: 'Posts retrieved successfully', posts });
        } catch (error) {
            console.error('Error fetching posts:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // Get user's posts
    static async getUserPosts(req, res, next) {
        try {
            const userId = req.params.userId;
            const user = await User.findById(userId);
            if (!user) {
                return next(new CustomError(404, 'User not found'));
            }

            const posts = await Post.find({ user: userId })
                .populate('user', 'fullName profilePicture')
                .sort({ createdAt: -1 })
                .select('-__v');

            res.status(200).json({ message: 'User posts retrieved successfully', posts });
        } catch (error) {
            console.error('Error fetching user posts:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // Like a post
    static async likePost(req, res, next) {
        try {
            const { postId } = req.params;

            const post = await Post.findById(postId);
            if (!post) {
                return next(new CustomError(404, 'Post not found'));
            }

            const existingLike = await Like.findOne({ user: req.user._id, post: postId });
            if (existingLike) {
                return next(new CustomError(400, 'Post already liked'));
            }

            const like = new Like({
                user: req.user._id,
                post: postId,
            });

            await like.save();

            res.status(200).json({ message: 'Post liked successfully' });
        } catch (error) {
            console.error('Error liking post:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // Unlike a post
    static async unlikePost(req, res, next) {
        try {
            const { postId } = req.params;

            const like = await Like.findOneAndDelete({ user: req.user._id, post: postId });
            if (!like) {
                return next(new CustomError(400, 'Post not liked'));
            }

            res.status(200).json({ message: 'Post unliked successfully' });
        } catch (error) {
            console.error('Error unliking post:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // Comment on a post
    static async commentOnPost(req, res, next) {
        try {
            const { postId } = req.params;
            const { content } = req.body;

            if (!content) {
                return next(new CustomError(400, 'Comment content is required'));
            }

            const post = await Post.findById(postId);
            if (!post) {
                return next(new CustomError(404, 'Post not found'));
            }

            const comment = new Comment({
                user: req.user._id,
                post: postId,
                content,
            });

            await comment.save();

            const populatedComment = await Comment.findById(comment._id)
                .populate('user', 'fullName profilePicture')
                .select('-__v');

            res.status(201).json({ message: 'Comment added successfully', comment: populatedComment });
        } catch (error) {
            console.error('Error commenting on post:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // Get comments for a post
    static async getPostComments(req, res, next) {
        try {
            const { postId } = req.params;

            const post = await Post.findById(postId);
            if (!post) {
                return next(new CustomError(404, 'Post not found'));
            }

            const comments = await Comment.find({ post: postId })
                .populate('user', 'fullName profilePicture')
                .sort({ createdAt: -1 })
                .select('-__v');

            res.status(200).json({ message: 'Comments retrieved successfully', comments });
        } catch (error) {
            console.error('Error fetching comments:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }
}

module.exports = postController;