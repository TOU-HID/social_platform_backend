"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFound = void 0;
const notFound = (_req, res) => {
    res.status(404).json({ message: 'Route not found' });
};
exports.notFound = notFound;
const errorHandler = (error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
};
exports.errorHandler = errorHandler;
