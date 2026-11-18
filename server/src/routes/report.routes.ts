import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const reportRouter = Router();

// POST /api/v1/reports (File report & block)
reportRouter.post('/', requireAuth, ReportController.createReport);
