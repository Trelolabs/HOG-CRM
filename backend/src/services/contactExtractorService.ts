import { CampaignType } from '@prisma/client';

export interface Contact {
  fullName: string;
  email?: string;
  whatsapp?: string;
}

export class ContactExtractorService {
  private static readonly EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  private static readonly PHONE_REGEX = /^[\+]?[0-9\s\-()]{7,}$/;

  private static readonly EMAIL_KEYWORDS = new Set([
    'email', 'emailaddress', 'mailaddress', 'mail', 'emailaddress', 'e-mail'
  ]);

  private static readonly PHONE_KEYWORDS = new Set([
    'phone', 'mobile', 'mobilenumber', 'whatsapp', 'cell', 'tel', 'contact',
    'phonenumber', 'mobilenumber', 'phonenumber', 'phone number', 'mobile number',
    'cellphone', 'cellular', 'telephone'
  ]);

  private static readonly NAME_KEYWORDS = new Set([
    'name', 'fullname', 'full name', 'firstname', 'first name', 'lastname',
    'last name', 'customername', 'customer name', 'contactname', 'contact name',
    'personname', 'person name'
  ]);

  /**
   * Detect column types by matching header names against keyword sets (campaign-type aware)
   */
  static detectColumnsByHeaders(headers: string[], campaignType: CampaignType): Map<number, string> {
    const columnTypes = new Map<number, string>();

    console.log('[ContactExtractor] Raw headers:', headers);
    console.log('[ContactExtractor] Campaign type:', campaignType);

    headers.forEach((header, colIndex) => {
      const normalized = header
        .toLowerCase()
        .trim()
        .replace(/[\s\-_]/g, '');

      if (campaignType === 'EMAIL') {
        // For EMAIL: prioritize EMAIL, then NAME (ignore PHONE)
        if (this.EMAIL_KEYWORDS.has(normalized)) {
          columnTypes.set(colIndex, 'email');
          console.log(`[ContactExtractor] Col ${colIndex}: "${header}" → email (normalized: "${normalized}")`);
        } else if (this.NAME_KEYWORDS.has(normalized)) {
          columnTypes.set(colIndex, 'name');
          console.log(`[ContactExtractor] Col ${colIndex}: "${header}" → name (normalized: "${normalized}")`);
        } else {
          console.log(`[ContactExtractor] Col ${colIndex}: "${header}" → NO MATCH (normalized: "${normalized}")`);
        }
      } else if (campaignType === 'SMS') {
        console.log("Inside the SMS Campaign Detection")
        // For SMS: prioritize PHONE, then NAME (ignore EMAIL)
        if (this.PHONE_KEYWORDS.has(normalized)) {
          console.log("Inside the PHONE KEYWORDS Detection")
          columnTypes.set(colIndex, 'phone');
          console.log(`[ContactExtractor] Col ${colIndex}: "${header}" → phone (normalized: "${normalized}")`);
        } else if (this.NAME_KEYWORDS.has(normalized)) {
          columnTypes.set(colIndex, 'name');
          console.log(`[ContactExtractor] Col ${colIndex}: "${header}" → name (normalized: "${normalized}")`);
        } else {
          console.log(`[ContactExtractor] Col ${colIndex}: "${header}" → NO MATCH (normalized: "${normalized}")`);
        }
      }
    });

    return columnTypes;
  }

