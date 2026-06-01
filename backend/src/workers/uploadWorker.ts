import { Worker } from 'bullmq';
import { redisConnection } from './redisClient';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import * as xlsx from 'xlsx';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const extractEmailsFromText = (text: string): string[] => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex) || [];
  return [...new Set(emails.map(e => e.toLowerCase()))];
};

const extractNameFromText = (text: string): string => {
  const nameRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;
  const match = text.match(nameRegex);
  return match ? match[1] : '';
};

const extractContactsFromText = (text: string): any[] => {
  const contacts = new Map();

  // Pattern 1: "Name (email@domain.com)" or "Name (email@domain.com, phone)"
  const nameEmailPhoneRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*\(\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:,\s*(\+?[0-9\s\-()]{10,}))?\s*\)/g;
  let match;
  while ((match = nameEmailPhoneRegex.exec(text)) !== null) {
    const [, name, email, whatsapp] = match;
    if (!contacts.has(email?.toLowerCase())) {
      contacts.set(email?.toLowerCase(), {
        fullName: name,
        email,
        whatsapp: whatsapp?.trim() || '',
      });
    }
  }

  // Pattern 2: "Name email@domain.com" (separated by space or newline)
  const nameEmailRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  while ((match = nameEmailRegex.exec(text)) !== null) {
    const [, name, email] = match;
    if (!contacts.has(email?.toLowerCase())) {
      contacts.set(email?.toLowerCase(), {
        fullName: name,
        email,
        whatsapp: '',
      });
    }
  }

  // Fallback: extract emails without names
  const emails = extractEmailsFromText(text);
  for (const email of emails) {
    if (!contacts.has(email?.toLowerCase())) {
      contacts.set(email?.toLowerCase(), {
        fullName: '',
        email,
        whatsapp: '',
      });
    }
  }

  return Array.from(contacts.values());
};

export const uploadWorker = new Worker('uploadQueue', async job => {
  const { filePath, originalname, mimetype } = job.data;
  const ext = path.extname(originalname).toLowerCase();

  let contacts: any[] = [];

  try {
    console.log(`[UploadWorker] Job ${job.id} started. Processing file: ${originalname} (${ext})`);

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
        // Extract email/name from CSV
        rows.forEach((row: any) => {
          const email = row.email || row.Email || row['E-mail'] || '';
          const name = row.name || row.Name || row.fullName || row.firstName || '';
          const whatsapp = row.whatsapp || row.phone || row.Phone || '';

          if (email && email.includes('@')) {
            if (!contacts.find(c => c.email?.toLowerCase() === email?.toLowerCase())) {
              contacts.push({
                fullName: name,
                email: email?.toLowerCase(),
                whatsapp,
              });
            }
          }
        });
      });
      console.log(`[UploadWorker] Extracted ${contacts.length} contacts from CSV`);
    } else if (ext === '.xlsx' || ext === '.xls') {
      console.log(`[UploadWorker] Parsing Excel file: ${filePath}`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Get raw 2D array (no header assumption)
      const data = xlsx.utils.sheet_to_json(sheet);

      // Extract email/name from each row
      data.forEach((row: any) => {
        const email = row.email || row.Email || row['E-mail'] || '';
        const name = row.name || row.Name || row.fullName || row.firstName || '';
        const whatsapp = row.whatsapp || row.phone || row.Phone || '';

        if (email && email.toString().includes('@')) {
          const emailStr = email.toString().toLowerCase().trim();
          if (!contacts.find(c => c.email?.toLowerCase() === emailStr)) {
            contacts.push({
              fullName: name || '',
              email: emailStr,
              whatsapp: whatsapp ? whatsapp.toString().trim() : '',
            });
          }
        }
      });

      // Fallback: if no headers matched, treat entire sheet as unstructured text
      if (contacts.length === 0) {
        console.log(`[UploadWorker] No headers found, scanning all cells for emails`);
        const csvText = xlsx.utils.sheet_to_csv(sheet);
        contacts = extractContactsFromText(csvText);
      }

      console.log(`[UploadWorker] Extracted ${contacts.length} contacts from Excel`);
    } else if (ext === '.pdf') {
      console.log(`[UploadWorker] Extracting text from PDF: ${filePath}`);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await (pdfParse as any)(dataBuffer);
      const text = data.text;
      console.log(`[UploadWorker] Extracted text from PDF (${text.length} characters)`);

      contacts = extractContactsFromText(text);
      console.log(`[UploadWorker] Extracted ${contacts.length} contacts from PDF`);
    } else if (ext === '.docx') {
      console.log(`[UploadWorker] Extracting text from DOCX: ${filePath}`);
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;
      console.log(`[UploadWorker] Extracted text from DOCX (${text.length} characters)`);

      contacts = extractContactsFromText(text);
      console.log(`[UploadWorker] Extracted ${contacts.length} contacts from DOCX`);
    } else {
      // For any other file type, try to read as text
      console.log(`[UploadWorker] Attempting to read ${ext} as text`);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        contacts = extractContactsFromText(content);
        console.log(`[UploadWorker] Extracted ${contacts.length} contacts from ${ext}`);
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
