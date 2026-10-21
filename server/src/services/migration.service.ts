import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';
import { AuditLogModel } from '../models/audit-log.model';

export class MigrationService {
  /**
   * Safe, idempotent migration for existing users
   * Ensures pre-existing active users are not locked out,
   * while logging an audit trail for full transparency.
   */
  public static async runApprovalsMigration(): Promise<{
    scanned: number;
    migrated: number;
    details: string;
  }> {
    if (mongoose.connection.readyState !== 1) {
      return { scanned: 0, migrated: 0, details: 'Database not connected, skipped migration' };
    }

    try {
      // Find all users without an explicit approvalStatus
      const unmigratedUsers = await UserModel.find({
        $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: null }],
      });

      if (unmigratedUsers.length === 0) {
        return { scanned: 0, migrated: 0, details: 'All users already have explicit approval status' };
      }

      console.log(`[Migration] Found ${unmigratedUsers.length} existing users requiring approvalStatus migration...`);

      let migratedCount = 0;

      for (const user of unmigratedUsers) {
        const isSuspended = user.status === 'suspended';
        const isAdmin = user.role === 'admin';

        // Pre-existing admins and active users are approved; suspended users retain pending/suspended state
        const assignedStatus = isSuspended ? 'pending' : 'approved';

        user.approvalStatus = assignedStatus;
        if (assignedStatus === 'approved') {
          user.approvedBy = 'system_migration';
          user.approvedAt = user.createdAt || new Date();
          user.moderationRemarks = 'Pre-existing account grandfathered under migration policy';
        } else {
          user.moderationRemarks = 'Suspended account held in pending moderation status';
        }

        await user.save();
        migratedCount++;

        // Record audit log for every migrated account
        try {
          await AuditLogModel.create({
            adminId: 'system_migration',
            adminEmail: 'system@shaadibanao.internal',
            adminName: 'Migration Automation',
            action: 'user_migrated',
            targetUserId: user._id,
            targetUserEmail: user.email,
            targetUserMobile: user.mobile,
            details: {
              previousApprovalStatus: null,
              newApprovalStatus: assignedStatus,
              reason: 'One-time legacy user migration to mandatory approval architecture',
            },
          });
        } catch {
          // Non-blocking audit error during batch migration
        }
      }

      const summary = `Successfully migrated ${migratedCount} existing users with explicit approvalStatus.`;
      console.log(`[Migration] ${summary}`);
      return { scanned: unmigratedUsers.length, migrated: migratedCount, details: summary };
    } catch (err: any) {
      console.error('[Migration Error] Failed to run approvals migration:', err.message);
      return { scanned: 0, migrated: 0, details: `Migration error: ${err.message}` };
    }
  }
}
