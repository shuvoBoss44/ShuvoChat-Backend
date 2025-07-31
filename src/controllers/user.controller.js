const jwt = require('jsonwebtoken');
const User = require("../schema/userSchema");
const bcrypt = require('bcryptjs');
const CustomError = require("../error/CustomError");
const { upsertStreamData } = require('../utils/stream');
const FriendRequest = require('../schema/friendRequestSchema');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

class userController {
    // register user
    static register = async (req, res, next) => {
        try {
            const { fullName, email, password } = req.body;

            // Validate input
            if (!fullName || !email || !password) {
                return next(new CustomError(400, 'All fields are required'));
            }

            // password validation
            if (password.length < 6) {
                return next(new CustomError(400, 'Password must be at least 6 characters long'));
            }
            // email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return next(new CustomError(400, 'Invalid email format'));
            }

            // Check if user already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return next(new CustomError(400, 'User already exists'));
            }

            // Create new user
            const newUser = new User({
                fullName,
                email,
                password
            });
            // creating jwt token
            const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '15d' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'none',
                maxAge: 15 * 24 * 60 * 60 * 1000 // 15 days
            });
            // upsert user data to stream
            const streamUser = await upsertStreamData(newUser);
            if (!streamUser) {
                return next(new CustomError(500, 'Error upserting user data to Stream'));
            }
            // Save user to database
            const userData = await newUser.save();

            res.status(201).json({ message: 'User registered successfully', userData });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // login 
    static login = async (req, res, next) => {
        try {
            const { email, password } = req.body;

            // Validate input
            if (!email || !password) {
                return next(new CustomError(400, "Email and password are required"));
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return next(new CustomError(400, "Invalid email format"));
            }

            // Check if user exists
            const user = await User.findOne({ email }).select("+password");
            if (!user) {
                return next(new CustomError(401, "Invalid email or password"));
            }

            // Check password
            const isMatch = await bcrypt.compare(String(password), user.password);
            if (!isMatch) {
                return next(new CustomError(401, "Invalid email or password"));
            }

            // Create JWT token
            const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
                expiresIn: "15d",
            });
            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "none",
                maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
            });

            // Upsert user data to Stream
            const streamUser = await upsertStreamData(user);
            if (!streamUser) {
                return next(new CustomError(500, "Error upserting user data to Stream"));
            }

            // Remove sensitive fields from response
            const { password: _, ...userData } = user.toObject();

            res.status(200).json({ message: "User logged in successfully", user: userData });
        } catch (error) {
            console.error("Login error:", error);
            return next(new CustomError(500, error.message || "Internal Server Error"));
        }
    };

    // logout
    static logout = async (req, res, next) => {
        try {
            res.clearCookie('token');
            res.status(200).json({ message: 'User logged out successfully' });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // update user profile
    static updateProfile = async (req, res, next) => {
        try {
            const { fullName, bio } = req.body;
            let profilePicture = req.body.profilePicture;

            // Handle file upload if present
            if (req.file) {
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: "image", folder: "shuvochat_profiles" },
                        (error, result) => {
                            if (error) reject(new CustomError(500, "Failed to upload image to Cloudinary"));
                            resolve(result);
                        }
                    );
                    stream.end(req.file.buffer);
                });
                profilePicture = result.secure_url;
            }

            // Build the update object dynamically
            const updateData = {};
            if (fullName !== undefined) updateData.fullName = fullName;
            if (bio !== undefined) updateData.bio = bio;
            if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

            if (Object.keys(updateData).length === 0) {
                return next(new CustomError(400, "At least one field must be provided to update"));
            }

            // Update user profile
            const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, {
                new: true,
            }).select("-password");

            if (!updatedUser) {
                return next(new CustomError(404, "User not found"));
            }

            // Upsert user data to Stream
            const streamUser = await upsertStreamData(updatedUser);
            if (!streamUser) {
                return next(new CustomError(500, "Error upserting user data to Stream"));
            }

            res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
        } catch (error) {
            console.error("Update profile error:", error);
            return next(new CustomError(500, error.message || "Internal Server Error"));
        }
    };

    // get user profile
    static getProfile = async (req, res, next) => {
        try {
            const userId = req.params.id || req.user._id;

            // Find user by ID
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

    // get me
    static getMe = async (req, res, next) => {
        try {
            // Return the authenticated user's profile
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

    // get recommended users
    static getRecommendedUsers = async (req, res, next) => {
        try {
            // Find users who are not the authenticated user or friends
            const users = await User.find({
                $and: [
                    { _id: { $ne: req.user._id } },
                    { friends: { $nin: [req.user._id] } }
                ]
            }).select('-password');

            if (!users || users.length === 0) {
                return next(new CustomError(404, 'No recommended users found'));
            }

            // Filter out users with pending friend requests
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

    // get my friends
    static getMyFriends = async (req, res, next) => {
        try {
            // Find user's friends
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

    // send friend request
    static sendFriendRequest = async (req, res, next) => {
        try {
            const { id: recipientId } = req.params;

            // Validate input
            if (!recipientId) {
                return next(new CustomError(400, 'Recipient ID is required'));
            }

            // Check if the recipient exists
            const recipient = await User.findById(recipientId);
            if (!recipient) {
                return next(new CustomError(404, 'Recipient not found'));
            }

            // Check if the friend request already exists
            const existingRequest = await FriendRequest.findOne({
                $or: [
                    { sender: req.user._id, recipient: recipientId, status: 'pending' },
                    { sender: recipientId, recipient: req.user._id, status: 'pending' }
                ]
            });
            if (existingRequest) {
                return next(new CustomError(400, 'Friend request already exists'));
            }

            // Check if users are already friends
            const user = await User.findById(req.user._id);
            if (user.friends.includes(recipientId)) {
                return next(new CustomError(400, 'User is already a friend'));
            }

            // Create a new friend request
            const friendRequest = new FriendRequest({
                sender: req.user._id,
                recipient: recipientId,
                status: 'pending'
            });

            await friendRequest.save();

            res.status(201).json({ message: 'Friend request sent successfully', friendRequest });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // cancel friend request
    static cancelFriendRequest = async (req, res, next) => {
        try {
            const { id: requestId } = req.params;

            // Validate input
            if (!requestId) {
                return next(new CustomError(400, 'Request ID is required'));
            }

            // Find the friend request
            const friendRequest = await FriendRequest.findById(requestId);
            if (!friendRequest) {
                return next(new CustomError(404, 'Friend request not found'));
            }

            // Check if the authenticated user is the sender
            if (friendRequest.sender.toString() !== req.user._id.toString()) {
                return next(new CustomError(403, 'You are not authorized to cancel this request'));
            }

            // Delete the friend request
            await FriendRequest.findByIdAndDelete(requestId);

            res.status(200).json({ message: 'Friend request cancelled successfully' });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // accept friend request
    static acceptFriendRequest = async (req, res, next) => {
        try {
            const { id: requestId } = req.params;

            // Validate input
            if (!requestId) {
                return next(new CustomError(400, 'Request ID is required'));
            }

            // Find the friend request
            const friendRequest = await FriendRequest.findById(requestId).populate('sender', 'fullName profilePicture');
            if (!friendRequest) {
                return next(new CustomError(404, 'Friend request not found'));
            }

            // Check if the authenticated user is the recipient
            if (friendRequest.recipient.toString() !== req.user._id.toString()) {
                return next(new CustomError(403, 'You are not authorized to accept this request'));
            }

            // Add each user to the other's friends list
            await User.findByIdAndUpdate(req.user._id, { $addToSet: { friends: friendRequest.sender._id } });
            await User.findByIdAndUpdate(friendRequest.sender._id, { $addToSet: { friends: req.user._id } });

            // Delete the friend request
            await FriendRequest.findByIdAndDelete(requestId);

            res.status(200).json({ message: 'Friend request accepted successfully', friend: friendRequest.sender });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // reject friend request
    static rejectFriendRequest = async (req, res, next) => {
        try {
            const { id: requestId } = req.params;

            // Validate input
            if (!requestId) {
                return next(new CustomError(400, 'Request ID is required'));
            }

            // Find the friend request
            const friendRequest = await FriendRequest.findById(requestId).populate('sender', 'fullName profilePicture');
            if (!friendRequest) {
                return next(new CustomError(404, 'Friend request not found'));
            }

            // Check if the authenticated user is the recipient
            if (friendRequest.recipient.toString() !== req.user._id.toString()) {
                return next(new CustomError(403, 'You are not authorized to reject this request'));
            }

            // Delete the friend request
            await FriendRequest.findByIdAndDelete(requestId);

            res.status(200).json({ message: 'Friend request rejected successfully', sender: friendRequest.sender });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // get all friend requests
    static getFriendRequests = async (req, res, next) => {
        try {
            // Find all friend requests where the authenticated user is the recipient
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

    // get outgoing friend requests
    static getOutgoingFriendRequests = async (req, res, next) => {
        try {
            const outgoingRequests = await FriendRequest.find({ sender: req.user._id, status: 'pending' })
                .populate("recipient", "fullName profilePicture")
                .select('-__v');
            res.status(200).json({ message: 'Outgoing friend requests retrieved successfully', outgoingRequests });
        } catch (error) {
            console.log(error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }
}

module.exports = userController;