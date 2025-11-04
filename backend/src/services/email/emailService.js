// backend/src/services/email/emailService.js
// Email service for sending safety form reports to supervisors

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.provider = null;
        this.ready = false;
        this.initialize();
    }

    /**
     * Initialize email transporter based on available environment variables
     */
    initialize() {
        try {
            // Option 1: Gmail SMTP (recommended for quick setup)
            if (process.env.SMTP_USER && process.env.SMTP_PASS) {
                console.log('📧 Initializing email service with Gmail SMTP...');
                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS // App password, not regular password
                    }
                });
                this.provider = 'gmail';
                this.ready = true;
                console.log('✅ Email service ready (Gmail)');
            }
            // Option 2: SendGrid API
            else if (process.env.SENDGRID_API_KEY) {
                console.log('📧 Initializing email service with SendGrid...');
                this.transporter = nodemailer.createTransport({
                    host: 'smtp.sendgrid.net',
                    port: 587,
                    auth: {
                        user: 'apikey',
                        pass: process.env.SENDGRID_API_KEY
                    }
                });
                this.provider = 'sendgrid';
                this.ready = true;
                console.log('✅ Email service ready (SendGrid)');
            }
            // Option 3: Custom SMTP server
            else if (process.env.SMTP_HOST) {
                console.log('📧 Initializing email service with custom SMTP...');
                this.transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT || '587'),
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
                this.provider = 'custom-smtp';
                this.ready = true;
                console.log('✅ Email service ready (Custom SMTP)');
            }
            // Option 4: AWS SES
            else if (process.env.AWS_SES_REGION && process.env.AWS_ACCESS_KEY_ID) {
                console.log('📧 Initializing email service with AWS SES...');
                const aws = require('@aws-sdk/client-ses');
                const { defaultProvider } = require('@aws-sdk/credential-provider-node');
                
                const ses = new aws.SES({
                    region: process.env.AWS_SES_REGION,
                    credentials: defaultProvider()
                });
                
                this.transporter = nodemailer.createTransport({
                    SES: { ses, aws }
                });
                this.provider = 'aws-ses';
                this.ready = true;
                console.log('✅ Email service ready (AWS SES)');
            }
            else {
                console.warn('⚠️ Email service not configured. Set SMTP_USER and SMTP_PASS in .env');
                console.warn('   For Gmail: Use an App Password from https://myaccount.google.com/apppasswords');
                this.ready = false;
            }

            // Verify connection if configured
            if (this.ready && this.transporter) {
                this.transporter.verify((error, success) => {
                    if (error) {
                        console.error('❌ Email service verification failed:', error.message);
                        this.ready = false;
                    } else {
                        console.log('✅ Email service verified and ready to send emails');
                    }
                });
            }

        } catch (error) {
            console.error('❌ Failed to initialize email service:', error);
            this.ready = false;
        }
    }

    /**
     * Check if email service is ready
     */
    isReady() {
        return this.ready;
    }

    /**
     * Get current email provider
     */
    getProvider() {
        return this.provider;
    }

    /**
     * Generate HTML email content for safety report
     */
    generateReportEmail(supervisorName, report, userMessage) {
        const analysis = report.fullAnalysis;
        const riskColor = this.getRiskColor(report.fullAnalysis.riskAssessment?.level || 'UNKNOWN');
        const riskLevel = report.fullAnalysis.riskAssessment?.level || 'UNKNOWN';
        const riskScore = report.fullAnalysis.riskAssessment?.score || 0;

        // Count issues
        const safetyIssuesCount = analysis.safetyIssues?.length || 0;
        const complianceIssuesCount = analysis.complianceIssues?.length || 0;
        const ppeRequirementsCount = analysis.ppeRequirements?.length || 0;

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Safety Form Review Required</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, ${riskColor} 0%, ${this.darkenColor(riskColor)} 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .header .risk-badge {
            display: inline-block;
            margin-top: 10px;
            padding: 8px 16px;
            background-color: rgba(255,255,255,0.2);
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
        }
        .content {
            padding: 30px 20px;
        }
        .greeting {
            font-size: 16px;
            margin-bottom: 20px;
        }
        .alert-box {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .alert-box.critical {
            background-color: #f8d7da;
            border-left-color: #dc3545;
        }
        .alert-box.high {
            background-color: #ffe5cc;
            border-left-color: #fd7e14;
        }
        .section {
            margin: 25px 0;
        }
        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
        }
        .section-title .icon {
            margin-right: 8px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin: 15px 0;
        }
        .info-item {
            padding: 12px;
            background-color: #f8f9fa;
            border-radius: 6px;
            border-left: 3px solid #007bff;
        }
        .info-label {
            font-size: 12px;
            color: #6c757d;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .info-value {
            font-size: 16px;
            color: #2c3e50;
            font-weight: 600;
        }
        .issue-list {
            margin: 15px 0;
        }
        .issue-item {
            padding: 10px 15px;
            margin: 8px 0;
            background-color: #f8f9fa;
            border-left: 3px solid #dc3545;
            border-radius: 4px;
            font-size: 14px;
        }
        .issue-item.medium {
            border-left-color: #ffc107;
        }
        .issue-item.low {
            border-left-color: #28a745;
        }
        .summary {
            background-color: #e7f3ff;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .cta-button {
            display: inline-block;
            padding: 14px 28px;
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,123,255,0.3);
        }
        .footer {
            text-align: center;
            padding: 20px;
            background-color: #f8f9fa;
            color: #6c757d;
            font-size: 12px;
        }
        .user-message {
            background-color: #fff8e1;
            border-left: 4px solid #ffa000;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            font-style: italic;
        }
        @media only screen and (max-width: 600px) {
            .info-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🚨 Safety Form Review Required</h1>
            <div class="risk-badge">
                ${riskLevel} RISK • Score: ${riskScore}/10
            </div>
        </div>

        <!-- Content -->
        <div class="content">
            <div class="greeting">
                <strong>Dear ${supervisorName},</strong>
            </div>

            <p>
                A safety form has been processed and requires your review. The automated analysis 
                has identified ${safetyIssuesCount + complianceIssuesCount} issue(s) that need attention.
            </p>

            ${riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? `
            <div class="alert-box ${riskLevel.toLowerCase()}">
                <strong>⚠️ ${riskLevel} PRIORITY</strong><br>
                This form requires immediate supervisor review and action.
            </div>
            ` : ''}

            ${userMessage ? `
            <div class="user-message">
                <strong>📝 Additional Message:</strong><br>
                ${userMessage}
            </div>
            ` : ''}

            <!-- Form Details -->
            <div class="section">
                <div class="section-title">
                    <span class="icon">📋</span>
                    Form Details
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Form Type</div>
                        <div class="info-value">${report.formType || 'Unknown'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Submitted</div>
                        <div class="info-value">${new Date(report.timestamp).toLocaleString()}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Location</div>
                        <div class="info-value">${analysis.formDetails?.location || 'Not specified'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Activity</div>
                        <div class="info-value">${analysis.formDetails?.activity || 'Not specified'}</div>
                    </div>
                </div>
            </div>

            <!-- Risk Assessment -->
            <div class="section">
                <div class="section-title">
                    <span class="icon">⚠️</span>
                    Risk Assessment
                </div>
                <div class="summary">
                    <strong>Risk Score: ${riskScore}/10 (${riskLevel})</strong><br>
                    ${analysis.riskAssessment?.requiresSupervisorReview ? 
                        '🔴 Requires supervisor review' : 
                        '🟢 Standard process'
                    }<br>
                    ${analysis.riskAssessment?.workCanProceed ? 
                        '✅ Work can proceed with controls' : 
                        '🛑 Work should not proceed until issues resolved'
                    }
                </div>
            </div>

            <!-- Safety Issues -->
            ${safetyIssuesCount > 0 ? `
            <div class="section">
                <div class="section-title">
                    <span class="icon">🔍</span>
                    Safety Issues Found (${safetyIssuesCount})
                </div>
                <div class="issue-list">
                    ${analysis.safetyIssues.slice(0, 5).map(issue => `
                        <div class="issue-item ${(issue.severity || 'medium').toLowerCase()}">
                            <strong>${issue.hazard || issue.category || 'Safety Issue'}</strong>
                            ${issue.severity ? ` • <span style="text-transform: uppercase;">${issue.severity}</span>` : ''}
                        </div>
                    `).join('')}
                    ${analysis.safetyIssues.length > 5 ? `
                        <div style="text-align: center; margin-top: 10px; color: #6c757d; font-size: 13px;">
                            + ${analysis.safetyIssues.length - 5} more issues
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <!-- PPE Requirements -->
            ${ppeRequirementsCount > 0 ? `
            <div class="section">
                <div class="section-title">
                    <span class="icon">🦺</span>
                    PPE Requirements (${ppeRequirementsCount})
                </div>
                <div style="padding: 10px; background-color: #f8f9fa; border-radius: 6px;">
                    ${analysis.ppeRequirements.map(ppe => `
                        <div style="padding: 5px 0;">• ${ppe}</div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Compliance Issues -->
            ${complianceIssuesCount > 0 ? `
            <div class="section">
                <div class="section-title">
                    <span class="icon">📜</span>
                    Compliance Issues (${complianceIssuesCount})
                </div>
                <div class="issue-list">
                    ${analysis.complianceIssues.map(issue => `
                        <div class="issue-item">
                            <strong>${issue.issue || issue}</strong>
                            ${issue.recommendation ? `<br><small style="color: #6c757d;">→ ${issue.recommendation}</small>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Analysis Summary -->
            ${analysis.summary ? `
            <div class="section">
                <div class="section-title">
                    <span class="icon">📝</span>
                    Analysis Summary
                </div>
                <div style="padding: 15px; background-color: #f8f9fa; border-radius: 6px; font-size: 14px; line-height: 1.6;">
                    ${analysis.summary}
                </div>
            </div>
            ` : ''}

            <!-- Call to Action -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="cta-button">
                    📊 Review Full Report in System
                </a>
                <div style="margin-top: 15px; font-size: 13px; color: #6c757d;">
                    Log in to the Safety Forms Analyzer to review the complete report, add comments, and take action.
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <strong>Safety Forms Analyzer</strong><br>
            Automated Safety Form Processing System<br>
            <br>
            This is an automated email. Please do not reply directly to this message.<br>
            For questions, contact your safety coordinator.
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Get color based on risk level
     */
    getRiskColor(level) {
        switch(level) {
            case 'LOW': return '#28a745';
            case 'MEDIUM': return '#ffc107';
            case 'HIGH': return '#fd7e14';
            case 'CRITICAL': return '#dc3545';
            default: return '#6c757d';
        }
    }

    /**
     * Darken a hex color
     */
    darkenColor(color) {
        const colors = {
            '#28a745': '#1e7e34',
            '#ffc107': '#e0a800',
            '#fd7e14': '#dc6502',
            '#dc3545': '#c82333',
            '#6c757d': '#545b62'
        };
        return colors[color] || color;
    }

    /**
     * Send safety report email to supervisor
     * @param {Object} options - Email options
     * @param {string} options.to - Recipient email
     * @param {string} options.supervisorName - Supervisor's name
     * @param {Object} options.report - Report data
     * @param {string} options.userMessage - Optional user message
     */
    async sendReportEmail({ to, supervisorName, report, userMessage = '' }) {
        if (!this.ready) {
            throw new Error('Email service not configured');
        }

        const riskLevel = report.fullAnalysis?.riskAssessment?.level || 'UNKNOWN';
        const formType = report.formType || 'Safety Form';
        
        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject: `${riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? '🚨 URGENT: ' : ''}Safety Form Review Required - ${formType}`,
            html: this.generateReportEmail(supervisorName, report, userMessage),
            // Plain text fallback
            text: `
Safety Form Review Required

Dear ${supervisorName},

A safety form (${formType}) has been processed and requires your review.

Risk Level: ${riskLevel}
Risk Score: ${report.fullAnalysis?.riskAssessment?.score || 0}/10
Submitted: ${new Date(report.timestamp).toLocaleString()}

${userMessage ? `Additional Message:\n${userMessage}\n\n` : ''}

Please log in to the Safety Forms Analyzer to review the complete report and take appropriate action.

${process.env.FRONTEND_URL || 'http://localhost:3000'}

---
This is an automated email from the Safety Forms Analyzer.
            `.trim()
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email sent successfully:', info.messageId);
            
            return {
                success: true,
                provider: this.provider,
                messageId: info.messageId,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Failed to send email:', error);
            throw new Error(`Email send failed: ${error.message}`);
        }
    }

    /**
     * Send a test email to verify configuration
     */
    async sendTestEmail(to) {
        if (!this.ready) {
            throw new Error('Email service not configured');
        }

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject: 'Safety Forms Analyzer - Email Test',
            html: `
                <h2>Email Service Test</h2>
                <p>This is a test email from the Safety Forms Analyzer.</p>
                <p>If you received this email, the email service is configured correctly.</p>
                <p><strong>Provider:</strong> ${this.provider}</p>
                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            `,
            text: 'This is a test email from the Safety Forms Analyzer. If you received this, the email service is working correctly.'
        };

        const info = await this.transporter.sendMail(mailOptions);
        return {
            success: true,
            provider: this.provider,
            messageId: info.messageId
        };
    }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;