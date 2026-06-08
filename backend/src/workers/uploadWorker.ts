import { Worker } from 'bullmq';
import { CampaignType } from '@prisma/client';
import { redisConnection } from './redisClient';
import { ContactExtractorService } from '../services/contactExtractorService';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import * as xlsx from 'xlsx';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export const uploadWorker = new Worker('uploadQueue', async job => {
  const { filePath, originalname, mimetype, campaignType = 'EMAIL' } = job.data;
  const ext = path.extname(originalname).toLowerCase();
  const normalizedCampaignType = (campaignType.toUpperCase() as CampaignType) || 'EMAIL';

  let rawContacts: any[] = [];
  let contacts: any[] = [];

  try {
    console.log(`[UploadWorker] Job ${job.id} started. Processing file: ${originalname} (${ext}) for campaign type: ${normalizedCampaignType}`);

    if (ext === '.csv') {
      console.log(`[UploadWorker] Parsing CSV file: ${filePath}`);
      await new Promise((resolve, reject) => {
        const rows: any[] = [];
        const stream = fs.createReadStream(filePath);
        stream
          .pipe(csv())
          .on('data', (data) => {
            rows.push(data);
          })
          .on('end', () => {
            stream.destroy();
            resolve(rows);
          })
          .on('error', (err) => {
            stream.destroy();
            reject(err);
          });
      }).then((rows: any) => {
        rawContacts = rows;
        contacts = ContactExtractorService.extractFromStructuredData(rows, normalizedCampaignType);
      });
      console.log(`[UploadWorker] Extracted ${contacts.length} ${normalizedCampaignType} contacts from CSV`);
    } else if (ext === '.xlsx' || ext === '.xls') {
      console.log(`[UploadWorker] Parsing Excel file: ${filePath}`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      const data = xlsx.utils.sheet_to_json(sheet, { defval: null });
      rawContacts = data;
      contacts = ContactExtractorService.extractFromStructuredData(data, normalizedCampaignType);

      // Fallback: if no contacts extracted, try unstructured text parsing
      if (contacts.length === 0) {
        console.log(`[UploadWorker] No contacts found with column detection, scanning as unstructured text`);
        const csvText = xlsx.utils.sheet_to_csv(sheet);
        contacts = ContactExtractorService.extractFromUnstructuredText(csvText, normalizedCampaignType);
      }

      console.log(`[UploadWorker] Extracted ${contacts.length} ${normalizedCampaignType} contacts from Excel`);
    } else if (ext === '.pdf') {
      console.log(`[UploadWorker] Extracting text from PDF: ${filePath}`);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await (pdfParse as any)(dataBuffer);
      const text = data.text;
      console.log(`[UploadWorker] Extracted text from PDF (${text.length} characters)`);

      contacts = ContactExtractorService.extractFromUnstructuredText(text, normalizedCampaignType);
      console.log(`[UploadWorker] Extracted ${contacts.length} ${normalizedCampaignType} contacts from PDF`);
    } else if (ext === '.docx') {
      console.log(`[UploadWorker] Extracting text from DOCX: ${filePath}`);
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;
      console.log(`[UploadWorker] Extracted text from DOCX (${text.length} characters)`);

      contacts = ContactExtractorService.extractFromUnstructuredText(text, normalizedCampaignType);
      console.log(`[UploadWorker] Extracted ${contacts.length} ${normalizedCampaignType} contacts from DOCX`);
    } else {
      // For any other file type, try to read as text
      console.log(`[UploadWorker] Attempting to read ${ext} as text`);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        contacts = ContactExtractorService.extractFromUnstructuredText(content, normalizedCampaignType);
        console.log(`[UploadWorker] Extracted ${contacts.length} ${normalizedCampaignType} contacts from ${ext}`);
      } catch (readError) {
        console.warn(`[UploadWorker] Could not read file as text: ${readError}`);
        contacts = [];
      }
    }

    console.log(`[UploadWorker] Job ${job.id} completed. Returning ${contacts.length} contacts.`);
    return { type: 'contacts', contacts };
  } catch (error) {
    console.error(`[UploadWorker] Error processing job ${job.id}:`, error);
    throw error;
  } finally {
    // Cleanup file with retry logic
    if (fs.existsSync(filePath)) {
      try {
        console.log(`[UploadWorker] Cleaning up temporary file: ${filePath}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        fs.unlinkSync(filePath);
      } catch (cleanupError: any) {
        if (cleanupError.code === 'EBUSY') {
          console.warn(`[UploadWorker] File still busy, retrying cleanup: ${filePath}`);
          try {
            await new Promise(resolve => setTimeout(resolve, 500));
            fs.unlinkSync(filePath);
          } catch (retryError) {
            console.warn(`[UploadWorker] Failed to cleanup file after retry ${filePath}:`, retryError);
          }
        } else {
          console.warn(`[UploadWorker] Failed to cleanup file ${filePath}:`, cleanupError);
        }
      }
    }
  }
}, { connection: redisConnection as any });

uploadWorker.on('completed', job => {
  console.log(`Upload job ${job.id} has completed!`);
});

uploadWorker.on('failed', (job, err) => {
  console.log(`Upload job ${job?.id} has failed with ${err.message}`);
});
