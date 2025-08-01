require('dotenv').config();
const express = require('express');
const app = express();
const userRoutes = require('./src/routes/user.routes');
const chatRoutes = require('./src/routes/chat.routes');
const postRoutes = require('./src/routes/post.routes');
const db = require('./src/utils/db');
const CustomError = require('./src/error/CustomError');
const cors = require('cors');
const cookieParser = require('cookie-parser');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    cors({
        origin: process.env.Frontend_URL || 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    })
);
app.use(cookieParser());

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function () {
    console.log('Connected to the database');
});

app.use('/api/user', upload.single('profilePicture'), userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/posts', postRoutes);

app.use((err, req, res, next) => {
    console.error('Error name:', err.constructor.name, 'Error:', err);
    if (err instanceof CustomError) {
        return res.status(err.statusCode).json({ message: err.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`ShuvoMedia server is running on port ${process.env.PORT || 3000}`);
});