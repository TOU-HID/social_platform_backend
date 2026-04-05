import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'node:fs';
import { UserModel } from '../models/User';
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../utils/validators';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { uploadDir } from '../config/paths';
import { env } from '../config/env';
import { uploadImageBufferToCloudinary } from '../config/cloudinary';

const router = Router();
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: env.useCloudinary
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
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
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
};

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const { firstName, lastName, email, password, confirmPassword } = parsed.data;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  const existing = await UserModel.findOne({ email });
  if (existing) {
    return res.status(409).json({ message: 'Email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({
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
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const { email, password } = parsed.data;
  const user = await UserModel.findOne({ email });

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const accessToken = signAccessToken(String(user._id));
  const refreshToken = signRefreshToken(String(user._id));

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
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token missing' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken(payload.userId);
    const newRefreshToken = signRefreshToken(payload.userId);
    res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('refreshToken', refreshCookieOptions);
  return res.json({ message: 'Logged out' });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await UserModel.findById(req.userId).select(
    'firstName lastName email profileImageUrl',
  );
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

router.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  const parsed = updateProfileSchema.safeParse({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
  });

  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const updatePayload: { firstName?: string; lastName?: string } = {};
  if (typeof parsed.data.firstName !== 'undefined') {
    updatePayload.firstName = parsed.data.firstName;
  }
  if (typeof parsed.data.lastName !== 'undefined') {
    updatePayload.lastName = parsed.data.lastName;
  }

  const user = await UserModel.findByIdAndUpdate(req.userId, updatePayload, {
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

router.patch(
  '/profile-image',
  requireAuth,
  upload.single('image'),
  async (req: AuthRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Profile image is required' });
    }

    let imageUrl: string;
    if (env.useCloudinary) {
      if (!req.file.buffer) {
        return res.status(500).json({ message: 'Failed to process image' });
      }
      imageUrl = await uploadImageBufferToCloudinary(req.file.buffer);
    } else {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const user = await UserModel.findByIdAndUpdate(
      req.userId,
      { profileImageUrl: imageUrl },
      { new: true },
    ).select('firstName lastName email profileImageUrl');

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
  },
);

router.delete('/profile-image', requireAuth, async (req: AuthRequest, res) => {
  const user = await UserModel.findByIdAndUpdate(
    req.userId,
    { profileImageUrl: null },
    { new: true },
  ).select('firstName lastName email profileImageUrl');

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

export default router;
