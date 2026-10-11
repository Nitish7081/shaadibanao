import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { profileRouter } from './profile.routes';
import { preferenceRouter } from './preference.routes';

export const apiV1Router = Router();

apiV1Router.use('/health', healthRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/profiles', profileRouter);
apiV1Router.use('/preferences', preferenceRouter);
