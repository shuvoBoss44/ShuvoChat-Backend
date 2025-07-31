const User = require('../schema/userSchema');
const jwt = require('jsonwebtoken');
const CustomError = require("../error/CustomError")

const authentication = async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return next(new CustomError(401, 'Unauthorized: No token provided'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded || !decoded.userId) {
            return next(new CustomError(401, 'Unauthorized: Invalid token'));
        }
        const user = await User.findById(decoded.userId);
        if (!user) {
            return next(new CustomError(404, 'User not found'));
        }
        req.user = user;
        next();
    } catch (error) {
        return next(new CustomError(401, 'Unauthorized: Invalid token'));
    }
}

module.exports = authentication;