import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';

export const apiV1Router = Router();

apiV1Router.use('/health', healthRouter);
apiV1Router.use('/auth', authRouter);
