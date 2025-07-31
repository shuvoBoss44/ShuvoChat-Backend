require("dotenv").config();
const express = require("express");
const app = express();
const userRoutes = require("./src/routes/user.routes");
const db = require("./src/utils/db");
const CustomError = require("./src/error/CustomError");
const chatRoutes = require("./src/routes/chat.routes");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/gif, image/jpg"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new CustomError(400, "Only JPEG, JPG, PNG, or GIF images are allowed"));
        }
    },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    cors({
        origin: process.env.Frontend_URL || "http://localhost:5173",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    })
);
app.use(cookieParser());

// DB connection
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", function () {
    console.log("Connected to the database");
});

// Routes
app.use("/api/user", upload.single("profilePicture"), userRoutes); // Apply multer to user routes
app.use("/api/chats", chatRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error("Error name:", err.constructor.name, "Error:", err);
    if (err instanceof CustomError) {
        return res.status(err.statusCode).json({ message: err.message });
    }
    res.status(500).json({ message: "Internal Server Error" });
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});