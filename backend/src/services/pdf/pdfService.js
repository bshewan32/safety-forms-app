// backend/src/services/pdf/pdfService.js
// Professional PDF generation for safety form reports

const PDFDocument = require('pdfkit');

class PDFService {
    constructor() {
        console.log('📄 PDF Service initialized');
    }

    /**
     * Generate a professional PDF report from analysis data
     * @param {Object} report - Report data including analysis
     * @returns {Promise<Buffer>} - PDF as buffer
     */
    async generateReport(report) {
        return new Promise((resolve, reject) => {
            try {
                const analysis = report.fullAnalysis;
                const riskLevel = analysis.riskAssessment?.level || 'UNKNOWN';
                const riskScore = analysis.riskAssessment?.score || 0;

                // Create PDF document
                const doc = new PDFDocument({
                    size: 'A4',
                    margins: { top: 50, bottom: 50, left: 50, right: 50 },
                    info: {
                        Title: `Safety Form Report - ${report.file}`,
                        Author: 'Safety Forms Analyzer',
                        Subject: 'Safety Form Analysis Report',
                        Keywords: 'safety, analysis, report, risk assessment'
                    }
                });

                // Collect PDF data into buffer
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });
                doc.on('error', reject);

                // Build PDF content
                console.log('📄 Building header...');
                this.buildHeader(doc, report, riskLevel, riskScore);
                console.log('📄 Building risk banner...');
                this.buildRiskBanner(doc, riskLevel, riskScore, analysis);
                console.log('📄 Building form details...');
                this.buildFormDetails(doc, report, analysis);
                console.log('📄 Building risk assessment...');
                this.buildRiskAssessment(doc, analysis, riskLevel, riskScore);
                console.log('📄 Building safety issues...');
                this.buildSafetyIssues(doc, analysis);
                console.log('📄 Building PPE requirements...');
                this.buildPPERequirements(doc, analysis);
                console.log('📄 Building form completeness...');
                this.buildFormCompleteness(doc, analysis);
                console.log('📄 Building positive practices...');
                this.buildPositivePractices(doc, analysis);
                console.log('📄 Building compliance issues...');
                this.buildComplianceIssues(doc, analysis);
                console.log('📄 Building summary...');
                this.buildSummary(doc, analysis);
                console.log('📄 Building footer...');
                this.buildFooter(doc, report);

                // Finalize PDF
                doc.end();

            } catch (error) {
                reject(new Error(`PDF generation failed: ${error.message}`));
            }
        });
    }

    /**
     * Build PDF header with title and metadata
     */
    buildHeader(doc, report, riskLevel, riskScore) {
        // Title
        doc.fontSize(24)
            .font('Helvetica-Bold')
            .fillColor('#2c3e50')
            .text('Safety Form Analysis Report', { align: 'center' });

        doc.moveDown(0.5);

        // Filename
        doc.fontSize(12)
            .font('Helvetica')
            .fillColor('#7f8c8d')
            .text(report.file, { align: 'center' });

        // Timestamp
        doc.fontSize(10)
            .text(new Date(report.timestamp).toLocaleString(), { align: 'center' });

        doc.moveDown(1.5);

        // Horizontal line
        doc.strokeColor('#bdc3c7')
            .lineWidth(1)
            .moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke();

        doc.moveDown(1);
    }

    /**
     * Build prominent risk banner
     */
    buildRiskBanner(doc, riskLevel, riskScore, analysis) {
        const colors = this.getRiskColors(riskLevel);
        const startY = doc.y;

        // Background box
        doc.rect(50, startY, 495, 80)
            .fillAndStroke(colors.light, colors.dark);

        // Risk level text
        doc.fontSize(20)
            .font('Helvetica-Bold')
            .fillColor(colors.dark)
            .text(`${riskLevel} RISK`, 70, startY + 20, { width: 455 });

        // Risk score
        doc.fontSize(16)
            .font('Helvetica')
            .text(`Score: ${riskScore}/10`, 70, startY + 50, { width: 455 });

        doc.y = startY + 100;

        // Supervisor review warning if needed
        if (analysis.riskAssessment?.requiresSupervisorReview) {
            doc.rect(50, doc.y, 495, 50)
                .fillAndStroke('#fee2e2', '#dc2626');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .fillColor('#991b1b')
                .text('⚠ SUPERVISOR REVIEW REQUIRED', 70, doc.y + 10, { width: 455 });

            doc.fontSize(10)
                .font('Helvetica')
                .text('This form requires immediate supervisor approval', 70, doc.y + 30, { width: 455 });

            doc.y += 60;
        }

        doc.moveDown(1);
    }

    /**
     * Build form details section
     */
    buildFormDetails(doc, report, analysis) {
        this.addSectionHeader(doc, '📋 Form Details');

        const details = [
            ['Form Type', report.formType || 'Unknown'],
            ['Date/Time', analysis.formDetails?.date || 'Not specified'],
            ['Location', analysis.formDetails?.location || 'Not specified'],
            ['Activity', analysis.formDetails?.activity || 'Not specified'],
            ['Submitted By', analysis.formDetails?.submittedBy || 'Not specified']
        ];

        this.addDetailsGrid(doc, details);
        doc.moveDown(1);
    }

    /**
     * Build risk assessment section
     */
    buildRiskAssessment(doc, analysis, riskLevel, riskScore) {
        this.addSectionHeader(doc, '⚠️ Risk Assessment');

        const colors = this.getRiskColors(riskLevel);
        const startY = doc.y;

        // Risk summary box
        doc.rect(50, startY, 495, 80)
            .fillAndStroke(colors.light, colors.border);

        doc.fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#2c3e50')
            .text('Risk Summary:', 70, startY + 15);

        doc.fontSize(10)
            .font('Helvetica')
            .text(`• Risk Score: ${riskScore}/10 (${riskLevel})`, 70, startY + 35);

        const reviewStatus = analysis.riskAssessment?.requiresSupervisorReview 
            ? '🔴 Requires supervisor review' 
            : '🟢 Standard process';
        doc.text(`• ${reviewStatus}`, 70, startY + 50);

        const workStatus = analysis.riskAssessment?.workCanProceed 
            ? '✅ Work can proceed with controls' 
            : '🛑 Work should not proceed';
        doc.text(`• ${workStatus}`, 70, startY + 65);

        doc.y = startY + 90;
        doc.moveDown(1);
    }

    /**
     * Build safety issues section
     */
    buildSafetyIssues(doc, analysis) {
        if (!analysis.safetyIssues || analysis.safetyIssues.length === 0) return;

        this.addSectionHeader(doc, `🔍 Safety Issues Found (${analysis.safetyIssues.length})`);

        analysis.safetyIssues.forEach((issue, index) => {
            // Check if we need a new page
            if (doc.y > 700) {
                doc.addPage();
            }

            const severity = issue.severity || 'MEDIUM';
            const colors = this.getSeverityColors(severity);

            const startY = doc.y;

            // Pre-measure heights to compute box height
            const headerHeight = 20; // title row height
            const detailsHeight = issue.details
                ? this.measureTextHeight(doc, issue.details, { width: 475, font: 'Helvetica', fontSize: 9, lineGap: 2 }) + 5
                : 0;
            const recText = issue.recommendation ? 'Recommendation: ' + issue.recommendation : '';
            const recommendationHeight = recText
                ? this.measureTextHeight(doc, recText, { width: 475, font: 'Helvetica', fontSize: 9, lineGap: 2 }) + 5
                : 0;

            const paddingTop = 10;
            const paddingBottom = 10;
            const boxHeight = paddingTop + headerHeight + detailsHeight + recommendationHeight + paddingBottom;

            // Draw box with computed height
            doc.rect(50, startY, 495, boxHeight)
               .fillAndStroke(colors.light, colors.border);

            // Issue header
            doc.fontSize(11)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text(issue.hazard || issue.category || 'Safety Issue', 60, startY + paddingTop, { width: 430, lineGap: 2 });

            // Severity badge
            doc.fontSize(9)
               .font('Helvetica-Bold')
               .fillColor(colors.dark)
               .text(severity, 500, startY + paddingTop);

            let currentY = startY + paddingTop + headerHeight;

            // Details
            if (issue.details) {
                doc.fontSize(9)
                   .font('Helvetica')
                   .fillColor('#4a5568')
                   .text(issue.details, 60, currentY, { width: 475, lineGap: 2 });
                currentY = doc.y + 5;
            }

            // Recommendation
            if (recText) {
                doc.fontSize(9)
                   .font('Helvetica-Bold')
                   .fillColor('#2c5282')
                   .text('Recommendation:', 60, currentY, { continued: true, width: 475, lineGap: 2 })
                   .font('Helvetica')
                   .text(' ' + issue.recommendation);
                currentY = doc.y + 5;
            }

            // Set cursor below box
            doc.y = startY + boxHeight + 5;
            doc.moveDown(0.5);
        });

        doc.moveDown(1);
    }

    /**
     * Build PPE requirements section
     */
    buildPPERequirements(doc, analysis) {
        if (!analysis.ppeRequirements || analysis.ppeRequirements.length === 0) return;

        this.addSectionHeader(doc, `🦺 PPE Requirements (${analysis.ppeRequirements.length})`);

        const startY = doc.y;
        const paddingTop = 10;
        const paddingBottom = 10;

        // Pre-measure list height
        let listHeight = 0;
        analysis.ppeRequirements.forEach((ppe) => {
            listHeight += this.measureTextHeight(doc, `• ${ppe}`, { width: 475, font: 'Helvetica', fontSize: 10, lineGap: 2 }) + 2;
        });
        const boxHeight = paddingTop + listHeight + paddingBottom;

        doc.rect(50, startY, 495, boxHeight)
           .fillAndStroke('#eff6ff', '#3b82f6');

        let currentY = startY + paddingTop;
        analysis.ppeRequirements.forEach((ppe) => {
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#1e3a8a')
               .text(`• ${ppe}`, 60, currentY, { width: 475, lineGap: 2 });
            currentY = doc.y + 2;
        });

        doc.y = startY + boxHeight + 5;
        doc.moveDown(1);
    }

    /**
     * Build form completeness section
     */
    buildFormCompleteness(doc, analysis) {
        if (!analysis.formCompleteness) return;

        this.addSectionHeader(doc, '✓ Form Completeness');

        const status = analysis.formCompleteness.status || 'UNKNOWN';
        const isComplete = status === 'COMPLETE';
        const color = isComplete ? '#10b981' : '#f59e0b';
        const bgColor = isComplete ? '#d1fae5' : '#fef3c7';

        const startY = doc.y;
        doc.rect(50, startY, 495, 40)
            .fillAndStroke(bgColor, color);

        doc.fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#2c3e50')
            .text(`Status: ${status}`, 60, startY + 15);

        doc.y = startY + 50;

        // Missing fields
        if (analysis.formCompleteness.missingFields && 
            analysis.formCompleteness.missingFields.length > 0) {
            doc.fontSize(10)
                .font('Helvetica-Bold')
                .fillColor('#dc2626')
                .text('Missing Information:', 60, doc.y);

            doc.moveDown(0.3);

            analysis.formCompleteness.missingFields.forEach((field) => {
                doc.fontSize(9)
                    .font('Helvetica')
                    .text(`✗ ${field}`, 70, doc.y, { width: 465 });
                doc.moveDown(0.2);
            });
        }

        doc.moveDown(1);
    }

    /**
     * Build positive practices section
     */
    buildPositivePractices(doc, analysis) {
        if (!analysis.positivePractices || analysis.positivePractices.length === 0) return;

        this.addSectionHeader(doc, `✓ Positive Practices (${analysis.positivePractices.length})`);

        const startY = doc.y;
        const paddingTop = 10;
        const paddingBottom = 10;

        let listHeight = 0;
        analysis.positivePractices.forEach((practice) => {
            listHeight += this.measureTextHeight(doc, `✓ ${practice}`, { width: 475, font: 'Helvetica', fontSize: 10, lineGap: 2 }) + 2;
        });
        const boxHeight = paddingTop + listHeight + paddingBottom;

        doc.rect(50, startY, 495, boxHeight)
           .fillAndStroke('#d1fae5', '#10b981');

        let currentY = startY + paddingTop;
        analysis.positivePractices.forEach((practice) => {
            doc.fontSize(10)
               .font('Helvetica')
               .fillColor('#065f46')
               .text(`✓ ${practice}`, 60, currentY, { width: 475, lineGap: 2 });
            currentY = doc.y + 2;
        });

        doc.y = startY + boxHeight + 5;
        doc.moveDown(1);
    }

    /**
     * Build compliance issues section
     */
    buildComplianceIssues(doc, analysis) {
        if (!analysis.complianceIssues || analysis.complianceIssues.length === 0) return;

        this.addSectionHeader(doc, `📜 Compliance Issues (${analysis.complianceIssues.length})`);

        analysis.complianceIssues.forEach((issue) => {
            if (doc.y > 700) doc.addPage();

            const startY = doc.y;

            const titleText = issue.issue || issue;
            const titleHeight = this.measureTextHeight(doc, titleText, { width: 475, font: 'Helvetica-Bold', fontSize: 10, lineGap: 2 });
            const recText = issue.recommendation ? `Recommendation: ${issue.recommendation}` : '';
            const recHeight = recText ? this.measureTextHeight(doc, recText, { width: 475, font: 'Helvetica', fontSize: 9, lineGap: 2 }) + 5 : 0;

            const paddingTop = 10;
            const paddingBottom = 10;
            const spacer = 10;

            const boxHeight = paddingTop + titleHeight + spacer + recHeight + paddingBottom;

            doc.rect(50, startY, 495, boxHeight)
               .fillAndStroke('#fff7ed', '#f97316');

            doc.fontSize(10)
               .font('Helvetica-Bold')
               .fillColor('#9a3412')
               .text(titleText, 60, startY + paddingTop, { width: 475, lineGap: 2 });

            let currentY = startY + paddingTop + titleHeight + spacer;

            if (recText) {
                doc.fontSize(9)
                   .font('Helvetica')
                   .fillColor('#7c2d12')
                   .text(recText, 60, currentY, { width: 475, lineGap: 2 });
                currentY = doc.y + 5;
            }

            doc.y = startY + boxHeight + 5;
            doc.moveDown(0.5);
        });

        doc.moveDown(1);
    }

    /**
     * Build analysis summary section
     */
    buildSummary(doc, analysis) {
        if (!analysis.summary) return;

        if (doc.y > 650) doc.addPage();

        this.addSectionHeader(doc, '📝 Analysis Summary');

        const startY = doc.y;

        // Measure summary height to size the box
        const textHeight = this.measureTextHeight(doc, analysis.summary, { width: 475, font: 'Helvetica', fontSize: 10, lineGap: 3 });
        const paddingTop = 15;
        const paddingBottom = 20;
        const boxHeight = paddingTop + textHeight + paddingBottom;

        doc.rect(50, startY, 495, boxHeight)
           .fillAndStroke('#f3f4f6', '#9ca3af');

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#374151')
           .text(analysis.summary, 60, startY + paddingTop, { 
               width: 475, 
               align: 'left',
               lineGap: 3
           });

        doc.y = startY + boxHeight;
    }
    /**
     * Helper: measure text height with current or specified font options
     * Ensures we can pre-compute box heights instead of using unsupported 'auto'
     */
    measureTextHeight(doc, text, { width = 475, font = 'Helvetica', fontSize = 10, lineGap = 3 } = {}) {
        if (!text) return 0;
        // Save current font settings
        const currentFont = doc._font ? doc._font.name : undefined;
        const currentFontSize = doc._fontSize;
        const currentLineGap = doc._lineGap;
        try {
            doc.font(font).fontSize(fontSize);
            return doc.heightOfString(text, { width, lineGap });
        } finally {
            // Restore previous font settings if available
            if (currentFont) doc.font(currentFont);
            if (currentFontSize) doc.fontSize(currentFontSize);
            if (typeof currentLineGap === 'number') doc.lineGap(currentLineGap);
        }
    }

    /**
     * Build footer with metadata
     */
    buildFooter(doc, report) {
        // Add page at bottom if needed
        const footerY = 750;
        
        doc.fontSize(8)
            .font('Helvetica')
            .fillColor('#9ca3af')
            .text(
                'This report was generated automatically by the Safety Forms Analyzer',
                50,
                footerY,
                { align: 'center', width: 495 }
            );

        doc.fontSize(7)
            .text(
                `Report ID: ${report.id || 'N/A'} • Generated: ${new Date(report.timestamp).toLocaleString()}`,
                50,
                footerY + 15,
                { align: 'center', width: 495 }
            );
    }

    /**
     * Helper: Add section header
     */
    addSectionHeader(doc, title) {
        if (doc.y > 720) {
            doc.addPage();
        }

        doc.fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#2c3e50')
            .text(title);

        doc.moveDown(0.5);
    }

    /**
     * Helper: Add details grid
     */
    addDetailsGrid(doc, details) {
        const startY = doc.y;
        let currentY = startY;

        details.forEach(([label, value], index) => {
            const boxY = currentY + (index * 30);
            
            // Alternating background
            if (index % 2 === 0) {
                doc.rect(50, boxY, 495, 30)
                    .fill('#f9fafb');
            }

            doc.fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#6b7280')
                .text(label, 60, boxY + 10, { width: 150 });

            doc.fontSize(10)
                .font('Helvetica')
                .fillColor('#2c3e50')
                .text(value, 220, boxY + 10, { width: 315 });
        });

        doc.y = startY + (details.length * 30) + 10;
    }

    /**
     * Get risk level colors
     */
    getRiskColors(level) {
        const colors = {
            'LOW': { dark: '#065f46', light: '#d1fae5', border: '#10b981' },
            'MEDIUM': { dark: '#92400e', light: '#fef3c7', border: '#f59e0b' },
            'HIGH': { dark: '#9a3412', light: '#fed7aa', border: '#f97316' },
            'CRITICAL': { dark: '#991b1b', light: '#fee2e2', border: '#dc2626' },
            'UNKNOWN': { dark: '#4b5563', light: '#f3f4f6', border: '#9ca3af' }
        };
        return colors[level] || colors['UNKNOWN'];
    }

    /**
     * Get severity colors
     */
    getSeverityColors(severity) {
        const colors = {
            'HIGH': { dark: '#991b1b', light: '#fee2e2', border: '#dc2626' },
            'MEDIUM': { dark: '#92400e', light: '#fef3c7', border: '#f59e0b' },
            'LOW': { dark: '#065f46', light: '#d1fae5', border: '#10b981' }
        };
        return colors[severity] || colors['MEDIUM'];
    }
}

// Create singleton instance
const pdfService = new PDFService();

module.exports = pdfService;