const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    image: {
        type: String,
        default: 'https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-group-avatar-600nw-2264922221.jpg',
    },
    members: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    ],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true,
});

const Group = mongoose.model('Group', groupSchema);
module.exports = Group;