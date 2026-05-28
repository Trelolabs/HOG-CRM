"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leadController_1 = require("../controllers/leadController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/', leadController_1.createLead); // Public
router.get('/', auth_1.authenticate, leadController_1.getLeads);
router.patch('/:id', auth_1.authenticate, leadController_1.updateLead);
router.delete('/:id', auth_1.authenticate, leadController_1.deleteLead);
exports.default = router;
