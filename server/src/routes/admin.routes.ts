import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';

export const adminRouter = Router();

// 1. Admin Authentication (Hashed password check, issues admin JWT tokens)
adminRouter.post('/login', AdminController.login);

// All routes below strictly enforce requireAuth AND requireAdmin (Server-Side Role Protection)
adminRouter.use(requireAuth, requireAdmin);

// 2. Dashboard metrics & overview
adminRouter.get('/dashboard', AdminController.getDashboard);

// 3. Mandatory Registration Approvals Workflow
adminRouter.get('/approvals', AdminController.getApprovals);
adminRouter.post('/approvals/:id/approve', AdminController.approveUser);
adminRouter.post('/approvals/:id/reject', AdminController.rejectUser);
adminRouter.post('/approvals/:id/request-changes', AdminController.requestChanges);

// 4. User Accounts Management
adminRouter.get('/users', AdminController.getUsers);
adminRouter.patch('/users/:id/status', AdminController.updateUserStatus);
adminRouter.patch('/users/:id/role', AdminController.updateUserRole);

// 5. Profile Moderation & Photo Verification
adminRouter.get('/profiles', AdminController.getProfiles);
adminRouter.patch('/profiles/:id/verify', AdminController.verifyProfile);

// 6. Membership & Subscription Management
adminRouter.patch('/memberships/:userId', AdminController.updateMembership);

// 7. Safety & User Reports
adminRouter.get('/reports', AdminController.getReports);
adminRouter.patch('/reports/:id', AdminController.updateReport);

// 8. Administrative Audit Logs
adminRouter.get('/audit-logs', AdminController.getAuditLogs);

// 9. Pandit Management & Verification
adminRouter.get('/pandits', AdminController.getPandits);
adminRouter.post('/pandits/:id/verify', AdminController.verifyPandit);
adminRouter.post('/pandits/:id/reject', AdminController.rejectPandit);

// 10. Identity Verification & Photo Moderation
adminRouter.get('/verifications', AdminController.getVerifications);
adminRouter.post('/verifications/:id/approve', AdminController.approveVerification);
adminRouter.post('/verifications/:id/reject', AdminController.rejectVerification);
adminRouter.get('/verifications/:id/document-url', AdminController.getVerificationDocumentUrl);
adminRouter.get('/photos/pending', AdminController.getPendingPhotos);
adminRouter.post('/photos/:userId/moderate', AdminController.moderatePhoto);

// 11. Ceremony & Consultation Bookings
adminRouter.get('/bookings', AdminController.getBookings);
adminRouter.post('/bookings/:id/assign', AdminController.assignBookingPandit);
adminRouter.patch('/bookings/:id/status', AdminController.updateBookingStatus);

// 12. Community Posts Moderation
adminRouter.get('/community', AdminController.getCommunityPosts);
adminRouter.post('/community/:id/moderate', AdminController.moderateCommunityPost);

// 13. Public Matrimonial Banners & Cloudinary Image Uploads
adminRouter.post('/banners/upload', AdminController.uploadBanner);
adminRouter.get('/banners', AdminController.getBanners);
adminRouter.patch('/banners/:id', AdminController.updateBanner);
adminRouter.delete('/banners/:id', AdminController.deleteBanner);

