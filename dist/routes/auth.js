"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const multer_1 = __importDefault(require("multer"));
const node_fs_1 = __importDefault(require("node:fs"));
const User_1 = require("../models/User");
const validators_1 = require("../utils/validators");
const tokens_1 = require("../utils/tokens");
const auth_1 = require("../middleware/auth");
const paths_1 = require("../config/paths");
const env_1 = require("../config/env");
const cloudinary_1 = require("../config/cloudinary");
const router = (0, express_1.Router)();
if (!node_fs_1.default.existsSync(paths_1.uploadDir))
    node_fs_1.default.mkdirSync(paths_1.uploadDir, { recursive: true });
const upload = (0, multer_1.default)({
    storage: env_1.env.useCloudinary
        ? multer_1.default.memoryStorage()
        : multer_1.default.diskStorage({
            destination: (_req, _file, cb) => cb(null, paths_1.uploadDir),
            filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
        }),
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
            return;
        }
        cb(new Error('Only image uploads are allowed'));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});
const refreshCookieOptions = {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/api/v1/auth',
};
router.post('/register', async (req, res) => {
    const parsed = validators_1.registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: 'Invalid payload', errors: parsed.error.issues });
    }
    const { firstName, lastName, email, password, confirmPassword } = parsed.data;
    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }
    const existing = await User_1.UserModel.findOne({ email });
    if (existing) {
        return res.status(409).json({ message: 'Email already exists' });
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const user = await User_1.UserModel.create({
        firstName,
        lastName,
        email,
        passwordHash,
    });
    return res.status(201).json({
        message: 'Registered',
        user: {
            id: String(user._id),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
        },
    });
});
router.post('/login', async (req, res) => {
    const parsed = validators_1.loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: 'Invalid payload', errors: parsed.error.issues });
    }
    const { email, password } = parsed.data;
    const user = await User_1.UserModel.findOne({ email });
    if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
    const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!ok) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
    const accessToken = (0, tokens_1.signAccessToken)(String(user._id));
    const refreshToken = (0, tokens_1.signRefreshToken)(String(user._id));
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    return res.json({
        accessToken,
        user: {
            id: String(user._id),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
        },
    });
});
router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token missing' });
    }
    try {
        const payload = (0, tokens_1.verifyRefreshToken)(refreshToken);
        const accessToken = (0, tokens_1.signAccessToken)(payload.userId);
        const newRefreshToken = (0, tokens_1.signRefreshToken)(payload.userId);
        res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);
        return res.json({ accessToken });
    }
    catch {
        return res.status(401).json({ message: 'Invalid refresh token' });
    }
});
router.post('/logout', (_req, res) => {
    res.clearCookie('refreshToken', refreshCookieOptions);
    return res.json({ message: 'Logged out' });
});
router.get('/me', auth_1.requireAuth, async (req, res) => {
    const user = await User_1.UserModel.findById(req.userId).select('firstName lastName email profileImageUrl');
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    return res.json({
        user: {
            id: String(user._id),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
        },
    });
});
router.patch('/profile', auth_1.requireAuth, async (req, res) => {
    const parsed = validators_1.updateProfileSchema.safeParse({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
    });
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: 'Invalid payload', errors: parsed.error.issues });
    }
    const updatePayload = {};
    if (typeof parsed.data.firstName !== 'undefined') {
        updatePayload.firstName = parsed.data.firstName;
    }
    if (typeof parsed.data.lastName !== 'undefined') {
        updatePayload.lastName = parsed.data.lastName;
    }
    const user = await User_1.UserModel.findByIdAndUpdate(req.userId, updatePayload, {
        new: true,
    }).select('firstName lastName email profileImageUrl');
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    return res.json({
        message: 'Profile updated',
        user: {
            id: String(user._id),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
        },
    });
});
router.patch('/profile-image', auth_1.requireAuth, upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Profile image is required' });
    }
    let imageUrl;
    if (env_1.env.useCloudinary) {
        if (!req.file.buffer) {
            return res.status(500).json({ message: 'Failed to process image' });
        }
        imageUrl = await (0, cloudinary_1.uploadImageBufferToCloudinary)(req.file.buffer);
    }
    else {
        imageUrl = `/uploads/${req.file.filename}`;
    }
    const user = await User_1.UserModel.findByIdAndUpdate(req.userId, { profileImageUrl: imageUrl }, { new: true }).select('firstName lastName email profileImageUrl');
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    return res.json({
        message: 'Profile image updated',
        user: {
            id: String(user._id),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
        },
    });
});
router.delete('/profile-image', auth_1.requireAuth, async (req, res) => {
    const user = await User_1.UserModel.findByIdAndUpdate(req.userId, { profileImageUrl: null }, { new: true }).select('firstName lastName email profileImageUrl');
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    return res.json({
        message: 'Profile image removed',
        user: {
            id: String(user._id),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
        },
    });
});
exports.default = router;
