const Post = require('../models/postSchema');
const User = require('../models/userSchema');
const { v2: cloudinary } = require('cloudinary');
const { CustomError } = require('../utils/customError');
const { z } = require('zod');

const createPostSchema = z.object({
    content: z.string().max(1000, 'Content must be 1000 characters or less').optional(),
});

const createPost = async (req, res, next) => {
    try {
        const { content } = createPostSchema.parse(req.body);
        const userId = req.user._id;

        let image;
        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { resource_type: 'image', folder: 'shuvomedia_posts' },
                    (error, result) => {
                        if (error) reject(new CustomError(500, 'Failed to upload image to Cloudinary'));
                        resolve(result);
                    }
                );
                stream.end(req.file.buffer);
            });
            image = result.secure_url;
        }

        if (!content && !image) throw new CustomError(400, 'Content or image is required');

        const post = new Post({ content, image, user: userId });
        await post.save();

        res.status(201).json({ success: true, post });
    } catch (error) {
        next(error instanceof z.ZodError ? new CustomError(400, error.errors[0].message) : error);
    }
};

const getFriendsPosts = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).select('friends');
        if (!user) throw new CustomError(404, 'User not found');

        const posts = await Post.find({
            user: { $in: [...user.friends, userId] },
        })
            .populate('user', 'fullName profilePicture')
            .populate({
                path: 'likes',
                populate: { path: 'user', select: 'fullName' },
            })
            .populate({
                path: 'comments',
                populate: { path: 'user', select: 'fullName profilePicture' },
            })
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({ success: true, posts });
    } catch (error) {
        next(error);
    }
};

const deletePost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;
        const post = await Post.findById(postId);
        if (!post) throw new CustomError(404, 'Post not found');
        if (post.user.toString() !== userId.toString()) throw new CustomError(403, 'Unauthorized to delete this post');

        if (post.image) {
            const publicId = post.image.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`shuvomedia_posts/${publicId}`);
        }

        await Post.findByIdAndDelete(postId);
        res.status(200).json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        next(error);
    }
};

const likePost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;
        const post = await Post.findById(postId);
        if (!post) throw new CustomError(404, 'Post not found');

        const Like = require('../models/likeSchema');
        const existingLike = await Like.findOne({ post: postId, user: userId });
        if (existingLike) throw new CustomError(400, 'Post already liked');

        const like = new Like({ post: postId, user: userId });
        await like.save();

        post.likes.push(like._id);
        await post.save();

        res.status(200).json({ success: true, message: 'Post liked successfully' });
    } catch (error) {
        next(error);
    }
};

const unlikePost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;
        const Like = require('../models/likeSchema');
        const like = await Like.findOneAndDelete({ post: postId, user: userId });
        if (!like) throw new CustomError(400, 'Post not liked');

        await Post.findByIdAndUpdate(postId, { $pull: { likes: like._id } });

        res.status(200).json({ success: true, message: 'Post unliked successfully' });
    } catch (error) {
        next(error);
    }
};

const commentOnPost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;
        const { content } = req.body;
        if (!content) throw new CustomError(400, 'Comment content is required');

        const Comment = require('../models/commentSchema');
        const comment = new Comment({ content, post: postId, user: userId });
        await comment.save();

        await Post.findByIdAndUpdate(postId, { $push: { comments: comment._id } });

        res.status(201).json({ success: true, comment });
    } catch (error) {
        next(error);
    }
};

module.exports = { createPost, getFriendsPosts, deletePost, likePost, unlikePost, commentOnPost };