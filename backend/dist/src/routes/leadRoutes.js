import { Router } from 'express';
import { createLead, getLeads, updateLead, deleteLead } from '../controllers/leadController';
import { authenticate } from '../middleware/auth';
const router = Router();
router.post('/', createLead); // Public
router.get('/', authenticate, getLeads);
router.patch('/:id', authenticate, updateLead);
router.delete('/:id', authenticate, deleteLead);
export default router;
