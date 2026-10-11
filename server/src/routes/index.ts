import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { profileRouter } from './profile.routes';
import { preferenceRouter } from './preference.routes';
import { searchRouter } from './search.routes';
import { shortlistRouter } from './shortlist.routes';
import { interestRouter } from './interest.routes';
import { chatRouter } from './chat.routes';
import { membershipRouter } from './membership.routes';

export const apiV1Router = Router();

apiV1Router.use('/health', healthRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/profiles', profileRouter);
apiV1Router.use('/preferences', preferenceRouter);
apiV1Router.use('/search', searchRouter);
apiV1Router.use('/shortlists', shortlistRouter);
apiV1Router.use('/interests', interestRouter);
apiV1Router.use('/conversations', chatRouter);
apiV1Router.use('/membership', membershipRouter);
