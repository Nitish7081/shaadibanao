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
adminRouter.get('/users/:id/details', AdminController.getUserDetails);
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

// 9. Pandit Management & Verification (10 Sections & Full Actions)
adminRouter.get('/pandits', AdminController.getPandits);
adminRouter.post('/pandits/:id/verify', AdminController.verifyPandit);
adminRouter.post('/pandits/:id/approve', AdminController.approvePandit);
adminRouter.post('/pandits/:id/reject', AdminController.rejectPandit);
adminRouter.post('/pandits/:id/request-docs', AdminController.requestPanditDocuments);
adminRouter.post('/pandits/:id/toggle-active', AdminController.togglePanditActive);
adminRouter.patch('/pandits/:id/toggle-active', AdminController.togglePanditActive);
adminRouter.post('/pandits/:id/suspend', AdminController.suspendPandit);
adminRouter.put('/pandits/:id', AdminController.updatePandit);

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

// 14. Help & Support Inquiries Management
adminRouter.get('/support/inquiries', AdminController.getSupportInquiries);
adminRouter.patch('/support/inquiries/:id/status', AdminController.updateSupportInquiryStatus);

// 15. Payments & Subscription Transactions
adminRouter.get('/payments', AdminController.getPaymentsList);

// 16. Services Catalog (Puja Services, Durations & Rates)
adminRouter.get('/services', AdminController.getServicesCatalog);
adminRouter.post('/services', AdminController.saveServiceCatalogItem);
adminRouter.delete('/services/:id', AdminController.deleteServiceCatalogItem);

// 17. Categories Management
adminRouter.get('/categories', AdminController.getCategories);

// 18. Notifications & Push Broadcasts
adminRouter.get('/notifications', AdminController.getAdminNotifications);
adminRouter.post('/notifications/broadcast', AdminController.sendBroadcastNotification);

// 19. System Settings & Contact Configuration
adminRouter.get('/system/settings', AdminController.getSystemSettings);
adminRouter.put('/system/settings', AdminController.updateSystemSettings);

// 20. Chat Administration & Abuse Moderation
adminRouter.get('/chat/conversations', AdminController.getChatConversations);
adminRouter.post('/chat/users/:userId/block-chat', AdminController.blockUserChat);

// 21. Pandit Withdrawals & Payouts Management
adminRouter.get('/withdrawals', AdminController.getWithdrawals);
adminRouter.post('/withdrawals/:id/approve', AdminController.approveWithdrawal);
adminRouter.post('/withdrawals/:id/reject', AdminController.rejectWithdrawal);

// 22. Automatic Error Monitoring
adminRouter.get('/errors', AdminController.getErrorLogs);
adminRouter.patch('/errors/:id/resolve', AdminController.resolveErrorLog);
adminRouter.post('/errors/:id/resolve', AdminController.resolveErrorLog);

// 23. Real-Time Database Monitoring
adminRouter.get('/database/monitoring', AdminController.getDatabaseMonitoring);
adminRouter.get('/database/stats', AdminController.getDatabaseMonitoring);

// 24. Audio & Video Calls Management
adminRouter.get('/calls', AdminController.getCalls);


