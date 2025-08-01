const jwt = require('jsonwebtoken');
const User = require('../schema/userSchema');
const bcrypt = require('bcryptjs');
const CustomError = require('../error/CustomError');
const { upsertStreamData } = require('../utils/stream');
const FriendRequest = require('../schema/friendRequestSchema');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Validate Cloudinary configuration
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('Cloudinary configuration error: Missing environment variables');
    throw new Error('Cloudinary configuration is incomplete. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
}
console.log('Cloudinary config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
    api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set',
});

class userController {
    static register = async (req, res, next) => {
        try {
            const { fullName, email, password } = req.body;

            if (!fullName || !email || !password) {
                return next(new CustomError(400, 'All fields are required'));
            }

            if (password.length < 6) {
                return next(new CustomError(400, 'Password must be at least 6 characters long'));
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return next(new CustomError(400, 'Invalid email format'));
            }

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return next(new CustomError(400, 'User already exists'));
            }

            const newUser = new User({
                fullName,
                email,
                password,
            });

            const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '15d' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'none',
                maxAge: 15 * 24 * 60 * 60 * 1000,
            });

            const streamUser = await upsertStreamData(newUser);
            if (!streamUser) {
                return next(new CustomError(500, 'Error upserting user data to Stream'));
            }

            const userData = await newUser.save();

            res.status(201).json({ message: 'User registered successfully', userData });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static login = async (req, res, next) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return next(new CustomError(400, 'Email and password are required'));
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return next(new CustomError(400, 'Invalid email format'));
            }

            const user = await User.findOne({ email }).select('+password');
            if (!user) {
                return next(new CustomError(401, 'Invalid email or password'));
            }

            const isMatch = await bcrypt.compare(String(password), user.password);
            if (!isMatch) {
                return next(new CustomError(401, 'Invalid email or password'));
            }

            const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
                expiresIn: '15d',
            });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'none',
                maxAge: 15 * 24 * 60 * 60 * 1000,
            });

            const streamUser = await upsertStreamData(user);
            if (!streamUser) {
                return next(new CustomError(500, 'Error upserting user data to Stream'));
            }

            const { password: _, ...userData } = user.toObject();

            res.status(200).json({ message: 'User logged in successfully', user: userData });
        } catch (error) {
            console.error('Login error:', error);
            return next(new CustomError(500, error.message || 'Internal Server Error'));
        }
    }

    static logout = async (req, res, next) => {
        try {
            res.clearCookie('token');
            res.status(200).json({ message: 'User logged out successfully' });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static updateProfile = async (req, res, next) => {
        try {
            const { fullName, bio, school, college, relationshipStatus } = req.body;
            let profilePicture;

            // Handle image upload via Cloudinary
            if (req.file) {
                console.log('Uploading to Cloudinary:', { filename: req.file.originalname, size: req.file.size });
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: 'image', folder: 'shuvomedia_profiles' },
                        (error, result) => {
                            if (error) {
                                console.error('Cloudinary upload error:', error);
                                reject(new CustomError(500, `Failed to upload image to Cloudinary: ${error.message || 'Unknown error'}`));
                            }
                            console.log('Cloudinary upload success:', { secure_url: result.secure_url });
                            resolve(result);
                        }
                    );
                    stream.end(req.file.buffer);
                });
                profilePicture = result.secure_url;
            }

            // Build update data object
            const updateData = {};
            if (fullName !== undefined && fullName !== '') updateData.fullName = fullName;
            if (bio !== undefined) updateData.bio = bio;
            if (school !== undefined) updateData.school = school;
            if (college !== undefined) updateData.college = college;
            if (relationshipStatus !== undefined) updateData.relationshipStatus = relationshipStatus;
            if (profilePicture) updateData.profilePicture = profilePicture;

            if (Object.keys(updateData).length === 0) {
                return next(new CustomError(400, 'At least one valid field must be provided to update'));
            }

            // Update user in MongoDB
            const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, {
                new: true,
            }).select('-password');

            if (!updatedUser) {
                return next(new CustomError(404, 'User not found'));
            }

            // Update user data in Stream
            const streamUser = await upsertStreamData(updatedUser);
            if (!streamUser) {
                return next(new CustomError(500, 'Error upserting user data to Stream'));
            }

            res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
        } catch (error) {
            console.error('Update profile error:', error);
            return next(new CustomError(500, error.message || 'Internal Server Error'));
        }
    }

    static getProfile = async (req, res, next) => {
        try {
            const userId = req.params.id || req.user._id;

            const user = await User.findById(userId).select('-password');
            if (!user) {
                return next(new CustomError(404, 'User not found'));
            }

            res.status(200).json({ message: 'User profile retrieved successfully', user });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static getMe = async (req, res, next) => {
        try {
            const user = await User.findById(req.user._id).select('-password');
            if (!user) {
                return next(new CustomError(404, 'User not found'));
            }

            res.status(200).json({ message: 'User profile retrieved successfully', user });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static getRecommendedUsers = async (req, res, next) => {
        try {
            const users = await User.find({
                $and: [
                    { _id: { $ne: req.user._id } },
                    { friends: { $nin: [req.user._id] } },
                ],
            }).select('-password');

            if (!users || users.length === 0) {
                return next(new CustomError(404, 'No recommended users found'));
            }

            const outgoingRequests = await FriendRequest.find({ sender: req.user._id, status: 'pending' }).select('recipient');
            const incomingRequests = await FriendRequest.find({ recipient: req.user._id, status: 'pending' }).select('sender');
            const outgoingRecipientIds = new Set(outgoingRequests.map(req => req.recipient.toString()));
            const incomingSenderIds = new Set(incomingRequests.map(req => req.sender.toString()));
            const filteredUsers = users.filter(
                user => !outgoingRecipientIds.has(user._id.toString()) && !incomingSenderIds.has(user._id.toString())
            );

            res.status(200).json({ message: 'Recommended users retrieved successfully', users: filteredUsers });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static getMyFriends = async (req, res, next) => {
        try {
            const user = await User.findById(req.user._id).populate('friends', '-password');
            if (!user) {
                return next(new CustomError(404, 'User not found'));
            }

            res.status(200).json({ message: 'Friends retrieved successfully', friends: user.friends });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static sendFriendRequest = async (req, res, next) => {
        try {
            const { id: recipientId } = req.params;

            if (!recipientId) {
                return next(new CustomError(400, 'Recipient ID is required'));
            }

            const recipient = await User.findById(recipientId);
            if (!recipient) {
                return next(new CustomError(404, 'Recipient not found'));
            }

            const existingRequest = await FriendRequest.findOne({
                $or: [
                    { sender: req.user._id, recipient: recipientId, status: 'pending' },
                    { sender: recipientId, recipient: req.user._id, status: 'pending' },
                ],
            });
            if (existingRequest) {
                return next(new CustomError(400, 'Friend request already exists'));
            }

            const user = await User.findById(req.user._id);
            if (user.friends.includes(recipientId)) {
                return next(new CustomError(400, 'User is already a friend'));
            }

            const friendRequest = new FriendRequest({
                sender: req.user._id,
                recipient: recipientId,
                status: 'pending',
            });

            await friendRequest.save();

            res.status(201).json({ message: 'Friend request sent successfully', friendRequest });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static cancelFriendRequest = async (req, res, next) => {
        try {
            const { id: requestId } = req.params;

            if (!requestId) {
                return next(new CustomError(400, 'Request ID is required'));
            }

            const friendRequest = await FriendRequest.findById(requestId);
            if (!friendRequest) {
                return next(new CustomError(404, 'Friend request not found'));
            }

            if (friendRequest.sender.toString() !== req.user._id.toString()) {
                return next(new CustomError(403, 'You are not authorized to cancel this request'));
            }

            await FriendRequest.findByIdAndDelete(requestId);

            res.status(200).json({ message: 'Friend request cancelled successfully' });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static acceptFriendRequest = async (req, res, next) => {
        try {
            const { id: requestId } = req.params;

            if (!requestId) {
                return next(new CustomError(400, 'Request ID is required'));
            }

            const friendRequest = await FriendRequest.findById(requestId).populate('sender', 'fullName profilePicture');
            if (!friendRequest) {
                return next(new CustomError(404, 'Friend request not found'));
            }

            if (friendRequest.recipient.toString() !== req.user._id.toString()) {
                return next(new CustomError(403, 'You are not authorized to accept this request'));
            }

            await User.findByIdAndUpdate(req.user._id, { $addToSet: { friends: friendRequest.sender._id } });
            await User.findByIdAndUpdate(friendRequest.sender._id, { $addToSet: { friends: req.user._id } });

            await FriendRequest.findByIdAndDelete(requestId);

            res.status(200).json({ message: 'Friend request accepted successfully', friend: friendRequest.sender });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static rejectFriendRequest = async (req, res, next) => {
        try {
            const { id: requestId } = req.params;

            if (!requestId) {
                return next(new CustomError(400, 'Request ID is required'));
            }

            const friendRequest = await FriendRequest.findById(requestId).populate('sender', 'fullName profilePicture');
            if (!friendRequest) {
                return next(new CustomError(404, 'Friend request not found'));
            }

            if (friendRequest.recipient.toString() !== req.user._id.toString()) {
                return next(new CustomError(403, 'You are not authorized to reject this request'));
            }

            await FriendRequest.findByIdAndDelete(requestId);

            res.status(200).json({ message: 'Friend request rejected successfully', sender: friendRequest.sender });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static getFriendRequests = async (req, res, next) => {
        try {
            const friendRequests = await FriendRequest.find({ recipient: req.user._id, status: 'pending' })
                .populate('sender', 'fullName profilePicture')
                .select('-__v');

            if (!friendRequests || friendRequests.length === 0) {
                return res.status(200).json({ message: 'No friend requests found', friendRequests: [] });
            }

            res.status(200).json({ message: 'Friend requests retrieved successfully', friendRequests });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static getOutgoingFriendRequests = async (req, res, next) => {
        try {
            const outgoingRequests = await FriendRequest.find({ sender: req.user._id, status: 'pending' })
                .populate('recipient', 'fullName profilePicture')
                .select('-__v');

            const validRequests = [];
            for (const request of outgoingRequests) {
                if (!request.recipient || !mongoose.Types.ObjectId.isValid(request.recipient._id)) {
                    await FriendRequest.findByIdAndDelete(request._id);
                    console.warn(`Deleted invalid friend request with ID: ${request._id}`);
                    continue;
                }
                validRequests.push(request);
            }

            res.status(200).json({
                message: 'Outgoing friend requests retrieved successfully',
                outgoingRequests: validRequests,
            });
        } catch (error) {
            console.error('Error fetching outgoing friend requests:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }
}

module.exports = userController;