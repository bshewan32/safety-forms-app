import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, FileText, Shield, AlertCircle, ArrowLeft, Download, Mail } from 'lucide-react';

const DetailedReportView = ({ report, onBack }) => {
  // Handle both interactive and bulk response structures
  let analysis;
  if (report.result?.analysis) {
    // Interactive mode structure
    analysis = report.result.analysis;
  } else if (report.result?.result) {
    // Bulk mode structure - convert to match analysis format
    const bulkResult = report.result.result;
    analysis = {
      formType: bulkResult.formType,
      formTypeConfidence: 'HIGH',
      workLocation: bulkResult.analysis?.workLocation || 'Not specified',
      workActivity: bulkResult.analysis?.workActivity || 'Not specified',
      riskScore: bulkResult.riskAssessment?.score || report.riskScore,
      riskLevel: bulkResult.riskAssessment?.level || report.riskLevel,
      requiresSupervisorReview: (bulkResult.riskAssessment?.score || report.riskScore) >= 7,
      flaggedIssues: bulkResult.safetyIssues || [],
      ppeRequired: bulkResult.analysis?.ppeRequired || [],
      formCompleteness: bulkResult.analysis?.formCompleteness || 'UNKNOWN',
      workerDetails: bulkResult.analysis?.workerDetails || {},
      missingFields: bulkResult.analysis?.missingFields || [],
      positiveFindings: bulkResult.analysis?.positiveFindings || [],
      complianceIssues: bulkResult.analysis?.complianceIssues || [],
      summary: bulkResult.analysis?.summary || 'Analysis complete'
    };
  } else {
    analysis = {};
  }

  const formTypeOptions = [
    { value: 'TAKE_5', label: 'Take 5 Safety Checklist' },
    { value: 'SWMS', label: 'Safe Work Method Statement' },
    { value: 'JSA', label: 'Job Safety Analysis' },
    { value: 'JHA', label: 'Job Hazard Analysis' },
    { value: 'JSEA', label: 'Job Safety & Environmental Analysis' },
    { value: 'PTB', label: 'Pre-Task Brief' },
    { value: 'HAZARD_ASSESSMENT', label: 'Hazard Assessment' },
    { value: 'PERMIT_TO_WORK', label: 'Permit to Work' },
    { value: 'TOOLBOX_TALK', label: 'Toolbox Talk' },
    { value: 'INCIDENT_REPORT', label: 'Incident Report' },
    { value: 'SAFETY_INDUCTION', label: 'Safety Induction' },
    { value: 'UNKNOWN', label: 'Unknown/Other' }
  ];

  const riskLevelColors = {
    LOW: 'text-green-600 bg-green-50',
    MEDIUM: 'text-yellow-600 bg-yellow-50',
    HIGH: 'text-red-600 bg-red-50',
    CRITICAL: 'text-red-800 bg-red-100'
  };

  const getRiskIcon = (level) => {
    switch(level) {
      case 'LOW': return <CheckCircle className="w-5 h-5" />;
      case 'MEDIUM': return <AlertTriangle className="w-5 h-5" />;
      case 'HIGH': return <XCircle className="w-5 h-5" />;
      case 'CRITICAL': return <AlertCircle className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Action Bar */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={() => alert('PDF export coming soon! This will download a professional PDF report for printing and archiving.')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 inline-flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
            <button
              onClick={() => alert('Email feature coming soon! This will send the complete report to your supervisor for immediate review and action.')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center space-x-2"
            >
              <Mail className="w-4 h-4" />
              <span>Email to Supervisor</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Safety Form Analysis Report
                </h2>
                <p className="text-sm text-gray-500">{report.file}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Form Type Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Form Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Form Type
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {formTypeOptions.find(opt => opt.value === analysis.formType)?.label || analysis.formType}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      analysis.formTypeConfidence === 'HIGH' ? 'bg-green-100 text-green-700' :
                      analysis.formTypeConfidence === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {analysis.formTypeConfidence} confidence
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Work Location
                  </label>
                  <span className="text-gray-900">{analysis.workLocation || 'Not specified'}</span>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Activity
                </label>
                <span className="text-gray-900">{analysis.workActivity || 'Not specified'}</span>
              </div>
            </div>

            {/* Risk Assessment Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Risk Assessment</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Score
                  </label>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-2xl font-bold text-gray-900">
                      {analysis.riskScore}/10
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Level
                  </label>
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-md ${riskLevelColors[analysis.riskLevel]}`}>
                    {getRiskIcon(analysis.riskLevel)}
                    <span className="font-medium">{analysis.riskLevel}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supervisor Review
                  </label>
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-md ${
                    analysis.requiresSupervisorReview ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                  }`}>
                    <Shield className="w-4 h-4" />
                    <span className="font-medium">
                      {analysis.requiresSupervisorReview ? 'Required' : 'Not Required'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Safety Issues */}
            {analysis.flaggedIssues && analysis.flaggedIssues.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  Safety Issues Found ({analysis.flaggedIssues.length})
                </h3>
                <div className="space-y-3">
                  {analysis.flaggedIssues.map((issue, index) => (
                    <div key={index} className="bg-white rounded-md p-3 border-l-4 border-yellow-400">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                              {issue.category}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded ${
                              issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                              issue.severity === 'HIGH' ? 'bg-red-100 text-red-600' :
                              issue.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-gray-900 font-medium">{issue.description}</p>
                          <p className="text-gray-600 text-sm mt-1">{issue.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PPE Requirements */}
            {analysis.ppeRequired && analysis.ppeRequired.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  PPE Requirements ({analysis.ppeRequired.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysis.ppeRequired.map((ppe, index) => (
                    <div key={index} className="flex items-center space-x-3 bg-white rounded-md p-3">
                      <div className={`w-3 h-3 rounded-full ${ppe.mandatory ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{ppe.type?.replace('_', ' ') || ppe}</span>
                        {ppe.specification && (
                          <p className="text-sm text-gray-600">{ppe.specification}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        ppe.mandatory ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {ppe.mandatory ? 'Required' : 'Recommended'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form Completeness */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Form Completeness</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Completeness Status
                  </label>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    analysis.formCompleteness === 'COMPLETE' ? 'bg-green-100 text-green-800' :
                    analysis.formCompleteness === 'PARTIALLY_COMPLETE' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {analysis.formCompleteness?.replace('_', ' ') || 'Unknown'}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Worker Signatures
                  </label>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    analysis.workerDetails?.signaturesPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {analysis.workerDetails?.signaturesPresent ? 'Present' : 'Missing'}
                  </span>
                </div>
              </div>

              {analysis.missingFields && analysis.missingFields.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Missing Information
                  </label>
                  <div className="space-y-1">
                    {analysis.missingFields.map((field, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-gray-700">{field}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.positiveFindings && analysis.positiveFindings.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Positive Safety Practices
                  </label>
                  <div className="space-y-1">
                    {analysis.positiveFindings.map((finding, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-700">{finding}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Compliance Issues */}
            {analysis.complianceIssues && analysis.complianceIssues.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  Compliance Issues ({analysis.complianceIssues.length})
                </h3>
                <div className="space-y-3">
                  {analysis.complianceIssues.map((issue, index) => (
                    <div key={index} className="bg-white rounded-md p-3 border-l-4 border-red-400">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-mono">
                              {issue.standard}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded ${
                              issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                              issue.severity === 'HIGH' ? 'bg-red-100 text-red-600' :
                              issue.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-gray-900 font-medium">{issue.issue}</p>
                          <p className="text-gray-600 text-sm mt-1">{issue.action}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Analysis Summary</h3>
              <p className="text-gray-700">{analysis.summary}</p>
            </div>
          </div>

          {/* Footer Info */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              <p><span className="font-medium">Analyzed:</span> {new Date(report.timestamp).toLocaleString()}</p>
              <p><span className="font-medium">Confidence:</span> {analysis.formTypeConfidence || 'HIGH'}</p>
            </div>
          </div>

          {/* Warning Banner for High Risk */}
          {analysis.requiresSupervisorReview && (
            <div className="bg-red-50 border-t border-red-200 p-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-red-800 font-medium">
                    Supervisor Review Required
                  </p>
                  <p className="text-red-700 text-sm">
                    This form has been flagged for supervisor review due to {analysis.riskLevel?.toLowerCase()} risk level or compliance issues.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailedReportView;