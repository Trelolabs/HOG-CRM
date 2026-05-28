import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboardOverview } from '../controllers/dashboardController';
const router = Router();
router.use(authenticate);
router.get('/overview', getDashboardOverview);
export default router;
