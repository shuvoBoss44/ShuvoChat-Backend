class CustomError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        // Ensure the error name is set for better debugging
        this.name = this.constructor.name;
        // Maintain proper stack trace (for non-V8 environments)
        Error.captureStackTrace?.(this, this.constructor);
    }
}

module.exports = CustomError;