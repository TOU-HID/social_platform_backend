"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyAccessToken = exports.signRefreshToken = exports.signAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const accessExpiresIn = env_1.env.accessTokenExpiresIn;
const refreshExpiresIn = env_1.env.refreshTokenExpiresIn;
const signAccessToken = (userId) => jsonwebtoken_1.default.sign({ userId }, env_1.env.accessTokenSecret, { expiresIn: accessExpiresIn });
exports.signAccessToken = signAccessToken;
const signRefreshToken = (userId) => jsonwebtoken_1.default.sign({ userId }, env_1.env.refreshTokenSecret, { expiresIn: refreshExpiresIn });
exports.signRefreshToken = signRefreshToken;
const verifyAccessToken = (token) => jsonwebtoken_1.default.verify(token, env_1.env.accessTokenSecret);
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => jsonwebtoken_1.default.verify(token, env_1.env.refreshTokenSecret);
exports.verifyRefreshToken = verifyRefreshToken;
