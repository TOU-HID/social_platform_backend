"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("./config/env");
const paths_1 = require("./config/paths");
const auth_1 = __importDefault(require("./routes/auth"));
const posts_1 = __importDefault(require("./routes/posts"));
const comments_1 = __importDefault(require("./routes/comments"));
const reactions_1 = __importDefault(require("./routes/reactions"));
const error_1 = require("./middleware/error");
exports.app = (0, express_1.default)();
const normalizeOrigin = (value) => {
    try {
        return new URL(value.trim()).origin;
    }
    catch {
        return value.trim().replace(/\/+$/, '');
    }
};
const allowedOrigin = normalizeOrigin(env_1.env.clientOrigin);
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }
        if (normalizeOrigin(origin) === allowedOrigin) {
            callback(null, true);
            return;
        }
        callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 204,
}));
exports.app.use(express_1.default.json({ limit: '2mb' }));
exports.app.use((0, cookie_parser_1.default)());
exports.app.use((0, morgan_1.default)('dev'));
exports.app.use('/api/v1/auth', (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 200,
}));
exports.app.use('/uploads', express_1.default.static(paths_1.uploadDir));
exports.app.get('/', (req, res) => {
    res.send('Server is running 🚀');
});
exports.app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok' });
});
exports.app.use('/api/v1/auth', auth_1.default);
exports.app.use('/api/v1/posts', posts_1.default);
exports.app.use('/api/v1', comments_1.default);
exports.app.use('/api/v1/reactions', reactions_1.default);
exports.app.use(error_1.notFound);
exports.app.use(error_1.errorHandler);
