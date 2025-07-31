const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        trim: true,
    },
    image: {
        type: String,
    },
}, {
    timestamps: true,
});

const Post = mongoose.model('Post', postSchema);
module.exports = Post;