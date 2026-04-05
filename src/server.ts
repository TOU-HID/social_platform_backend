import { app } from './app';
import { connectDatabase } from './config/db';
import { env } from './config/env';

const start = async () => {
  await connectDatabase();
  app.listen(env.port, () => {
    console.log(`Backend running on http://localhost:${env.port}`);
  });
};

start().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});
