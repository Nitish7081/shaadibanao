import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/admin.service';
import { PanditService } from '../services/pandit.service';
import { VerificationService } from '../services/verification.service';
import { BookingService } from '../services/booking.service';
import { CommunityService } from '../services/community.service';
import { ApiResponse } from '@bandhansetu/shared';

export class AdminController {
  /**
   * POST /api/v1/admin/login
   */
  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { emailOrMobile, password } = req.body;
      const result = await AdminService.login(emailOrMobile, password);

      const response: ApiResponse = {
        success: true,
        message: 'Admin authentication successful',
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/dashboard
   */
  public static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await AdminService.getDashboardStats();
      const response: ApiResponse = {
        success: true,
        data: stats,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/users
   */
  public static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, role, status, approvalStatus, page, limit } = req.query;
      const data = await AdminService.getUsers({
        search: search as string,
        role: role as string,
        status: status as string,
        approvalStatus: approvalStatus as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      const response: ApiResponse = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/approvals
   */
  public static async getApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { approvalStatus, search, page, limit } = req.query;
      const data = await AdminService.getApprovals({
        approvalStatus: approvalStatus as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      const response: ApiResponse = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/approvals/:id/approve
   */
  public static async approveUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminUser = req.user;
      const user = await AdminService.approveUser(adminUser, id, req.ip);

      const response: ApiResponse = {
        success: true,
        message: 'User account successfully approved. Full matrimonial features unlocked.',
        data: { user },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/approvals/:id/reject
   */
  public static async rejectUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason, remarks } = req.body;
      const adminUser = req.user;
      const user = await AdminService.rejectUser(adminUser, id, reason, remarks, req.ip);

      const response: ApiResponse = {
        success: true,
        message: 'User registration rejected with feedback recorded.',
        data: { user },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/approvals/:id/request-changes
   */
  public static async requestChanges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { remarks } = req.body;
      const adminUser = req.user;
      const user = await AdminService.requestChanges(adminUser, id, remarks, req.ip);

      const response: ApiResponse = {
        success: true,
        message: 'Profile changes requested successfully.',
        data: { user },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/audit-logs
   */
  public static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, search, page, limit } = req.query;
      const data = await AdminService.getAuditLogs({
        action: action as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      const response: ApiResponse = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/users/:id/status
   */
  public static async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = await AdminService.updateUserStatus(id, status, req.user, req.ip);

      const response: ApiResponse = {
        success: true,
        message: `User status updated to ${status}`,
        data: { user },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/users/:id/role
   */
  public static async updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const user = await AdminService.updateUserRole(id, role, req.user, req.ip);

      const response: ApiResponse = {
        success: true,
        message: `User role updated to ${role}`,
        data: { user },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/profiles
   */
  public static async getProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { isVerified, gender, search, page, limit } = req.query;
      const data = await AdminService.getProfiles({
        isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
        gender: gender as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      const response: ApiResponse = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/profiles/:id/verify
   */
  public static async verifyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { isVerified, photoChecked } = req.body;
      const profile = await AdminService.verifyProfile(
        id,
        !!isVerified,
        photoChecked !== undefined ? !!photoChecked : true,
        req.user,
        req.ip
      );

      const response: ApiResponse = {
        success: true,
        message: `Profile verification updated to ${isVerified ? 'VERIFIED' : 'UNVERIFIED'}`,
        data: { profile },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/memberships/:userId
   */
  public static async updateMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { planId, durationDays } = req.body;
      const membership = await AdminService.updateUserMembership(
        userId,
        planId,
        durationDays,
        req.user,
        req.ip
      );

      const response: ApiResponse = {
        success: true,
        message: `User membership successfully updated to ${planId.toUpperCase()}`,
        data: { membership },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/reports
   */
  public static async getReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, page, limit } = req.query;
      const data = await AdminService.getReports({
        status: status as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      const response: ApiResponse = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/reports/:id
   */
  public static async updateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status, actionTaken } = req.body;
      const report = await AdminService.updateReportStatus(
        id,
        status,
        actionTaken,
        req.user,
        req.ip
      );

      const response: ApiResponse = {
        success: true,
        message: 'Report status updated successfully',
        data: { report },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/pandits
   */
  public static async getPandits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status } = req.query;
      const data = await PanditService.listAdminPandits(
        page ? Number(page) : 1,
        limit ? Number(limit) : 20,
        (status as string) || 'all'
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/pandits/:id/verify
   */
  public static async verifyPandit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.userId || (req as any).user?.id || 'admin';
      const result = await PanditService.verifyPandit(req.params.id, adminId, req.ip);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/pandits/:id/reject
   */
  public static async rejectPandit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.userId || (req as any).user?.id || 'admin';
      const { reason } = req.body;
      const result = await PanditService.rejectPandit(req.params.id, adminId, reason || 'Incomplete qualifications', req.ip);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/verifications
   */
  public static async getVerifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status } = req.query;
      const data = await VerificationService.listIdentityRequests(
        page ? Number(page) : 1,
        limit ? Number(limit) : 20,
        (status as string) || 'pending'
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/verifications/:id/approve
   */
  public static async approveVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.userId || (req as any).user?.id || 'admin';
      const result = await VerificationService.approveIdentity(req.params.id, adminId, req.ip);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/verifications/:id/document-url
   * Short-lived (10 min) signed URL for the private identity document. Audit-logged.
   */
  public static async getVerificationDocumentUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.userId || (req as any).user?.id || 'admin';
      const result = await VerificationService.getDocumentSignedUrl(req.params.id, adminId, req.ip);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/verifications/:id/reject
   */
  public static async rejectVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.userId || (req as any).user?.id || 'admin';
      const { reason } = req.body;
      const result = await VerificationService.rejectIdentity(req.params.id, adminId, reason, req.ip);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/photos/:userId/moderate
   */
  public static async moderatePhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.userId || (req as any).user?.id || 'admin';
      const { action, remarks } = req.body;
      const result = await VerificationService.moderateProfilePhoto(
        req.params.userId,
        action,
        adminId,
        remarks,
        req.ip
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/photos/pending
   */
  public static async getPendingPhotos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = req.query;
      const data = await VerificationService.listPendingPhotos(
        page ? Number(page) : 1,
        limit ? Number(limit) : 20
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/bookings
   */
  public static async getBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status } = req.query;
      const data = await BookingService.listAdminBookings(
        page ? Number(page) : 1,
        limit ? Number(limit) : 20,
        (status as string) || 'all'
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/community
   */
  public static async getCommunityPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status } = req.query;
      const data = await CommunityService.listAdminPosts(
        page ? Number(page) : 1,
        limit ? Number(limit) : 20,
        (status as string) || 'pending'
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/community/:id/moderate
   */
  public static async moderateCommunityPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).user?.userId || (req as any).user?.id || 'admin';
      const { action, reason } = req.body;

      if (!action || !['approve', 'reject'].includes(action)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ACTION', message: 'Action must be either "approve" or "reject".' },
        });
        return;
      }

      const result = await CommunityService.moderatePost(
        req.params.id,
        action,
        adminId,
        reason,
        req.ip
      );

      res.status(200).json({
        success: true,
        message: `Community post successfully ${action === 'approve' ? 'published' : 'rejected'}.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/banners/upload
   */
  public static async uploadBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUser = req.user;
      const { base64, title, linkUrl, priority } = req.body;
      const banner = await AdminService.uploadBanner(
        adminUser,
        { base64, title, linkUrl, priority: priority ? Number(priority) : 0 },
        req.ip
      );

      res.status(201).json({
        success: true,
        message: 'Matrimonial banner uploaded to Cloudinary and registered successfully.',
        data: banner,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/banners
   */
  public static async getBanners(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const banners = await AdminService.getBanners();
      res.status(200).json({ success: true, data: { items: banners, total: banners.length } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/banners/:id
   */
  public static async deleteBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUser = req.user;
      await AdminService.deleteBanner(req.params.id, adminUser, req.ip);
      res.status(200).json({ success: true, message: 'Banner removed successfully.' });
    } catch (error) {
      next(error);
    }
  }
}
