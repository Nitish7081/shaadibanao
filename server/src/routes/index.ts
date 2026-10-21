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
import { adminRouter } from './admin.routes';
import { verificationRouter } from './verification.routes';
import { storageRouter } from './storage.routes';
import { astrologyRouter } from './astrology.routes';
import { panditRouter } from './pandit.routes';
import { bookingRouter } from './booking.routes';
import { consultationRouter } from './consultation.routes';
import { communityRouter } from './community.routes';

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
apiV1Router.use('/admin', adminRouter);
apiV1Router.use('/verification', verificationRouter);
apiV1Router.use('/storage', storageRouter);
apiV1Router.use('/astrology', astrologyRouter);
apiV1Router.use('/pandits', panditRouter);
apiV1Router.use('/bookings', bookingRouter);
apiV1Router.use('/consultations', consultationRouter);
apiV1Router.use('/community', communityRouter);

