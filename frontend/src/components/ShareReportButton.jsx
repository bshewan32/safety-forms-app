// frontend/src/ShareReportButton.jsx
// Smart share button with native share API and warning dialog

import React, { useState } from 'react';
import { Share2, Download, Loader, AlertTriangle, X } from 'lucide-react';

const ShareReportButton = ({ report, className = '' }) => {
  const [generating, setGenerating] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(null);

  const riskLevel = report?.fullAnalysis?.riskAssessment?.level || 'UNKNOWN';
  const requiresReview = report?.fullAnalysis?.riskAssessment?.requiresSupervisorReview;
  const isCritical = riskLevel === 'CRITICAL' || riskLevel === 'HIGH';

  // Check if Web Share API is supported
  const canShare = typeof navigator !== 'undefined' && 
                    navigator.share && 
                    navigator.canShare;

  const handleClick = () => {
    // Show warning for critical/high risk forms
    if (isCritical && requiresReview && !confirmed) {
      setShowWarning(true);
    } else {
      generateAndShare();
    }
  };

  const handleConfirmWarning = () => {
    setConfirmed(true);
    setShowWarning(false);
    generateAndShare();
  };

  const generateAndShare = async () => {
    setGenerating(true);
    setError(null);

    try {
      // Generate PDF
      console.log('📄 Generating PDF...');
      
      const response = await fetch('/api/forms/pdf/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ report })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      const filename = `safety-report-${riskLevel}-${Date.now()}.pdf`;
      
      console.log('✅ PDF generated, size:', blob.size);

      // Try native share first (mobile)
      if (canShare) {
        try {
          const file = new File([blob], filename, { type: 'application/pdf' });
          
          // Check if can share files
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Safety Form Report - ${riskLevel}`,
              text: isCritical 
                ? '⚠️ CRITICAL: This safety form requires immediate supervisor review' 
                : 'Safety form analysis report',
              files: [file]
            });
            
            console.log('✅ Shared successfully via Web Share API');
            return;
          }
        } catch (shareError) {
          if (shareError.name === 'AbortError') {
            console.log('ℹ️ User cancelled share');
            return;
          }
          console.warn('Share failed, falling back to download:', shareError);
          // Fall through to download
        }
      }

      // Fallback: Download PDF
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('✅ PDF downloaded successfully');

    } catch (err) {
      console.error('❌ Failed to generate/share PDF:', err);
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      {/* Share Button */}
      <button
        onClick={handleClick}
        disabled={generating}
        className={`flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors touch-manipulation active:scale-95 ${className}`}
      >
        {generating ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            <span>Generating PDF...</span>
          </>
        ) : (
          <>
            {canShare ? <Share2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            <span>{canShare ? 'Share Report' : 'Download PDF'}</span>
          </>
        )}
      </button>

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Warning Dialog */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-8 h-8 text-white" />
                  <h2 className="text-xl font-bold text-white">
                    {riskLevel} Risk Detected
                  </h2>
                </div>
                <button
                  onClick={() => setShowWarning(false)}
                  className="text-white hover:text-gray-200 touch-manipulation active:scale-95 p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
                <p className="text-sm text-red-800 font-medium">
                  This safety form has been flagged as <strong>{riskLevel} RISK</strong> and requires immediate supervisor review and approval before work proceeds.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Critical Safety Issues:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {report.fullAnalysis.safetyIssues?.slice(0, 3).map((issue, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{issue.hazard || issue.category}</span>
                    </li>
                  ))}
                  {report.fullAnalysis.safetyIssues?.length > 3 && (
                    <li className="text-gray-500">+ {report.fullAnalysis.safetyIssues.length - 3} more issues</li>
                  )}
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-900">
                  <strong>⚠️ Important:</strong> By sharing this report, you acknowledge that:
                </p>
                <ul className="text-sm text-yellow-800 mt-2 space-y-1 ml-4">
                  <li>• This form requires immediate supervisor review</li>
                  <li>• Work should not proceed until issues are addressed</li>
                  <li>• All safety recommendations must be followed</li>
                </ul>
              </div>

              {/* Confirmation */}
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  I understand this is a {riskLevel.toLowerCase()} risk situation and I will share this report with my supervisor immediately
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex space-x-3">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation active:scale-95 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWarning}
                disabled={!confirmed}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors touch-manipulation active:scale-95 font-medium"
              >
                Confirm & Share
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShareReportButton;