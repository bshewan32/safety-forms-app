import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Edit3, Save, X, FileText, Shield, AlertCircle, ArrowLeft } from 'lucide-react';

const FormAnalysisConfirmation = ({ 
  analysis,           // Changed from analysisResult to match SmartSafetyFormsApp
  fileName,           // Optional
  onConfirm, 
  onBack,            // Changed from onCancel to match SmartSafetyFormsApp
  onEdit 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState(analysis);

  // Add safety check
  if (!analysis) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-bold text-red-800 mb-2">Error: No Analysis Data</h2>
          <p className="text-red-700 mb-4">The analysis data is missing.</p>
          <button
            onClick={onBack}
            className="w-full py-3 bg-gray-600 text-white rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
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

  const handleFormTypeChange = (newFormType) => {
    setEditedAnalysis(prev => ({
      ...prev,
      formType: newFormType,
      formTypeConfidence: 'HIGH' // User correction gets high confidence
    }));
  };

  const handleRiskScoreChange = (newScore) => {
    const score = parseInt(newScore);
    let level = 'MEDIUM';
    
    if (score <= 2) level = 'LOW';
    else if (score <= 4) level = 'LOW';
    else if (score <= 6) level = 'MEDIUM';
    else if (score <= 8) level = 'HIGH';
    else level = 'CRITICAL';

    setEditedAnalysis(prev => ({
      ...prev,
      riskScore: score,
      riskLevel: level,
      requiresSupervisorReview: score >= 7
    }));
  };

  const handleSaveEdits = () => {
    setIsEditing(false);
    if (onEdit) onEdit(editedAnalysis);
  };

  const handleConfirm = () => {
    onConfirm(editedAnalysis);
  };

  const displayAnalysis = isEditing ? editedAnalysis : analysis;

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Mobile Back Button */}
        <div className="mb-4 md:mb-6">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 touch-manipulation active:scale-95 p-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="text-sm md:text-base">Back</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                  Confirm Safety Form Analysis
                </h2>
                {fileName && <p className="text-sm text-gray-600">{fileName}</p>}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Form Type Section */}
            <div className="bg-gray-50 rounded-lg p-3 md:p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base md:text-lg font-medium text-gray-900">Form Details</h3>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 touch-manipulation"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="text-sm">Edit</span>
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Form Type
                  </label>
                  {isEditing ? (
                    <select
                      value={displayAnalysis.formType}
                      onChange={(e) => handleFormTypeChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      {formTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {formTypeOptions.find(opt => opt.value === displayAnalysis.formType)?.label || displayAnalysis.formType}
                      </span>
                      {displayAnalysis.formTypeConfidence && (
                        <span className={`px-2 py-1 rounded text-xs ${
                          displayAnalysis.formTypeConfidence === 'HIGH' ? 'bg-green-100 text-green-700' :
                          displayAnalysis.formTypeConfidence === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {displayAnalysis.formTypeConfidence} confidence
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Work Location
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={displayAnalysis.workLocation || ''}
                      onChange={(e) => setEditedAnalysis(prev => ({
                        ...prev,
                        workLocation: e.target.value
                      }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Enter work location"
                    />
                  ) : (
                    <span className="text-gray-900">{displayAnalysis.workLocation || 'Not specified'}</span>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Activity
                </label>
                {isEditing ? (
                  <textarea
                    value={displayAnalysis.workActivity || ''}
                    onChange={(e) => setEditedAnalysis(prev => ({
                      ...prev,
                      workActivity: e.target.value
                    }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={2}
                    placeholder="Describe the work activity"
                  />
                ) : (
                  <span className="text-gray-900">{displayAnalysis.workActivity || 'Not specified'}</span>
                )}
              </div>
            </div>

            {/* Risk Assessment Section */}
            <div className="bg-gray-50 rounded-lg p-3 md:p-4">
              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-3">Risk Assessment</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Score
                  </label>
                  {isEditing ? (
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={displayAnalysis.riskScore}
                      onChange={(e) => handleRiskScoreChange(e.target.value)}
                      className="w-full"
                    />
                  ) : null}
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-2xl font-bold text-gray-900">
                      {displayAnalysis.riskScore}/10
                    </span>
                    {isEditing && (
                      <span className="text-sm text-gray-500">
                        (Slide to adjust)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Level
                  </label>
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-md ${riskLevelColors[displayAnalysis.riskLevel]}`}>
                    {getRiskIcon(displayAnalysis.riskLevel)}
                    <span className="font-medium">{displayAnalysis.riskLevel}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supervisor Review
                  </label>
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-md ${
                    displayAnalysis.requiresSupervisorReview ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                  }`}>
                    <Shield className="w-4 h-4" />
                    <span className="font-medium text-sm">
                      {displayAnalysis.requiresSupervisorReview ? 'Required' : 'Not Required'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Safety Issues */}
            {displayAnalysis.flaggedIssues && displayAnalysis.flaggedIssues.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <h3 className="text-base md:text-lg font-medium text-gray-900 mb-3">
                  Safety Issues Found ({displayAnalysis.flaggedIssues.length})
                </h3>
                <div className="space-y-3">
                  {displayAnalysis.flaggedIssues.map((issue, index) => (
                    <div key={index} className="bg-white rounded-md p-3 border-l-4 border-yellow-400">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1 flex-wrap">
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
                          <p className="text-gray-900 font-medium text-sm">{issue.description}</p>
                          <p className="text-gray-600 text-xs mt-1">{issue.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PPE Requirements */}
            {displayAnalysis.ppeRequired && displayAnalysis.ppeRequired.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <h3 className="text-base md:text-lg font-medium text-gray-900 mb-3">
                  PPE Requirements ({displayAnalysis.ppeRequired.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayAnalysis.ppeRequired.map((ppe, index) => (
                    <div key={index} className="flex items-center space-x-3 bg-white rounded-md p-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${ppe.mandatory ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900 text-sm">{ppe.type.replace('_', ' ')}</span>
                        {ppe.specification && (
                          <p className="text-xs text-gray-600 truncate">{ppe.specification}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ${
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
            <div className="bg-gray-50 rounded-lg p-3 md:p-4">
              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-3">Form Completeness</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Completeness Status
                  </label>
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
                    displayAnalysis.formCompleteness === 'COMPLETE' ? 'bg-green-100 text-green-800' :
                    displayAnalysis.formCompleteness === 'PARTIALLY_COMPLETE' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {displayAnalysis.formCompleteness?.replace('_', ' ') || 'Unknown'}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Worker Signatures
                  </label>
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
                    displayAnalysis.workerDetails?.signaturesPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {displayAnalysis.workerDetails?.signaturesPresent ? 'Present' : 'Missing'}
                  </span>
                </div>
              </div>

              {displayAnalysis.missingFields && displayAnalysis.missingFields.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Missing Information
                  </label>
                  <div className="space-y-1">
                    {displayAnalysis.missingFields.map((field, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-xs md:text-sm text-gray-700">{field}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {displayAnalysis.positiveFindings && displayAnalysis.positiveFindings.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Positive Safety Practices
                  </label>
                  <div className="space-y-1">
                    {displayAnalysis.positiveFindings.map((finding, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-xs md:text-sm text-gray-700">{finding}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Compliance Issues */}
            {displayAnalysis.complianceIssues && displayAnalysis.complianceIssues.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <h3 className="text-base md:text-lg font-medium text-gray-900 mb-3">
                  Compliance Issues ({displayAnalysis.complianceIssues.length})
                </h3>
                <div className="space-y-3">
                  {displayAnalysis.complianceIssues.map((issue, index) => (
                    <div key={index} className="bg-white rounded-md p-3 border-l-4 border-red-400">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1 flex-wrap">
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
                          <p className="text-gray-900 font-medium text-sm">{issue.issue}</p>
                          <p className="text-gray-600 text-xs mt-1">{issue.action}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {displayAnalysis.summary && (
              <div className="bg-blue-50 rounded-lg p-3 md:p-4">
                <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">Analysis Summary</h3>
                <p className="text-sm md:text-base text-gray-700">{displayAnalysis.summary}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-4 md:p-6 border-t border-gray-200 bg-gray-50">
            {isEditing ? (
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between space-y-3 md:space-y-0">
                <div className="flex flex-col md:flex-row items-stretch md:items-center space-y-3 md:space-y-0 md:space-x-3">
                  <button
                    onClick={handleSaveEdits}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 touch-manipulation"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedAnalysis(analysis);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 touch-manipulation"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between space-y-3 md:space-y-0">
                <button
                  onClick={onBack}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 touch-manipulation"
                >
                  Back to Upload
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-6 py-3 md:py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium touch-manipulation active:scale-95"
                >
                  {(displayAnalysis.riskScore >= 7 || displayAnalysis.riskLevel === 'CRITICAL' || displayAnalysis.riskLevel === 'HIGH') ? 
                  'Submit for Supervisor Review' : 
                  'Confirm & Save'
                }
                </button>
              </div>
            )}
          </div>

          {/* Warning Banner for High Risk */}
          {displayAnalysis.requiresSupervisorReview && (
            <div className="bg-red-50 border-t border-red-200 p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 font-medium text-sm md:text-base">
                    Supervisor Review Required
                  </p>
                  <p className="text-red-700 text-xs md:text-sm">
                    This form has been flagged for supervisor review due to {displayAnalysis.riskLevel.toLowerCase()} risk level or compliance issues.
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

export default FormAnalysisConfirmation;