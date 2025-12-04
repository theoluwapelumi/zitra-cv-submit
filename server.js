const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['POST', 'GET'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many submissions, please try again later.'
});

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
        }
    }
});

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Verify email configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Email configuration error:', error);
    } else {
        console.log('Email server is ready');
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Resume submission endpoint
app.post('/api/submit-resume', limiter, upload.single('resume'), async (req, res) => {
    try {
        const { surname, firstName, email, phone, position, linkedin } = req.body;
        const resume = req.file;

        // Validate required fields
        if (!surname || !firstName || !email || !phone || !position || !resume) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be filled'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Prepare email HTML
        const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #0f766e; }
          .value { color: #555; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Resume Submission</h1>
          </div>
          <div class="content">
            <div class="field">
              <span class="label">Name:</span>
              <span class="value">${firstName} ${surname}</span>
            </div>
            <div class="field">
              <span class="label">Email:</span>
              <span class="value">${email}</span>
            </div>
            <div class="field">
              <span class="label">Phone:</span>
              <span class="value">${phone}</span>
            </div>
            <div class="field">
              <span class="label">Position:</span>
              <span class="value">${position}</span>
            </div>
            <div class="field">
              <span class="label">LinkedIn:</span>
              <span class="value">${linkedin || 'Not provided'}</span>
            </div>
            <div class="field">
              <span class="label">Resume:</span>
              <span class="value">${resume.originalname} (${(resume.size / 1024).toFixed(2)} KB)</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

        // Email options
        const mailOptions = {
            from: `"Zitra Careers" <${process.env.EMAIL_USER}>`,
            to: 'zitrainvestments20@gmail.com',
            replyTo: email,
            subject: `New Resume Submission: ${firstName} ${surname} - ${position}`,
            html: emailHTML,
            attachments: [
                {
                    filename: resume.originalname,
                    content: resume.buffer,
                    contentType: resume.mimetype
                }
            ]
        };

        // Send email
        await transporter.sendMail(mailOptions);

        // Send confirmation email to applicant
        const confirmationMailOptions = {
            from: `"Zitra Careers" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Application Received - Zitra',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Thank You for Your Application!</h1>
            </div>
            <div class="content">
              <p>Hello ${firstName},</p>
              <p>We have successfully received your application for the <strong>${position}</strong> position. Our team will review your qualifications and get back to you soon. If you are yet to download the Zitra Ease app, please do that now - https://zitra.to/app</p>
              <p>If you have any questions, feel free to reach out to us.</p>
              <p>Best regards,<br>The Zitra Team</p>
            </div>
          </div>
        </body>
        </html>
      `
        };

        await transporter.sendMail(confirmationMailOptions);

        res.status(200).json({
            success: true,
            message: 'Resume submitted successfully'
        });

    } catch (error) {
        console.error('Error processing resume submission:', error);

        if (error instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                message: 'File upload error: ' + error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to submit resume. Please try again.'
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Export for Vercel
module.exports = app;