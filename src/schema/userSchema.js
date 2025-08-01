const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const CustomError = require('../error/CustomError');

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false,
    },
    profilePicture: {
        type: String,
        default: 'https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg',
    },
    bio: {
        type: String,
        default: 'Hello, I am using ShuvoMedia!',
    },
    school: {
        type: String,
        trim: true,
    },
    college: {
        type: String,
        trim: true,
    },
    relationshipStatus: {
        type: String,
        enum: ['Single', 'In a relationship', 'Married', 'Complicated', ''],
        default: '',
    },
    friends: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    ],
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
}, {
    timestamps: true,
});

// Password hashing
userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        try {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        } catch (error) {
            return next(new CustomError(500, 'Error hashing password'));
        }
    }
    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;