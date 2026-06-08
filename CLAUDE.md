# HOG CRM — Architecture & Developer Guide

## Project Overview

**HOG CRM** is a campaign management system for sending targeted emails and SMS to contact lists. It provides:
- A Next.js admin UI for managing contact segments and composing campaigns
- An Express.js backend API with Prisma ORM
- Asynchronous job processing (BullMQ + Redis) for file parsing, email, and SMS delivery
- Support for multiple email providers (Resend, SendGrid) and SMS via Twilio

**Use Case**: Upload CSV/Excel files with contact data → create segments → send email or SMS campaigns to selected contacts.

---

## Directory Structure

```
hog-crm/
├── backend/                          # Express API + Prisma + Workers
│   ├── src/
│   │   ├── app.ts                   # Express app factory, route mounting
│   │   ├── index.ts                 # Server entry, env validation, worker startup
│   │   ├── controllers/
│   │   │   ├── campaignController.ts    # Campaign CRUD, upload, import, send
│   │   │   ├── segmentController.ts     # Segment CRUD
│   │   │   ├── leadController.ts        # Lead CRUD
│   │   │   ├── dashboardController.ts
│   │   │   └── toolController.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts              # Basic HTTP auth
│   │   │   └── upload.ts            # Multer multipart file handling
│   │   ├── routes/
│   │   │   ├── campaignRoutes.ts
│   │   │   ├── segmentRoutes.ts
│   │   │   ├── leadRoutes.ts
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── campaignService.ts   # Campaign enqueueing logic
│   │   │   ├── contactExtractorService.ts # CSV/Excel/PDF/DOCX contact extraction
│   │   │   └── providers/
│   │   │       ├── sendgridProvider.ts
│   │   │       ├── twilioProvider.ts
│   │   │       └── types.ts
│   │   ├── queues/
│   │   │   └── index.ts             # BullMQ queue definitions
│   │   ├── workers/
│   │   │   ├── uploadWorker.ts      # File parsing → contact extraction
│   │   │   ├── emailWorker.ts       # Email delivery (Resend or SendGrid)
│   │   │   ├── smsWorker.ts         # SMS delivery (Twilio)
│   │   │   └── redisClient.ts       # Shared Redis connection
│   │   ├── utils/
│   │   │   └── prisma.ts            # Prisma singleton
│   │   └── middleware/
│   ├── prisma/
│   │   ├── schema.prisma            # Data models, migrations, enums
│   │   └── migrations/              # Prisma migrations
│   ├── dist/                        # Compiled JavaScript (generated)
│   ├── .env                         # Backend environment config
│   ├── package.json
│   ├── tsconfig.json
│   └── docker-compose.yml           # Local dev: Postgres + Redis
├── frontend/                         # Next.js 16 + React 19 app
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/                 # Next.js route handlers
│   │   │   │   ├── auth/            # Login/logout
│   │   │   │   └── [...slug]/       # Proxy to backend API
│   │   │   ├── (protected)/         # Auth-gated pages
│   │   │   │   ├── campaigns/       # Email/SMS campaign management
│   │   │   │   ├── leads/
│   │   │   │   ├── segments/
│   │   │   │   ├── dashboard/
│   │   │   │   └── tools/
│   │   │   ├── login/
│   │   │   ├── page.tsx             # Root redirect
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── CampaignManager.tsx  # Main email/SMS UI (tab-based)
│   │   │   ├── UploadModal.tsx      # CSV/Excel upload → contact extraction
│   │   │   ├── ComposeModal.tsx     # Email/SMS compose + send
│   │   │   ├── AppShell.tsx         # Layout + navigation
│   │   │   └── ui/                  # Reusable UI components
│   │   ├── lib/
│   │   │   ├── apiClient.ts         # HTTP client (fetch wrapper)
│   │   │   ├── server/crmApi.ts     # Server-side API helpers
│   │   │   └── types.ts             # TypeScript interfaces
│   │   └── ...
│   ├── public/
│   ├── .env.local / .env            # Frontend env config
│   ├── next.config.mjs
│   ├── tailwind.config.js (v4)
│   ├── postcss.config.mjs
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

---

## Tech Stack

### Backend
- **Framework**: Express.js 5.2.1
- **Database ORM**: Prisma 6.19.3 (PostgreSQL)
- **Job Queue**: BullMQ 5.77.6 (Redis-backed)
- **File Upload**: Multer 2.1.1
- **File Parsing**: xlsx, csv-parser, pdf-parse, mammoth (DOCX)
- **Email**: Resend 6.12.4, SendGrid 8.1.6
- **SMS**: Twilio 6.0.2
- **Auth**: HTTP Basic Auth
- **Testing**: Vitest, Supertest

### Frontend
- **Framework**: Next.js 16.2.6 (App Router)
- **UI Library**: React 19.2.4
- **Styling**: Tailwind CSS v4
- **State**: Plain React hooks (`useState`, `useCallback`, `useEffect`)
- **HTTP**: Fetch API (no React Query/SWR)
- **Notifications**: Sonner 2.0.7 (toast)
- **File Upload**: react-dropzone 15.0.0
- **Icons**: Lucide React 1.14.0

---

## Data Models

### Lead
Represents a contact (person to receive email or SMS).

```prisma
model Lead {
  id              String      @id @default(cuid())
  fullName        String
  email           String      @unique        // Unique constraint (used even for SMS)
  whatsapp        String      @default("")   // Phone number (for SMS)
  businessName    String?
  serviceInterest String?
  message         String?
  status          LeadStatus  @default(NEW)  // NEW | QUALIFIED | CONTACTED | CLOSED
  segmentId       String?
  segment         Segment?    @relation(fields: [segmentId], references: [id], onDelete: SetNull)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

enum LeadStatus {
  NEW
  QUALIFIED
  CONTACTED
  CLOSED
}
```

### Segment
A named group of contacts, filtered by campaign type (email-only, SMS-only, or both).

```prisma
model Segment {
  id            String              @id @default(cuid())
  name          String              @unique
  description   String?
  campaignType  SegmentCampaignType  // EMAIL | SMS | BOTH
  leads         Lead[]
  campaigns     Campaign[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}

enum SegmentCampaignType {
  EMAIL
  SMS
  BOTH
}
```

### Campaign
A composed email or SMS message, sent to a segment or manual list of leads.

```prisma
model Campaign {
  id                  String        @id @default(cuid())
  type                CampaignType  // EMAIL | SMS
  name                String
  subject             String?       // For EMAIL only
  content             String
  attachments         Json?         // For EMAIL only: [{ filename, content: base64 }]
  segmentId           String
  segment             Segment       @relation(fields: [segmentId], references: [id], onDelete: Cascade)
  status              CampaignStatus @default(DRAFT)  // DRAFT | SCHEDULED | SENT | FAILED
  attemptedRecipients Int           @default(0)
  sentRecipients      Int           @default(0)
  providerMessageId   String?
  failureReason       String?
  sentAt              DateTime?
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
}

enum CampaignType {
  EMAIL
  SMS
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  SENT
  FAILED
}
```

---

## API Routes

### Campaigns

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns` | List all campaigns (optional: filter by `status`, `segmentId`) |
| POST | `/api/campaigns` | Create a draft campaign |
| PATCH | `/api/campaigns/:id` | Update campaign (name, status, etc.) |
| POST | `/api/campaigns/:id/send` | Send campaign to its segment |
| POST | `/api/campaigns/send-direct` | Create campaign + send to selected leads immediately |
| POST | `/api/campaigns/upload` | Upload file (multipart) → enqueue parsing job |
| GET | `/api/campaigns/upload/:jobId` | Get upload job status |
| POST | `/api/campaigns/import` | Import extracted contacts → create segment + leads |

### Segments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/segments` | List segments (filter by `type=EMAIL\|SMS`) |
| POST | `/api/segments` | Create segment |
| PATCH | `/api/segments/:id` | Update segment |
| DELETE | `/api/segments/:id` | Delete segment |

### Leads

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leads` | List leads (filter by `segmentId`, pagination: `page`, `limit`, search by email/phone) |
| POST | `/api/leads` | Create a single lead (public endpoint, no auth) |
| PATCH | `/api/leads/:id` | Update lead status or segment |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Set session cookie |
| POST | `/api/auth/logout` | Clear session |

---

## Job Queues & Workers

### Upload Queue → uploadWorker.ts
Triggered when a file is uploaded.

**Job Data**: `{ filePath, originalname, mimetype, campaignType: 'EMAIL' | 'SMS' }`

**Process**:
1. Parse file by extension:
   - **CSV**: Stream + csv-parser
   - **Excel**: xlsx.readFile + sheet_to_json
   - **PDF**: pdf-parse to text
   - **DOCX**: mammoth to text
   - **TXT/Other**: Read as raw text
2. Call `ContactExtractorService.extractFromStructuredData()` or `extractFromUnstructuredText()`
3. Return `{ type: 'contacts', contacts: [...] }` where contacts are `{ fullName, email?, whatsapp? }`

**Contact Extraction** (header-based for structured files):
- **Headers First**: Normalizes column headers (lowercase, strip spaces/hyphens), matches against keyword sets:
  - Email keywords: `email`, `emailaddress`, `mail`, `e-mail`
  - Phone keywords: `phone`, `mobile`, `whatsapp`, `cell`, `tel`
  - Name keywords: `name`, `fullname`, `firstname`, `customer name`
- **Unstructured files**: Pure regex scan on text for email/phone + nearby names

### Email Queue → emailWorker.ts
Triggered by `campaignService.sendEmailCampaign()` or direct send.

**Job Data**: `{ to, subject, html, attachments?, campaignId, recipient }`

**Provider Logic**:
- If `CAMPAIGN_PROVIDER_MODE=live`:
  - Try Resend API (if `RESEND_API_KEY` set) → `EMAIL_FROM` sender
  - Fallback to SendGrid (if `SENDGRID_API_KEY` set) → `SENDGRID_FROM_EMAIL` sender
- If `CAMPAIGN_PROVIDER_MODE=mock`: Log message, don't send

**On Success**: Increment `Campaign.sentRecipients`, update lead status to `CONTACTED`

### SMS Queue → smsWorker.ts
Triggered by `campaignService.sendSmsCampaign()` or direct send.

**Job Data**: `{ to, body, campaignId, recipient }`

**Provider Logic**:
- If `CAMPAIGN_PROVIDER_MODE=live`: Use Twilio API (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SENDER_NUMBER`)
- If `CAMPAIGN_PROVIDER_MODE=mock`: Log message, don't send

**On Success**: Increment `Campaign.sentRecipients`, update lead status to `CONTACTED`

---

## Frontend Architecture

### Page Structure
- `/campaigns` → redirect to `/campaigns/email`
- `/campaigns/email` → `<CampaignManager type="EMAIL" />`
- `/campaigns/sms` → `<CampaignManager type="SMS" />`
- `/leads`, `/segments`, `/dashboard`, `/tools` → other management pages

### CampaignManager Component
**Props**: `type: 'EMAIL' | 'SMS'`

**State**:
- `activeTab`: `'contacts' | 'campaigns'`
- `segments`: Segment list
- `contacts`: Lead list for selected segment
- `selectedIds`: Set of checked contact IDs
- `campaigns`: Campaign history

**Two-Tab UI**:
1. **Contacts Tab**:
   - Left panel: List of segments with lead counts
   - Right panel: Contact table (selected segment)
   - Table columns: Checkbox | Email/Phone | Name | Status
   - Search filter (email for EMAIL, phone for SMS)
   - Select All checkbox
   - Add Email/Phone button
   - Send Campaign button (launches ComposeModal)

2. **Campaigns Tab**:
   - DataTable: Name | Type | Attempted | Sent | Status | Date

### UploadModal Component
**Props**: `open`, `onClose`, `onImported`, `campaignType`

**Three-Phase Flow**:
1. **Upload**: User drops file → `POST /api/campaigns/upload` → get `jobId`
2. **Poll**: `GET /api/campaigns/upload/{jobId}` every 2s until `state === 'completed'` (5min timeout)
3. **Import**: `POST /api/campaigns/import` with extracted contacts → segment creation → leads fetch

**On Success**: Call `onImported(leads, segmentName, segmentId)` → CampaignManager updates state

### ComposeModal Component
**Props**: `open`, `mode: 'EMAIL' | 'SMS'`, `recipientCount`, `onClose`, `onSend`

**Fields**:
- EMAIL: Subject input + body textarea + dropzone for attachments
- SMS: Body textarea only

**On Send**: Call `onSend(ComposeData)` with `{ subject, content, attachments }`

### API Proxy (`frontend/src/app/api/[...slug]/route.ts`)
All `/api/*` requests from the browser:
1. Check `hog_session` cookie (must be `'1'`)
2. Forward to backend at `CRM_API_BASE_URL` with HTTP Basic auth (`CRM_ADMIN_USERNAME:CRM_ADMIN_PASSWORD`)
3. Return backend response to client

**Exception**: `POST /api/leads` is public (no session required)

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection (Prisma) | ✓ Yes |
| `CRM_ADMIN_USERNAME` | Basic auth username | ✓ Yes |
| `CRM_ADMIN_PASSWORD` | Basic auth password | ✓ Yes |
| `PORT` | HTTP server port (default 4000) | No |
| `CORS_ORIGIN` | Comma-separated allowed origins | No |
| `CAMPAIGN_PROVIDER_MODE` | `mock` or `live` (controls email/SMS sending) | No |
| `REDIS_URL` | BullMQ Redis URL | ✓ Yes |
| `RESEND_API_KEY` | Resend email API key | No |
| `EMAIL_FROM` | Sender email (Resend) | No |
| `SENDGRID_API_KEY` | SendGrid API key | No |
| `SENDGRID_FROM_EMAIL` | Sender email (SendGrid) | No |
| `TWILIO_ACCOUNT_SID` | Twilio account ID | No |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | No |
| `TWILIO_SENDER_NUMBER` | Twilio outbound phone (e.g., `+1234567890`) | No |

### Frontend (`frontend/.env.local`)

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_CRM_API_BASE_URL` | Backend API URL (browser-side) | ✓ Yes |
| `CRM_ADMIN_USERNAME` | Basic auth username (server-side) | ✓ Yes |
| `CRM_ADMIN_PASSWORD` | Basic auth password (server-side) | ✓ Yes |
| `NEXT_PUBLIC_CRM_ADMIN_USERNAME` | Exposed to client (same as above) | No |
| `NEXT_PUBLIC_CRM_ADMIN_PASSWORD` | Exposed to client (same as above) | No |
| `ADMIN_APP_URL` | Self-reference URL (for redirects) | No |

---

## Architectural Constraints & Decisions

### 1. Lead.email is always @unique, even for SMS

SMS contacts have a synthetic email like `sms-1234567890@placeholder.invalid` to satisfy the DB constraint. This allows a single `Lead` table for both email and SMS without splitting into separate tables.

**Implication**: When importing SMS contacts, the dedup key is `whatsapp`, not `email`.

### 2. Header-First Contact Extraction (Structured Files)

For CSV/Excel files with headers, the extraction uses **header name matching** (not value sampling):
- Column headers are normalized (lowercase, strip spaces/hyphens)
- Matched against keyword sets: email, phone, name
- First match wins per field type
- No scoring or sampling of data values

This ensures accurate extraction for well-labeled spreadsheets (the expected case) without false positives from numeric ID columns.

### 3. No External State Management

Frontend uses plain React hooks (`useState`, `useCallback`) with no Redux, Zustand, or React Query. Data is refetched manually after mutations. Small app, simple approach.

### 4. Job Retry Logic

Email and SMS jobs have **3 retry attempts** with exponential backoff (3s initial delay). Failed jobs are logged but don't block the UI.

### 5. Async File Processing

File uploads are **non-blocking**:
- Frontend polls upload status every 2 seconds
- 5-minute timeout before toast error
- Users can close modal during processing; state cleanup via `isMountedRef`

---

## Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis 6+

### Setup

1. **Clone & install**:
   ```bash
   git clone <repo>
   cd hog-crm
   npm install --workspaces
   ```

2. **Backend setup**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with local DB, Redis, and API keys
   npx prisma migrate dev
   npm run dev
   ```

3. **Frontend setup**:
   ```bash
   cd frontend
   cp .env.example .env.local
   # Edit .env.local with CRM_API_BASE_URL=http://localhost:8080
   npm run dev
   # Open http://localhost:3000
   ```

4. **Or use Docker**:
   ```bash
   cd backend
   docker-compose up
   # Starts PostgreSQL + Redis in containers
   npm run dev
   ```

### Login
- Email: `admin`
- Password: (set in `CRM_ADMIN_PASSWORD`)
- Session cookie: `hog_session=1`

---

## Debugging

### Enable Verbose Logs
```bash
# Backend
DEBUG=crm:* npm run dev

# Frontend (Next.js)
npm run dev -- --debug
```

### Test API Directly
```bash
# Without auth (public)
curl -X POST http://localhost:8080/api/leads \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"John","email":"john@example.com","whatsapp":"+1234567890"}'

# With auth
curl -X GET http://localhost:8080/api/segments \
  -H 'Authorization: Basic admin:change-me'
```

### Run Tests
```bash
cd backend
npm test
```

---

## Known Issues & Future Improvements

1. **No pagination in contact table** — loads 1000 leads at a time (UI limit)
2. **No bulk contact export** — manual download only
3. **No campaign scheduling** — sends immediately
4. **No template system** — compose only
5. **No contact validation** — relies on file quality
6. **Email attachments** — stored inline in Campaign record (JSON), size limited by DB column

---

## Support

For issues or questions, check:
- Backend logs: `npm run dev` output
- Frontend console: Browser DevTools
- Database: `psql -d <DATABASE_URL>`
- Redis: `redis-cli` or `redis-commander` GUI
