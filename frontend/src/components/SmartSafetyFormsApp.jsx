import React, { useState, useCallback } from 'react';
import { Upload, FileText, Loader, CheckCircle, AlertTriangle, XCircle, Eye, Zap, Archive, Settings } from 'lucide-react';
import FormAnalysisConfirmation from './FormAnalysisConfirmation';

const SmartSafetyFormsApp = () => {
  const [currentMode, setCurrentMode] = useState('INTERACTIVE'); // INTERACTIVE, BULK, BATCH
  const [currentStep, setCurrentStep] = useState('mode-select'); 
  const [files, setFiles] = useState([]); // Multiple files for bulk
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);

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
    setAnalysisResults([]);
    setError(null);
  };

  const handleFileSelect = useCallback((event) => {
    const selectedFiles = Array.from(event.target.files);
    
    if (selectedFiles.length === 0) return;

    // Validate files
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

      return {
        file: file.name,
        index,
        success: true,
        result: currentMode === 'INTERACTIVE' ? result : convertUploadToConfirmation(result, file),
        needsReview: shouldFlagForReview(result),
        riskLevel: getRiskLevel(result),
        processingTime: result.processingTime || result.processing?.totalTimeMs
      };

    } catch (error) {
      return {
        file: file.name,
        index,
        success: false,
        error: error.message,
        needsReview: true
      };
    }
  };

  const shouldFlagForReview = (result) => {
    const analysis = result.analysis || result.result;
    return (
      analysis.riskScore >= 7 ||
      analysis.riskLevel === 'HIGH' || 
      analysis.riskLevel === 'CRITICAL' ||
      analysis.requiresSupervisorReview ||
      analysis.formCompleteness === 'INCOMPLETE' ||
      (analysis.complianceIssues && analysis.complianceIssues.length > 0)
    );
  };

  const getRiskLevel = (result) => {
    const analysis = result.analysis || result.result;
    return analysis.riskLevel || analysis.riskAssessment?.level || 'UNKNOWN';
  };

  const convertUploadToConfirmation = (uploadResult, file) => {
    return {
      success: true,
      status: 'completed',
      analysis: {
        formType: uploadResult.result.formType,
        formTypeConfidence: 'HIGH',
        riskScore: uploadResult.result.riskAssessment.score,
        riskLevel: uploadResult.result.riskAssessment.level,
        flaggedIssues: uploadResult.result.safetyIssues || [],
        complianceIssues: uploadResult.result.complianceCheck?.gaps || [],
        summary: uploadResult.result.riskAssessment.reasoning || 'Analysis completed',
        requiresSupervisorReview: uploadResult.result.riskAssessment.score >= 7,
        formCompleteness: 'COMPLETE',
        missingFields: [],
        positiveFindings: []
      },
      fileInfo: {
        originalFilename: file.name,
        fileSize: file.size
      }
    };
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
      // Process single file for confirmation
      const result = await processFile(files[0]);
      setAnalysisResults([result]);
      
      if (result.success) {
        setCurrentStep('confirmation');
      } else {
        setError(result.error);
        setCurrentStep('upload');
      }
    } else {
      // Bulk/Batch processing
      const results = [];
      
      for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i);
        const result = await processFile(files[i], i);
        results.push(result);
        setAnalysisResults([...results]); // Update UI as we go
        
        // For BATCH mode, pause on flagged items
        if (currentMode === 'BATCH' && result.needsReview && result.success) {
          setCurrentStep('review-flagged');
          setProcessing(false);
          return; // Pause for user review
        }
      }
      
      setCurrentStep('bulk-complete');
    }
    
    setProcessing(false);
  };

  const confirmAnalysis = async (confirmedAnalysis) => {
    // Handle confirmation for interactive mode
    setCurrentStep('completed');
  };

  const continueBatchProcessing = () => {
    // Continue after reviewing flagged item
    setCurrentStep('processing');
    setProcessing(true);
    // Continue from next file...
  };

  const goToReports = () => {
    setCurrentStep('reports');
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
                  className={`p-6 rounded-lg border-2 hover:shadow-lg transition-all ${config.color}`}
                >
                  <div className="text-center">
                    <Icon className="w-12 h-12 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
                    <p className="text-sm mb-3">{config.description}</p>
                    <p className="text-xs opacity-75">{config.useCase}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <button
              onClick={goToReports}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <FileText className="w-5 h-5" />
              <span>View Reports & Analytics</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // File Upload Screen
  if (currentStep === 'upload') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {uploadModes[currentMode].title}
              </h2>
              <p className="text-gray-600">{uploadModes[currentMode].description}</p>
            </div>
            <button
              onClick={() => setCurrentStep('mode-select')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Change Mode
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => document.getElementById('fileInput').click()}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg text-gray-600 mb-2">
                {files.length > 0 ? 
                  `${files.length} file${files.length > 1 ? 's' : ''} selected` : 
                  `Select ${currentMode === 'INTERACTIVE' ? 'a file' : 'files'} for ${currentMode.toLowerCase()} processing`
                }
              </p>
              <p className="text-sm text-gray-500">
                {currentMode === 'INTERACTIVE' ? 'Single image file up to 10MB' : 'Multiple image files up to 10MB each'}
              </p>
              <input
                id="fileInput"
                type="file"
                accept="image/*"
                multiple={currentMode !== 'INTERACTIVE'}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {files.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium text-gray-900 mb-3">Selected Files:</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={startProcessing}
                  disabled={processing}
                  className="mt-4 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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

  return null;
};

export default SmartSafetyFormsApp;