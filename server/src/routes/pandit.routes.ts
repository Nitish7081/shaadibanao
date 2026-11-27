import { Router, Request, Response, NextFunction } from 'express';
import { PanditService } from '../services/pandit.service';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';
import { ApiResponse } from '@bandhansetu/shared';

export const panditRouter = Router();

// GET /api/v1/pandits (Public/Member: List verified/approved pandits)
panditRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { ceremonyType, location, page, limit } = req.query;
    const result = await PanditService.listVerifiedPandits({
      ceremonyType: ceremonyType as string,
      location: location as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 12,
    });

    const response: ApiResponse = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pandits/astrologers (Public/Member: List approved astrologers)
panditRouter.get('/astrologers', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, search } = req.query;
    const result = await PanditService.listApprovedAstrologers({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 12,
      search: search as string,
    });

    const response: ApiResponse = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pandits/me (Pandit Owner View)
panditRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pandit = await PanditService.getPanditByUserId(userId);

    const response: ApiResponse = {
      success: true,
      data: pandit,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pandits/dashboard (Pandit Dashboard)
panditRouter.get('/dashboard', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const dashboard = await PanditService.getPanditDashboard(userId);

    const response: ApiResponse = {
      success: true,
      data: dashboard,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pandits/wallet (Pandit Wallet & Withdrawals)
panditRouter.get('/wallet', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const wallet = await PanditService.getPanditWallet(userId);

    const response: ApiResponse = {
      success: true,
      data: wallet,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/pandits/withdraw (Pandit requests payout)
panditRouter.post('/withdraw', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { amount, bankDetails } = req.body;
    const withdrawal = await PanditService.requestWithdrawal(userId, amount, bankDetails);

    const response: ApiResponse = {
      success: true,
      message: 'Withdrawal request submitted successfully.',
      data: withdrawal,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/pandits/me/availability (Pandit toggles Online / Offline & Communication availability)
panditRouter.patch(['/me/availability', '/availability'], requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const result = await PanditService.toggleAvailability(userId, req.body);

    const response: ApiResponse = {
      success: true,
      message: result.message,
      data: result,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/pandits/me/astrology-profile (Pandit updates astrology charges/expertise)
panditRouter.put('/me/astrology-profile', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const updated = await PanditService.updateAstrologyProfile(userId, req.body);

    const response: ApiResponse = {
      success: true,
      message: 'Astrology consultation profile updated.',
      data: updated,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pandits/:id/chat-eligibility (Check Free Intro & Paid Chat Entitlement)
panditRouter.get('/:id/chat-eligibility', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const data = await PanditService.getPanditChatEligibility(userId, req.params.id);
    const response: ApiResponse = {
      success: true,
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pandits/:id/whatsapp (Authorized WhatsApp contact reveal)
panditRouter.get('/:id/whatsapp', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const data = await PanditService.getAuthorizedWhatsapp(userId, req.params.id);
    const response: ApiResponse = {
      success: true,
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/pandits/:id/chat/order (Create Paid Personal Consultation Chat Order)
panditRouter.post('/:id/chat/order', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const data = await PanditService.createPanditChatOrder(userId, req.params.id);
    const response: ApiResponse = {
      success: true,
      data,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/pandits/:id/chat/verify (Verify Consultation Chat Payment)
panditRouter.post('/:id/chat/verify', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const data = await PanditService.verifyPanditChatPayment(userId, req.params.id, req.body);
    const response: ApiResponse = {
      success: true,
      message: 'Consultation chat access activated.',
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pandits/:id (Public/Member sanitized view of single Pandit)
panditRouter.get('/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const viewer = (req as any).user
      ? { userId: (req as any).user.id || (req as any).user.userId, role: (req as any).user.role }
      : undefined;
    const pandit = await PanditService.getPanditById(req.params.id, viewer);

    const response: ApiResponse = {
      success: true,
      data: pandit,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/pandits/register (User registers as Pandit)
panditRouter.post('/register', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pandit = await PanditService.registerPandit(userId, req.body);

    const response: ApiResponse = {
      success: true,
      message: 'पंडित पंजीकरण सफलतापूर्वक जमा किया गया (Pandit registration submitted successfully for administrative review).',
      data: pandit,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/pandits/profile (Pandit updates profile)
panditRouter.put('/profile', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const updated = await PanditService.updatePanditProfile(userId, req.body);

    const response: ApiResponse = {
      success: true,
      message: 'Pandit profile updated successfully.',
      data: updated,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});
