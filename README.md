# Zitra Resume Backend API

Backend service for handling resume submissions for Zitra careers page.

## Features
- Resume file upload (PDF, DOC, DOCX)
- Email notifications with attachments
- Automatic confirmation emails to applicants
- Rate limiting for security
- Position/role selection

## Environment Variables Required
- EMAIL_USER: Gmail address for sending emails
- EMAIL_PASSWORD: Gmail app password
- FRONTEND_URL: Your frontend domain (optional)

## API Endpoints
- GET /api/health - Health check
- POST /api/submit-resume - Submit resume with applicant details

## Deployed on Vercel
Auto-deploys from main branch on GitHub.