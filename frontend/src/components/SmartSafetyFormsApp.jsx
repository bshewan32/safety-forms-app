import React, { useState, useCallback } from 'react';
import { Upload, FileText, Loader, CheckCircle, AlertTriangle, XCircle, Eye, Zap, Archive, ArrowLeft, Download, Mail } from 'lucide-react';
import FormAnalysisConfirmation from './FormAnalysisConfirmation';
import DetailedReportView from './DetailedReportView';

const SmartSafetyFormsApp = () => {
  const [currentMode, setCurrentMode] = useState('INTERACTIVE');
  const [currentStep, setCurrentStep] = useState('mode-select'); 
  const [files, setFiles] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [selectedReportIndex, setSelectedReportIndex] = useState(null);

  const uploadModes = {
    INTERACTIVE: {
      title: 'Interactive Review',
      description: 'Review and confirm each form individually',
      icon: Eye,
      color: 'bg-blue-50 border-blue-200 text-blue-700',
      useCase: 'Single forms, critical analysis, training'
    },
    BULK: {
      title: 'Bulk Processing',
      description: 'Automatically process multiple forms',
      icon: Zap,
      color: 'bg-green-50 border-green-200 text-green-700',
      useCase: 'Historical digitization, large batches'
    },
    BATCH: {
      title: 'Smart Batch',
      description: 'Auto-process, review only flagged issues',
      icon: Archive,
      color: 'bg-purple-50 border-purple-200 text-purple-700',
      useCase: 'Regular processing with oversight'
    }
  };

  const handleModeSelect = (mode) => {
    setCurrentMode(mode);
    setCurrentStep('upload');
    setFiles([]);
    setError(null);
  };

  const handleFileSelect = useCallback((event) => {
    const selectedFiles = Array.from(event.target.files);
    
    if (selectedFiles.length === 0) return;

    const validFiles = selectedFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (currentMode === 'INTERACTIVE' && validFiles.length > 1) {
      setError('Interactive mode processes one file at a time');
      return;
    }

    setFiles(validFiles);
    setError(null);
  }, [currentMode]);

  const processFile = async (file, index = 0) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const headers = {};
      if (sessionToken) headers['x-session-token'] = sessionToken;

      const endpoint = currentMode === 'INTERACTIVE' ? '/api/forms/analyze' : '/api/forms/upload';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze form');
      }

      if (result.sessionToken) setSessionToken(result.sessionToken);

      // Parse response - handle both interactive (/analyze) and bulk (/upload) structures
      let formType, riskLevel, riskScore;
      
      if (currentMode === 'INTERACTIVE') {
        formType = result.analysis?.formType || 'UNKNOWN';
        riskLevel = result.analysis?.riskLevel || 'UNKNOWN';
        riskScore = result.analysis?.riskScore || 0;
      } else {
        formType = result.result?.formType || result.formType || 'UNKNOWN';
        riskLevel = result.result?.riskAssessment?.level || result.riskLevel || 'UNKNOWN';
        riskScore = result.result?.riskAssessment?.score || result.riskScore || 0;
      }

      return {
        file: file.name,
        index,
        success: true,
        result: result,
        formType: formType,
        riskLevel: riskLevel,
        riskScore: riskScore,
        needsReview: riskScore >= 8,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        file: file.name,
        index,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  const startProcessing = async () => {
    if (files.length === 0) {
      setError('Please select files first');
      return;
    }

    setProcessing(true);
    setError(null);
    setCurrentStep('processing');
    setAnalysisResults([]);

    if (currentMode === 'INTERACTIVE') {
      const result = await processFile(files[0]);
      setAnalysisResults([result]);
      
      if (result.success) {
        setCurrentStep('confirmation');
      } else {
        setError(result.error);
        setCurrentStep('upload');
      }
    } else {
      const results = [];
      
      for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i);
        const result = await processFile(files[i], i);
        results.push(result);
        setAnalysisResults([...results]);
        
        if (currentMode === 'BATCH' && result.needsReview && result.success) {
          setCurrentStep('review-flagged');
          setProcessing(false);
          return;
        }
      }
      
      setCurrentStep('bulk-complete');
    }
    
    setProcessing(false);
  };

  const confirmAnalysis = async (confirmedAnalysis) => {
    setCurrentStep('completed');
  };

  const goToReports = () => {
    setCurrentStep('reports');
  };

  const viewDetailedReport = (index) => {
    setSelectedReportIndex(index);
    setCurrentStep('detailed-report');
  };

  const getRiskColor = (level) => {
    switch(level) {
      case 'LOW': return 'text-green-600 bg-green-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'HIGH': return 'text-red-600 bg-red-50';
      case 'CRITICAL': return 'text-red-800 bg-red-100';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRiskBadgeColor = (level) => {
    switch(level) {
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
      case 'CRITICAL': return 'bg-red-200 text-red-900 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Mode Selection Screen
  if (currentStep === 'mode-select') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Safety Forms Analyzer
            </h1>
            <p className="text-gray-600">
              Choose your processing mode
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(uploadModes).map(([mode, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={mode}
                  onClick={() => handleModeSelect(mode)}
                  className={`p-6 rounded-lg border-2 ${config.color} hover:shadow-lg transition-all text-left`}
                >
                  <Icon className="w-8 h-8 mb-3" />
                  <h3 className="font-semibold text-lg mb-2">{config.title}</h3>
                  <p className="text-sm mb-3 opacity-80">{config.description}</p>
                  <p className="text-xs opacity-70">Best for: {config.useCase}</p>
                </button>
              );
            })}
          </div>

          {/* View Past Reports Button */}
          {analysisResults.length > 0 && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setCurrentStep('reports')}
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors inline-flex items-center space-x-2"
              >
                <FileText className="w-5 h-5" />
                <span>View Recent Reports ({analysisResults.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Upload Screen
  if (currentStep === 'upload') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-6">
            <button
              onClick={() => setCurrentStep('mode-select')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Mode Selection
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              {uploadModes[currentMode].title}
            </h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/*"
                multiple={currentMode !== 'INTERACTIVE'}
                onChange={handleFileSelect}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Select Files
              </label>
              <p className="text-gray-600 mt-4">
                {currentMode === 'INTERACTIVE' ? 
                  'Select a single image file' :
                  'Select multiple image files'
                }
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Supported formats: JPG, PNG (max 10MB each)
              </p>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {files.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium text-gray-900 mb-3">
                  Selected Files ({files.length})
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-medium">{file.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={startProcessing}
                  disabled={processing}
                  className="w-full mt-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {processing ? (
                    <span className="flex items-center justify-center space-x-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </span>
                  ) : (
                    <span>Start {currentMode} Processing</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Processing Screen
  if (currentStep === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <Loader className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Processing Forms
            </h2>
            <p className="text-gray-600 mb-6">
              {currentMode === 'INTERACTIVE' ? 
                'Analyzing your safety form...' :
                `Processing file ${currentFileIndex + 1} of ${files.length}`
              }
            </p>
            
            {currentMode !== 'INTERACTIVE' && (
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentFileIndex + 1) / files.length) * 100}%` }}
                />
              </div>
            )}

            {analysisResults.length > 0 && (
              <div className="mt-6 text-left">
                <h3 className="font-medium text-gray-900 mb-3">Processing Results:</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {analysisResults.map((result, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 rounded ${
                      result.success ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <div className="flex items-center space-x-3">
                        {result.success ? 
                          <CheckCircle className="w-5 h-5 text-green-600" /> :
                          <XCircle className="w-5 h-5 text-red-600" />
                        }
                        <span className="text-sm font-medium">{result.file}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {result.success && (
                          <>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(result.riskLevel)}`}>
                              {result.riskLevel}
                            </span>
                            {result.needsReview && (
                              <AlertTriangle className="w-4 h-4 text-yellow-600" title="Needs Review" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Interactive Confirmation
  if (currentStep === 'confirmation' && analysisResults[0]?.success) {
    return (
      <FormAnalysisConfirmation
        analysisResult={analysisResults[0].result.analysis}
        fileName={analysisResults[0].file}
        onConfirm={confirmAnalysis}
        onCancel={() => setCurrentStep('upload')}
        onEdit={(editedAnalysis) => {
          // Handle edits
        }}
      />
    );
  }

  // Completed (Interactive)
  if (currentStep === 'completed') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Analysis Complete!
            </h2>
            <p className="text-gray-600 mb-6">
              Form has been analyzed and saved
            </p>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => {
                  setCurrentStep('mode-select');
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Analyze Another Form
              </button>
              <button
                onClick={() => viewDetailedReport(0)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View Full Report
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Bulk Processing Complete
  if (currentStep === 'bulk-complete') {
    const successCount = analysisResults.filter(r => r.success).length;
    const errorCount = analysisResults.filter(r => !r.success).length;
    const flaggedCount = analysisResults.filter(r => r.needsReview && r.success).length;

    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Bulk Processing Complete!
              </h2>
              <p className="text-gray-600">
                Processed {analysisResults.length} forms
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <h3 className="font-medium text-green-900 mb-1">Successful</h3>
                <p className="text-2xl font-bold text-green-600">{successCount}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <h3 className="font-medium text-yellow-900 mb-1">Need Review</h3>
                <p className="text-2xl font-bold text-yellow-600">{flaggedCount}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <h3 className="font-medium text-red-900 mb-1">Failed</h3>
                <p className="text-2xl font-bold text-red-600">{errorCount}</p>
              </div>
            </div>

            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setCurrentStep('mode-select')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Process More Forms
              </button>
              <button
                onClick={goToReports}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View Detailed Reports
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reports List View
  if (currentStep === 'reports') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep('mode-select')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Main Menu
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Analysis Reports</h1>
            <div className="w-32"></div>
          </div>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="space-y-4">
                {analysisResults.map((result, index) => (
                  <div 
                    key={index} 
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => viewDetailedReport(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {result.success ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <h3 className="font-medium text-gray-900">{result.file}</h3>
                        </div>
                        
                        {result.success && (
                          <div className="flex items-center space-x-4 text-sm text-gray-600 ml-8">
                            <span className="flex items-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium mr-2 ${getRiskBadgeColor(result.riskLevel)}`}>
                                {result.riskLevel}
                              </span>
                              Risk Score: {result.riskScore}/10
                            </span>
                            <span>Type: {result.formType}</span>
                            <span>Analyzed: {new Date(result.timestamp).toLocaleString()}</span>
                          </div>
                        )}
                        
                        {!result.success && (
                          <div className="ml-8 text-sm text-red-600">
                            Error: {result.error}
                          </div>
                        )}
                      </div>
                      
                      <Eye className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced Detailed Report View
  // Detailed Report View
  if (currentStep === 'detailed-report' && selectedReportIndex !== null) {
    return (
      <DetailedReportView
        report={analysisResults[selectedReportIndex]}
        onBack={() => {
          setSelectedReportIndex(null);
          setCurrentStep('reports');
        }}
      />
    );
  }

  return null;
};

export default SmartSafetyFormsApp;