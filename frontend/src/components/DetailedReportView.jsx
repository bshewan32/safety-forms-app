import React from 'react';
import { ArrowLeft, FileText, Download, Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import ShareReportButton from './ShareReportButton';

const DetailedReportView = ({ report, onBack }) => {
  // Safety check
  if (!report || !report.fullAnalysis) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <button onClick={onBack} className="mb-4 flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span>Back</span>
        </button>
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
          <h2 className="text-lg font-bold text-red-800 mb-2">No Report Data</h2>
          <p className="text-red-700">Report data is missing or incomplete.</p>
        </div>
      </div>
    );
  }

  const analysis = report.fullAnalysis;

  const getRiskColor = (level) => {
    switch(level) {
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
      case 'CRITICAL': return 'bg-red-200 text-red-900 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskBgColor = (level) => {
    switch(level) {
      case 'LOW': return 'bg-green-50';
      case 'MEDIUM': return 'bg-yellow-50';
      case 'HIGH': return 'bg-orange-50';
      case 'CRITICAL': return 'bg-red-50';
      default: return 'bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <div className="flex flex-wrap gap-2">
        <ShareReportButton 
          report={report}
          className="flex-1 md:flex-none"/>
        <button
          onClick={() => window.print()}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg">
          <Download className="w-4 h-4" />
          <span>Print</span>
        </button>
      </div>
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold text-gray-900">
                  Safety Form Analysis Report
                </h1>
                <p className="text-xs md:text-sm text-gray-600 truncate">{report.file}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            {/* Form Details */}
            <div className="bg-gray-50 rounded-lg p-3 md:p-4">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">📋 Form Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">Form Type</p>
                  <p className="font-medium text-sm md:text-base text-gray-900">{analysis.formType}</p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-600">Date Analyzed</p>
                  <p className="font-medium text-sm md:text-base text-gray-900">
                    {new Date(report.timestamp).toLocaleString()}
                  </p>
                </div>
                {analysis.workLocation && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Location</p>
                    <p className="font-medium text-sm md:text-base text-gray-900">{analysis.workLocation}</p>
                  </div>
                )}
                {analysis.workActivity && (
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Activity</p>
                    <p className="font-medium text-sm md:text-base text-gray-900">{analysis.workActivity}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="bg-gray-50 rounded-lg p-3 md:p-4">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">⚠️ Risk Assessment</h2>
              <div className={`p-4 rounded-lg ${getRiskBgColor(analysis.riskLevel)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs md:text-sm text-gray-600">Risk Score</p>
                    <p className="text-2xl md:text-3xl font-bold text-gray-900">
                      {analysis.riskScore}/10
                    </p>
                  </div>
                  <div>
                    <span className={`px-3 md:px-4 py-1 md:py-2 rounded-full text-sm md:text-base font-bold border-2 ${getRiskColor(analysis.riskLevel)}`}>
                      {analysis.riskLevel}
                    </span>
                  </div>
                </div>
                {(analysis.requiresSupervisorReview || analysis.riskScore >= 7) && (
                  <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-md flex items-start space-x-2">
                    <Shield className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Supervisor Review Required</p>
                      <p className="text-xs text-red-700 mt-1">
                        This form requires supervisor approval due to {analysis.riskLevel.toLowerCase()} risk level.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Safety Issues */}
            {analysis.flaggedIssues && analysis.flaggedIssues.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">
                  🔍 Safety Issues Found ({analysis.flaggedIssues.length})
                </h2>
                <div className="space-y-3">
                  {analysis.flaggedIssues.map((issue, idx) => (
                    <div key={idx} className="bg-white border-l-4 border-yellow-400 p-3 rounded">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm md:text-base text-gray-900">{issue.description}</p>
                          <p className="text-xs md:text-sm text-gray-600 mt-1">{issue.recommendation}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 mt-2 flex-wrap gap-2">
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {issue.category}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                          issue.severity === 'HIGH' ? 'bg-red-100 text-red-600' :
                          issue.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {issue.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PPE Requirements */}
            {analysis.ppeRequired && analysis.ppeRequired.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">
                  🦺 PPE Requirements ({analysis.ppeRequired.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysis.ppeRequired.map((ppe, idx) => (
                    <div key={idx} className="bg-white p-3 rounded flex items-center justify-between">
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${ppe.mandatory ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {ppe.type.replace('_', ' ')}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ml-2 ${
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
            {analysis.formCompleteness && (
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">✓ Form Completeness</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs md:text-sm text-gray-600 mb-1">Status</p>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
                      analysis.formCompleteness === 'COMPLETE' ? 'bg-green-100 text-green-800' :
                      analysis.formCompleteness === 'PARTIALLY_COMPLETE' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {analysis.formCompleteness?.replace('_', ' ')}
                    </span>
                  </div>
                  {analysis.workerDetails?.signaturesPresent !== undefined && (
                    <div>
                      <p className="text-xs md:text-sm text-gray-600 mb-1">Signatures</p>
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
                        analysis.workerDetails.signaturesPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {analysis.workerDetails.signaturesPresent ? 'Present' : 'Missing'}
                      </span>
                    </div>
                  )}
                </div>

                {analysis.missingFields && analysis.missingFields.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs md:text-sm font-medium text-gray-700 mb-2">Missing Information:</p>
                    <div className="space-y-1">
                      {analysis.missingFields.map((field, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-xs md:text-sm text-gray-700">{field}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.positiveFindings && analysis.positiveFindings.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs md:text-sm font-medium text-gray-700 mb-2">Positive Practices:</p>
                    <div className="space-y-1">
                      {analysis.positiveFindings.map((finding, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-xs md:text-sm text-gray-700">{finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Compliance Issues */}
            {analysis.complianceIssues && analysis.complianceIssues.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">
                  ⚠️ Compliance Issues ({analysis.complianceIssues.length})
                </h2>
                <div className="space-y-3">
                  {analysis.complianceIssues.map((issue, idx) => (
                    <div key={idx} className="bg-white border-l-4 border-red-400 p-3 rounded">
                      <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm md:text-base text-gray-900">{issue.issue}</p>
                          <p className="text-xs md:text-sm text-gray-600 mt-1">{issue.action}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 mt-2 flex-wrap gap-2">
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono">
                          {issue.standard}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                          issue.severity === 'HIGH' ? 'bg-red-100 text-red-600' :
                          issue.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {issue.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {analysis.summary && (
              <div className="bg-blue-50 rounded-lg p-3 md:p-4">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-2">📝 Analysis Summary</h2>
                <p className="text-sm md:text-base text-gray-700">{analysis.summary}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 md:p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col md:flex-row gap-3">
              <button
                onClick={onBack}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium touch-manipulation active:scale-95"
              >
                Back to Reports
              </button>
              <button
                onClick={() => alert('📄 PDF export coming soon!')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium touch-manipulation active:scale-95"
              >
                Export PDF
              </button>
              <button
                onClick={() => alert('✉️ Email feature coming soon!')}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium touch-manipulation active:scale-95"
              >
                Email to Supervisor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailedReportView;