# Powershell script to commit all changes in 20 commits with meaningful messages
# Make sure to run this script from the root of the workspace (HOG-CRM)

Write-Host "Unstaging all current files to ensure clean commits..."
git reset

Write-Host "Commit 1: Root and Backend gitignore"
git add .gitignore frontend/.gitignore
git commit -m "chore: update .gitignore files"

Write-Host "Commit 2: Backend package and dependencies"
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): add dependencies for queues and workers"

Write-Host "Commit 3: Frontend package and dependencies"
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): update frontend dependencies"

Write-Host "Commit 4: Backend schema changes"
git add backend/prisma/schema.prisma
git commit -m "feat(backend): update prisma schema for campaigns"

Write-Host "Commit 5: Redis client worker"
git add backend/src/workers/redisClient.ts
git commit -m "feat(backend): add redis client configuration for background workers"

Write-Host "Commit 6: Email worker setup"
git add backend/src/workers/emailWorker.ts
git commit -m "feat(backend): add email worker for background processing"

Write-Host "Commit 7: Queues initialization"
git add backend/src/queues/index.ts
git commit -m "feat(backend): initialize job queues"

Write-Host "Commit 8: Upload middleware"
git add backend/src/middleware/upload.ts
git commit -m "feat(backend): add file upload middleware"

Write-Host "Commit 9: Upload worker"
git add backend/src/workers/uploadWorker.ts
git commit -m "feat(backend): implement background worker for processing uploads"

Write-Host "Commit 10: Campaign service updates"
git add backend/src/services/campaignService.ts
git commit -m "feat(backend): update campaign service to handle new logic"

Write-Host "Commit 11: Campaign controller updates"
git add backend/src/controllers/campaignController.ts
git commit -m "feat(backend): update campaign controller to support uploads and queues"

Write-Host "Commit 12: Campaign routes updates"
git add backend/src/routes/campaignRoutes.ts
git commit -m "feat(backend): update campaign routes endpoints"

Write-Host "Commit 13: Backend index/app setup"
git add backend/src/index.ts
git commit -m "feat(backend): update main app entry to initialize workers and queues"

Write-Host "Commit 14: Built backend files"
git add backend/dist/
git commit -m "chore(backend): update compiled dist files"

Write-Host "Commit 15: Frontend API client"
git add frontend/src/lib/server/crmApi.ts frontend/src/lib/types.ts
git commit -m "feat(frontend): update crm API client and types"

Write-Host "Commit 16: Frontend App Shell"
git add frontend/src/components/AppShell.tsx
git commit -m "feat(frontend): update AppShell navigation layout"

Write-Host "Commit 17: Upload Modals & Dropzone"
git add frontend/src/components/UploadDropzone.tsx frontend/src/components/UploadModal.tsx
git commit -m "feat(frontend): create file upload dropzone and modal components"

Write-Host "Commit 18: Data Mapper UI"
git add frontend/src/components/DataMapperUI.tsx
git commit -m "feat(frontend): add UI component for data mapping and preview"

Write-Host "Commit 19: Compose Modal"
git add frontend/src/components/ComposeModal.tsx
git commit -m "feat(frontend): add email composition modal component"

Write-Host "Commit 20: Campaigns Page and Sample Files"
git add frontend/src/app/(protected)/campaigns/page.tsx backend/uploads/1780245375487-leads-import-sample.csv "backend/uploads/1780249693793-Lead List - Outreach 1.xlsx"
git commit -m "feat(frontend): update campaigns page layout and add sample data"

Write-Host "Committing any remaining files..."
git add .
git commit -m "chore: commit any remaining files"

Write-Host "All done! 20 commits created successfully."
