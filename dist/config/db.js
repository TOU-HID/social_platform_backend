"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
let isConnected = false;
const connectDatabase = async () => {
    if (isConnected)
        return;
    await mongoose_1.default.connect(env_1.env.mongodbUri, {
        maxPoolSize: 50,
        minPoolSize: 10,
        maxIdleTimeMS: 300000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 10000,
    });
    isConnected = true;
};
exports.connectDatabase = connectDatabase;
