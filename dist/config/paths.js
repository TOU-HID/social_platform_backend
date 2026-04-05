"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDir = exports.appRootDir = void 0;
const node_path_1 = __importDefault(require("node:path"));
exports.appRootDir = node_path_1.default.resolve(__dirname, '..', '..');
exports.uploadDir = node_path_1.default.join(exports.appRootDir, 'uploads');
