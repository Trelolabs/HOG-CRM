"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const toolController_1 = require("../controllers/toolController");
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: 'uploads/' });
router.use(auth_1.authenticate);
router.post('/import', upload.single('file'), toolController_1.importCSV);
router.get('/export', toolController_1.exportExcel);
exports.default = router;
