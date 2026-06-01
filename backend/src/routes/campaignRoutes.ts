import { Router } from 'express';
import { createCampaign, getCampaigns, updateCampaign, sendCampaign, uploadFile, getUploadStatus, importContacts, sendToLeads } from '../controllers/campaignController';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('file'), uploadFile);
router.get('/upload/:jobId', getUploadStatus);
router.post('/import', importContacts);
router.post('/send-direct', sendToLeads);

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.patch('/:id', updateCampaign);
router.post('/:id/send', sendCampaign);

export default router;
