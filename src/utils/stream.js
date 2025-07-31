require('dotenv').config();
const { StreamChat } = require('stream-chat');

const STREAM_API_KEY = process.env.STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_API_SECRET;

const streamClient = StreamChat.getInstance(STREAM_API_KEY, STREAM_API_SECRET);

const upsertStreamData = async (userData) => {
    try {
        const { _id, fullName, image } = userData;
        const user = await streamClient.upsertUser({
            id: _id.toString(),
            name: fullName,
            image
        });
        return user;
    } catch (error) {
        console.error('Error upserting Stream user:', error);
        throw error;
    }
}

module.exports = { upsertStreamData, streamClient };