  /**
   * Extract contacts from structured data (CSV/Excel) with header-based column detection
   */
  static extractFromStructuredData(rows: any[], campaignType: CampaignType): Contact[] {
    if (rows.length === 0) return [];

    const headers = Object.keys(rows[0]);
    console.log('headers', headers);
    const columnTypes = this.detectColumnsByHeaders(headers, campaignType);

    console.log('columnTypes', columnTypes);
    console.log('campaignType', campaignType);

    const emailColIndex = Array.from(columnTypes.entries()).find(([_, type]) => type === 'email')?.[0];
    const phoneColIndex = Array.from(columnTypes.entries()).find(([_, type]) => type === 'phone')?.[0];
    const nameColIndex = Array.from(columnTypes.entries()).find(([_, type]) => type === 'name')?.[0];

    console.log('emailColIndex', emailColIndex);
    console.log('phoneColIndex', phoneColIndex);
    console.log('nameColIndex', nameColIndex);

    // Validate that required columns are present based on campaign type
    if (campaignType === 'EMAIL' && emailColIndex === undefined) {
      throw new Error(
        'No email column found. Please ensure your CSV/Excel file has a column header named "Email", "E-mail", or "Email Address".'
      );
    }
    if (campaignType === 'SMS' && phoneColIndex === undefined) {
      throw new Error(
        'No phone column found. Please ensure your CSV/Excel file has a column header named "Phone", "Mobile", "WhatsApp", "Mobile Number", or similar.'
      );
    }

    const contacts: Contact[] = [];
    const seen = new Set<string>();

    rows.forEach(row => {
      const values = Object.values(row);
      const email = emailColIndex !== undefined ? String(values[emailColIndex] || '').toLowerCase().trim() : '';
      const phone = phoneColIndex !== undefined ? String(values[phoneColIndex] || '').trim() : '';
      const name = nameColIndex !== undefined ? String(values[nameColIndex] || '').trim() : '';

      // For EMAIL campaigns: require email
      if (campaignType === 'EMAIL') {
        if (email && this.isEmail(email) && !seen.has(email)) {
          seen.add(email);
          contacts.push({
            fullName: name,
            email,
          });
        }
      }
      // For SMS campaigns: require phone
      else if (campaignType === 'SMS') {
        if (phone && this.isPhone(phone) && !seen.has(phone)) {
          seen.add(phone);
          contacts.push({
            fullName: name,
            whatsapp: phone,
          });
        }
      }
    });

    return contacts;
  }

  /**
   * Extract from unstructured text (PDF, DOCX, TXT) with pattern matching
   */
  static extractFromUnstructuredText(text: string, campaignType: CampaignType): Contact[] {
    const contacts: Contact[] = [];
    const seen = new Set<string>();

    console.log(text, campaignType);

    if (campaignType === 'EMAIL') {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      let match;
      while ((match = emailRegex.exec(text)) !== null) {
        const email = match[0].toLowerCase();
        if (!seen.has(email)) {
          seen.add(email);
          const name = this.extractNameNearby(text, match.index);
          contacts.push({
            fullName: name,
            email,
          });
        }
      }
    } else if (campaignType === 'SMS') {
      const phoneRegex = /(\+?[0-9\s\-()]{7,})/g;
      let match;
      while ((match = phoneRegex.exec(text)) !== null) {
        const phone = match[0].trim();
        if (this.isPhone(phone) && !seen.has(phone)) {
          seen.add(phone);
          const name = this.extractNameNearby(text, match.index);
          contacts.push({
            fullName: name,
            whatsapp: phone,
          });
        }
      }
    }

    return contacts;
  }

  /**
   * Check if a string is a valid email
   */
  private static isEmail(value: string): boolean {
    return this.EMAIL_REGEX.test(value);
  }

  /**
   * Check if a string is a valid phone number
   */
  private static isPhone(value: string): boolean {
    return this.PHONE_REGEX.test(value);
  }

  /**
   * Check if a string looks like a name (capitalized words)
   */
  private static isName(value: string): boolean {
    const nameRegex = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/;
    return nameRegex.test(value) && value.length > 2;
  }

  /**
   * Extract a name near the found contact info
   */
  private static extractNameNearby(text: string, index: number): string {
    const startIndex = Math.max(0, index - 100);
    const endIndex = Math.min(text.length, index + 100);
    const snippet = text.substring(startIndex, endIndex);

    const nameRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;
    const match = snippet.match(nameRegex);
    return match ? match[1] : '';
  }
}
