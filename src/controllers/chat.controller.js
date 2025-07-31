const User = require('../schema/userSchema');
const Group = require('../schema/groupSchema');
const CustomError = require('../error/CustomError');
const { getStreamClient } = require('../utils/stream');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

class chatController {
    static async getStreamToken(req, res, next) {
        try {
            const streamClient = getStreamClient();
            const token = streamClient.createToken(req.user._id.toString());
            return res.status(200).json({ token });
        } catch (error) {
            console.error('Error generating Stream token:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static async createGroup(req, res, next) {
        try {
            const { name, members } = req.body;
            let image;

            if (!name || !members || !Array.isArray(JSON.parse(members)) || JSON.parse(members).length === 0) {
                return next(new CustomError(400, 'Group name and at least one member are required'));
            }

            const parsedMembers = JSON.parse(members);

            const validMembers = await User.find({ _id: { $in: parsedMembers } }).select('_id');
            if (validMembers.length !== parsedMembers.length) {
                return next(new CustomError(400, 'One or more member IDs are invalid'));
            }

            if (!parsedMembers.includes(req.user._id.toString())) {
                parsedMembers.push(req.user._id.toString());
            }

            if (req.file) {
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: 'image', folder: 'shuvomedia_groups' },
                        (error, result) => {
                            if (error) {
                                console.error('Cloudinary upload error:', error);
                                reject(new CustomError(500, 'Failed to upload image to Cloudinary'));
                            }
                            resolve(result);
                        }
                    );
                    stream.end(req.file.buffer);
                });
                image = result.secure_url;
            }

            const group = new Group({
                name,
                image: image || 'https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-group-avatar-600nw-2264922221.jpg',
                members: parsedMembers,
                createdBy: req.user._id,
            });
            await group.save();

            const streamClient = getStreamClient();
            const channel = streamClient.channel('messaging', group._id.toString(), {
                name,
                members: parsedMembers.map(id => id.toString()),
                created_by_id: req.user._id.toString(),
            });
            await channel.create();

            const populatedGroup = await Group.findById(group._id)
                .populate('members', 'fullName profilePicture')
                .select('-__v');

            return res.status(201).json({ message: 'Group created successfully', group: populatedGroup });
        } catch (error) {
            console.error('Error creating group:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static async getGroups(req, res, next) {
        try {
            const groups = await Group.find({ members: req.user._id })
                .populate('members', 'fullName profilePicture')
                .select('-__v');

            return res.status(200).json({ message: 'Groups retrieved successfully', groups });
        } catch (error) {
            console.error('Error fetching groups:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }

    static async updateGroup(req, res, next) {
        try {
            const { groupId } = req.params;
            const { name } = req.body;
            let image;

            const group = await Group.findById(groupId);
            if (!group) {
                return next(new CustomError(404, 'Group not found'));
            }

            if (group.createdBy.toString() !== req.user._id.toString()) {
                return next(new CustomError(403, 'Only the group creator can update the group'));
            }

            if (req.file) {
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: 'image', folder: 'shuvomedia_groups' },
                        (error, result) => {
                            if (error) {
                                console.error('Cloudinary upload error:', error);
                                reject(new CustomError(500, 'Failed to upload image to Cloudinary'));
                            }
                            resolve(result);
                        }
                    );
                    stream.end(req.file.buffer);
                });
                image = result.secure_url;
            }

            const updateData = {};
            if (name) updateData.name = name;
            if (image) updateData.image = image;

            if (Object.keys(updateData).length === 0) {
                return next(new CustomError(400, 'At least one field must be provided to update'));
            }

            const updatedGroup = await Group.findByIdAndUpdate(groupId, updateData, {
                new: true,
            })
                .populate('members', 'fullName profilePicture')
                .select('-__v');

            const streamClient = getStreamClient();
            if (name) {
                const channel = streamClient.channel('messaging', groupId);
                await channel.update({ name });
            }

            res.status(200).json({ message: 'Group updated successfully', group: updatedGroup });
        } catch (error) {
            console.error('Error updating group:', error);
            return next(new CustomError(500, 'Internal Server Error'));
        }
    }
}

module.exports = chatController;