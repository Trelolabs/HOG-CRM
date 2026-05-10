import { Router } from 'express';
import { createCampaign, getCampaigns, updateCampaign, sendCampaign } from '../controllers/campaignController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.patch('/:id', updateCampaign);
router.post('/:id/send', sendCampaign);

export default router;
