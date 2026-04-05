import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type AuthTokenPayload = { userId: string };

const accessExpiresIn =
  env.accessTokenExpiresIn as jwt.SignOptions['expiresIn'];
const refreshExpiresIn =
  env.refreshTokenExpiresIn as jwt.SignOptions['expiresIn'];

export const signAccessToken = (userId: string) =>
  jwt.sign({ userId }, env.accessTokenSecret, { expiresIn: accessExpiresIn });

export const signRefreshToken = (userId: string) =>
  jwt.sign({ userId }, env.refreshTokenSecret, { expiresIn: refreshExpiresIn });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.accessTokenSecret) as AuthTokenPayload;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.refreshTokenSecret) as AuthTokenPayload;
