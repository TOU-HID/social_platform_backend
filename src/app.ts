import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { uploadDir } from './config/paths';
import authRoutes from './routes/auth';
import postRoutes from './routes/posts';
import commentRoutes from './routes/comments';
import reactionRoutes from './routes/reactions';
import { errorHandler, notFound } from './middleware/error';

export const app = express();

const normalizeOrigin = (value: string) => {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return value.trim().replace(/\/+$/, '');
  }
};

const allowedOrigin = normalizeOrigin(env.clientOrigin);

app.use(helmet());
app.use(
  cors({
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
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

app.use(
  '/api/v1/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
  }),
);

app.use('/uploads', express.static(uploadDir));

app.get('/', (req, res) => {
  res.send('Server is running 🚀');
});

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1', commentRoutes);
app.use('/api/v1/reactions', reactionRoutes);

app.use(notFound);
app.use(errorHandler);
