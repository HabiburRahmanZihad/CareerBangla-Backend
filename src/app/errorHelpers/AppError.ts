class AppError extends Error {
    public statusCode: number;
    public data?: any;

    constructor(statusCode: number, message: string, stack = '') {
        super(message) // Error("My Error Message")
        this.statusCode = statusCode;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor)
        }
    }

    public setData(data: any) {
        this.data = data;
        return this;
    }
}

export default AppError;