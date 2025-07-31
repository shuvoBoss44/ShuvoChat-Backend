const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    content: { type: String, maxlength: 1000 },
    image: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Like' }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    createdAt: { type: Date, default: Date.now },
});

// Indexes for performance
postSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);