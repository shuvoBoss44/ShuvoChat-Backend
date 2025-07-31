const { streamClient } = require('../utils/stream');
class chatController {
    // generate stream token
    static async generateStreamToken(req, res) {
        try {
            const userId = req.user._id.toString();
            const token = streamClient.createToken(userId);
            return res.status(200).json({ token });
        } catch (error) {
            console.error('Error generating Stream token:', error);
            return res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}

module.exports = chatController;