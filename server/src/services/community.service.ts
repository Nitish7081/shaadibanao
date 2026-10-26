import mongoose from 'mongoose';
import { CommunityPostModel, ICommunityPost } from '../models/community-post.model';
import { UserModel } from '../models/user.model';
import { AuditLogModel } from '../models/audit-log.model';

export interface CreatePostInput {
  userId: string;
  mediaUrl: string;
  publicId?: string;
  caption: string;
  category?: 'wedding_story' | 'culture' | 'festivals' | 'advice' | 'general';
}

export class CommunityService {
  /**
   * Create a new community post (enters pending moderation queue)
   */
  static async createPost(input: CreatePostInput) {
    const user = await UserModel.findById(input.userId);
    if (!user) throw new Error('User not found.');

    // Security check: Never allow identity documents / vault paths to be posted publicly
    if (
      input.mediaUrl.includes('secure-vault') ||
      input.mediaUrl.includes('/private/') ||
      input.mediaUrl.includes('/authenticated/') ||
      input.mediaUrl.toLowerCase().includes('aadhaar')
    ) {
      throw new Error('Identity documents and private records cannot be published to community feed.');
    }

    // Images must be stored as hosted URLs (Cloudinary secure_url), never as base64/data URIs in the DB
    if (!/^https?:\/\//i.test(input.mediaUrl) && !input.mediaUrl.startsWith('/media/')) {
      throw new Error('mediaUrl must be a hosted image URL. Upload the image first.');
    }

    const post = await CommunityPostModel.create({
      userId: user._id,
      authorName: user.displayName || 'Community Member',
      authorAvatar: user.avatarUrl,
      mediaUrl: input.mediaUrl,
      publicId: input.publicId,
      caption: input.caption.trim(),
      category: input.category || 'wedding_story',
      moderationStatus: 'pending', // Strictly pending admin review
      likes: [],
      reportsCount: 0,
    });

    return post;
  }

  /**
   * Public Feed: Approved posts only
   */
  static async getPublicFeed(currentUserId?: string, page = 1, limit = 20, category?: string) {
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState !== 1) {
      return {
        items: [
          {
            id: 'mock_post_1',
            userId: 'mock_user_1',
            authorName: 'Rohan & Ananya',
            authorAvatar: undefined,
            mediaUrl: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800',
            caption: 'Celebrating our wedding anniversary blessed through ShaadiBanao rituals!',
            category: 'wedding_story',
            moderationStatus: 'approved',
            likesCount: 12,
            isLikedByMe: false,
            reportsCount: 0,
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: { page, limit, totalCount: 1, totalPages: 1 },
      };
    }

    const query: any = { moderationStatus: 'approved' };
    if (category && category !== 'all') {
      query.category = category;
    }

    const [items, totalCount] = await Promise.all([
      CommunityPostModel.find(query).sort({ isPinned: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      CommunityPostModel.countDocuments(query),
    ]);

    return {
      items: items.map((p: any) => ({
        id: p._id.toString(),
        userId: p.userId.toString(),
        authorName: p.authorName,
        authorAvatar: p.authorAvatar,
        mediaUrl: p.mediaUrl,
        publicId: p.publicId,
        caption: p.caption,
        category: p.category,
        moderationStatus: p.moderationStatus,
        likesCount: p.likes?.length || 0,
        isLikedByMe: currentUserId ? (p.likes || []).some((uid: any) => uid.toString() === currentUserId) : false,
        reportsCount: p.reportsCount || 0,
        createdAt: p.createdAt?.toISOString(),
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Like / Unlike Post
   */
  static async toggleLikePost(postId: string, userId: string) {
    const post = await CommunityPostModel.findById(postId);
    if (!post) throw new Error('Post not found.');

    const userObjId = new mongoose.Types.ObjectId(userId);
    const existingIndex = post.likes.findIndex((uid: any) => uid.toString() === userId);

    let isLiked = false;
    if (existingIndex >= 0) {
      post.likes.splice(existingIndex, 1);
      isLiked = false;
    } else {
      post.likes.push(userObjId);
      isLiked = true;
    }

    await post.save();
    return { isLiked, likesCount: post.likes.length };
  }

  /**
   * Report Post for Abuse / Inappropriate Content
   */
  static async reportPost(postId: string, userId: string, reason: string) {
    const post = await CommunityPostModel.findById(postId);
    if (!post) throw new Error('Post not found.');

    post.reportsCount = (post.reportsCount || 0) + 1;
    // Auto-flag for re-moderation if reported multiple times
    if (post.reportsCount >= 3 && post.moderationStatus === 'approved') {
      post.moderationStatus = 'pending';
    }
    await post.save();

    return { success: true, message: 'Thank you for reporting. Our moderation team has been notified.' };
  }

  /**
   * Admin: List posts in moderation queue
   */
  static async listAdminPosts(page = 1, limit = 20, status = 'pending') {
    const skip = (page - 1) * limit;
    const query = status === 'all' ? {} : { moderationStatus: status };

    const [items, totalCount] = await Promise.all([
      CommunityPostModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CommunityPostModel.countDocuments(query),
    ]);

    return {
      items: items.map((p: any) => ({
        id: p._id.toString(),
        userId: p.userId.toString(),
        authorName: p.authorName,
        mediaUrl: p.mediaUrl,
        publicId: p.publicId,
        caption: p.caption,
        category: p.category,
        moderationStatus: p.moderationStatus,
        likesCount: p.likes?.length || 0,
        reportsCount: p.reportsCount || 0,
        createdAt: p.createdAt?.toISOString(),
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Admin: Moderate post (Approve or Reject)
   */
  static async moderatePost(postId: string, action: 'approve' | 'reject', adminId: string, reason?: string, ipAddress?: string) {
    if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
      throw new Error(`Invalid community post ID: "${postId}".`);
    }

    const post = await CommunityPostModel.findById(postId);
    if (!post) throw new Error('Community post not found in database.');

    post.moderationStatus = action === 'approve' ? 'approved' : 'rejected';
    if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
      post.moderatedBy = new mongoose.Types.ObjectId(adminId);
    } else {
      post.moderatedBy = adminId;
    }
    post.moderatedAt = new Date();
    if (reason) post.moderationReason = reason.trim();

    await post.save();

    await AuditLogModel.create({
      adminId,
      action: action === 'approve' ? 'APPROVE_COMMUNITY_POST' : 'REJECT_COMMUNITY_POST',
      targetUserId: post.userId.toString(),
      details: { postId: post._id.toString(), action, reason },
      ipAddress,
    });

    return {
      success: true,
      postId: post._id.toString(),
      moderationStatus: post.moderationStatus,
      moderatedAt: post.moderatedAt,
    };
  }
}
