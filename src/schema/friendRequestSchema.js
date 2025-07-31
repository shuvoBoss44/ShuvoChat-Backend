const mongoosen = require('mongoose');

const friendRequestSchema = new mongoosen.Schema({
    sender: {
        type: mongoosen.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoosen.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true,
});

const FriendRequest = mongoosen.model('FriendRequest', friendRequestSchema);
module.exports = FriendRequest;