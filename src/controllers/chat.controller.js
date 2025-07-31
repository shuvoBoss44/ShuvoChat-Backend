const { streamClient } = require('../utils/stream');
const CustomError = require('../error/CustomError');
const Group = require('../schema/groupSchema');
const User = require('../schema/userSchema');

class chatController {
    // Generate Stream token
    static async generateStreamToken(req, res, next) {
        try {
            const userId = req.user._id.toString();
            const token = streamClient.createToken(userId);
            return res.status(200).json({ token });
        } catch (error) {
            console.error('Error generating Stream token:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // Get all groups for the authenticated user
    static async getGroups(req, res, next) {
        try {
            const groups = await Group.find({ members: req.user._id })
                .populate('members', 'fullName profilePicture')
                .select('-__v');

            if (!groups || groups.length === 0) {
                return res.status(200).json({ message: 'No group chats found', groups: [] });
            }

            return res.status(200).json({ message: 'Group chats retrieved successfully', groups });
        } catch (error) {
            console.error('Error fetching groups:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    // Create a new group chat
    static async createGroup(req, res, next) {
        try {
            const { name, members } = req.body;

            // Validate input
            if (!name || !members || !Array.isArray(members) || members.length === 0) {
                return next(new CustomError(400, 'Group name and at least one member are required'));
            }

            // Ensure all members exist
            const validMembers = await User.find({ _id: { $in: members } }).select('_id');
            if (validMembers.length !== members.length) {
                return next(new CustomError(400, 'One or more member IDs are invalid'));
            }

            // Add authenticated user to members if not included
            if (!members.includes(req.user._id.toString())) {
                members.push(req.user._id.toString());
            }

            // Create group in MongoDB
            const group = new Group({
                name,
                members,
                createdBy: req.user._id,
            });
            await group.save();

            // Create Stream Chat channel
            const channel = streamClient.channel('messaging', group._id.toString(), {
                name,
                members: members.map(id => id.toString()),
                created_by_id: req.user._id.toString(),
            });
            await channel.create();

            // Populate members for response
            const populatedGroup = await Group.findById(group._id)
                .populate('members', 'fullName profilePicture')
                .select('-__v');

            return res.status(201).json({ message: 'Group created successfully', group: populatedGroup });
        } catch (error) {
            console.error('Error creating group:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }
}

module.exports = chatController;