// frontend/src/components/EmailReportDialog.jsx
// Email Dialog Component for Safety Forms Analyzer

import React, { useState, useEffect } from 'react';
import { Mail, X, AlertCircle, CheckCircle, Loader } from 'lucide-react';

const EmailReportDialog = ({ report, isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    supervisorEmail: '',
    supervisorName: '',
    message: ''
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(null);

  // Check if email service is configured
  useEffect(() => {
    const checkEmailStatus = async () => {
      try {
        const response = await fetch('/api/forms/email/status');
        const data = await response.json();
        setEmailConfigured(data.configured);
        if (!data.configured) {
          setError('Email service not configured. Please contact your administrator.');
        }
      } catch (err) {
        console.error('Failed to check email status:', err);
        setEmailConfigured(false);
      }
    };

    if (isOpen) {
      checkEmailStatus();
      setSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  // Load saved email from localStorage
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('supervisorEmail');
      const savedName = localStorage.getItem('supervisorName');
      if (saved) {
        setFormData(prev => ({
          ...prev,
          supervisorEmail: saved,
          supervisorName: savedName || ''
        }));
      }
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.supervisorEmail) {
      setError('Please enter supervisor email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.supervisorEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!report?.id) {
      setError('Invalid report data');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/forms/${report.id}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supervisorEmail: formData.supervisorEmail,
          supervisorName: formData.supervisorName || 'Supervisor',
          message: formData.message
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        
        // Save email for future use
        localStorage.setItem('supervisorEmail', formData.supervisorEmail);
        if (formData.supervisorName) {
          localStorage.setItem('supervisorName', formData.supervisorName);
        }

        // Close after short delay
        setTimeout(() => {
          onClose();
          setSuccess(false);
        }, 2000);
      } else {
        setError(data.error || 'Failed to send email');
      }
    } catch (err) {
      console.error('Email send error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 md:p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mail className="w-6 h-6 text-white" />
              <h2 className="text-lg md:text-xl font-bold text-white">
                Email Report to Supervisor
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={sending}
              className="text-white hover:text-gray-200 touch-manipulation active:scale-95 p-1 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6">
          {emailConfigured === false && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Email service not configured
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Please contact your system administrator to enable email functionality.
                </p>
              </div>
            </div>
          )}

          {success ? (
            <div className="py-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Email Sent Successfully!
              </h3>
              <p className="text-gray-600">
                The supervisor will receive the report shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Report Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Sending report for:</p>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {report?.file || 'Unknown file'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Risk Level: <span className={`font-bold ${
                    report?.riskLevel === 'CRITICAL' ? 'text-red-600' :
                    report?.riskLevel === 'HIGH' ? 'text-orange-600' :
                    report?.riskLevel === 'MEDIUM' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {report?.riskLevel || 'N/A'}
                  </span>
                </p>
              </div>

              {/* Supervisor Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supervisor Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="supervisorEmail"
                  value={formData.supervisorEmail}
                  onChange={handleChange}
                  placeholder="supervisor@company.com"
                  required
                  disabled={sending || emailConfigured === false}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm md:text-base"
                />
              </div>

              {/* Supervisor Name (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supervisor Name <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  name="supervisorName"
                  value={formData.supervisorName}
                  onChange={handleChange}
                  placeholder="John Smith"
                  disabled={sending || emailConfigured === false}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm md:text-base"
                />
              </div>

              {/* Additional Message (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Message <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Add any additional context or notes for the supervisor..."
                  rows={3}
                  disabled={sending || emailConfigured === false}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none text-sm md:text-base"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This message will be included in the email to provide additional context.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  📧 The supervisor will receive a professional email with:
                </p>
                <ul className="text-xs text-blue-700 mt-2 ml-4 space-y-1">
                  <li>• Complete form analysis and risk assessment</li>
                  <li>• Safety issues and recommendations</li>
                  <li>• PPE requirements and compliance checks</li>
                  <li>• Link to review the full report in the system</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={sending}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending || !formData.supervisorEmail || emailConfigured === false}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed touch-manipulation active:scale-95 flex items-center justify-center space-x-2 text-sm md:text-base font-medium"
                >
                  {sending ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailReportDialog;