import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, Loader, CheckCircle, AlertTriangle, XCircle, Eye, Zap, Archive, ArrowLeft, Download, Mail, Camera, X } from 'lucide-react';
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
  
  // Mobile-specific state
  const [isMobile, setIsMobile] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraSupported, setCameraSupported] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Detect mobile and camera support
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    // Check camera support
    const checkCamera = () => {
      const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost';
      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      setCameraSupported(isSecureContext && hasMediaDevices);
      
      if (!isSecureContext) {
        console.warn('⚠️ Camera requires HTTPS or localhost. Current:', window.location.protocol);
      }
    };
    
    checkMobile();
    checkCamera();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load saved reports from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('safetyReports');
    if (saved) {
      try {
        setAnalysisResults(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved reports:', e);
      }
    }
  }, []);

  // Save reports to localStorage whenever they change
  useEffect(() => {
    if (analysisResults.length > 0) {
      localStorage.setItem('safetyReports', JSON.stringify(analysisResults));
    }
  }, [analysisResults]);

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

  // Camera functions
  const startCamera = async () => {
    if (!cameraSupported) {
      setError('Camera not available. Please use "Select from Gallery" instead. (Camera requires HTTPS or localhost)');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      setCameraStream(stream);
      setShowCamera(true);
      
      // Set video stream once component is mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      setError('Camera access denied. Please enable camera permissions or use "Select from Gallery".');
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      const timestamp = new Date().getTime();
      const file = new File([blob], `safety-form-${timestamp}.jpg`, { type: 'image/jpeg' });
      
      setFiles([file]);
      stopCamera();
      setError(null);
    }, 'image/jpeg', 0.95);
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
      
      console.log('📤 Sending request to:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers
      });

      const result = await response.json();
      console.log('📥 Received response:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze form');
      }

      if (result.sessionToken) setSessionToken(result.sessionToken);

      // Parse response - handle both interactive (/analyze) and bulk (/upload) structures
      let formType, riskLevel, riskScore, fullAnalysis;
      
      if (currentMode === 'INTERACTIVE') {
        // Interactive mode uses result.analysis structure
        fullAnalysis = result.analysis;
        formType = result.analysis?.formType || 'UNKNOWN';
        riskLevel = result.analysis?.riskLevel || 'UNKNOWN';
        riskScore = result.analysis?.riskScore || 0;
      } else {
        // Bulk/Batch mode uses result.result structure
        fullAnalysis = result.result;
        formType = result.result?.formType || 'UNKNOWN';
        riskLevel = result.result?.riskAssessment?.level || 'UNKNOWN';
        riskScore = result.result?.riskAssessment?.score || 0;
      }

      console.log('✅ Parsed analysis:', { formType, riskLevel, riskScore, fullAnalysis });

      return {
        file: file.name,
        formType,
        riskLevel,
        riskScore,
        timestamp: new Date().toISOString(),
        fullAnalysis
      };
    } catch (error) {
      console.error('❌ Error processing file:', error);
      throw error;
    }
  };

  const startProcessing = async () => {
    console.log('🚀 Starting processing', { mode: currentMode, files: files.length });
    setProcessing(true);
    setError(null);

    try {
      if (currentMode === 'INTERACTIVE') {
        console.log('📝 Processing in INTERACTIVE mode');
        const result = await processFile(files[0], 0);
        console.log('✅ Processing complete, result:', result);
        
        // Store the result
        setAnalysisResults([result]);
        
        // Move to confirmation step
        setCurrentStep('confirmation');
        console.log('🎯 Set step to confirmation');
      } else {
        const results = [];
        for (let i = 0; i < files.length; i++) {
          setCurrentFileIndex(i);
          try {
            const result = await processFile(files[i], i);
            results.push(result);
          } catch (err) {
            results.push({
              file: files[i].name,
              error: err.message,
              status: 'failed'
            });
          }
        }
        setAnalysisResults(results);
        setCurrentStep('bulk-complete');
      }
    } catch (error) {
      console.error('❌ Processing error:', error);
      setError(error.message);
    } finally {
      setProcessing(false);
      setCurrentFileIndex(0);
    }
  };

  const handleConfirmAnalysis = async (confirmedData) => {
  try {
    console.log('💾 Confirming analysis...');
    
    // Get the original file info
    const file = files[0];
    
    // Build the correct request body that backend expects
    const requestBody = {
      sessionToken: sessionToken,
      sessionId: sessionToken,
      confirmedAnalysis: confirmedData,
      tempData: {
        ocrText: confirmedData.ocrText || '',
        confidence: confirmedData.ocrConfidence || 100,
        patterns: confirmedData.patterns || {}
      },
      fileInfo: {
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString()
      },
      userCorrections: {}
    };
    
    console.log('📤 Sending to backend:', requestBody);
    
    const response = await fetch('/api/forms/confirm', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(sessionToken && { 'x-session-token': sessionToken })
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    console.log('Response:', response.status, result);

    if (!response.ok) {
      // Continue with local save on validation errors
      if (response.status === 400) {
        console.log('⚠️ Backend validation error - saving locally');
        setCurrentStep('completed');
        return;
      }
      throw new Error(result.error || 'Failed to save');
    }

    console.log('✅ Saved successfully!');
    setCurrentStep('completed');
    
  } catch (error) {
    console.error('❌ Error:', error);
    setError('Warning: Could not save to database. Report saved locally.');
    setTimeout(() => setCurrentStep('completed'), 2000);
  }
};

  const getRiskColor = (level) => {
    switch(level) {
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
      case 'CRITICAL': return 'bg-red-200 text-red-900 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const clearReports = () => {
    if (window.confirm('Are you sure you want to clear all saved reports?')) {
      setAnalysisResults([]);
      localStorage.removeItem('safetyReports');
    }
  };

  // Camera Modal Component
  const CameraModal = () => (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Camera Header */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Capture Safety Form</h2>
        <button
          onClick={stopCamera}
          className="p-2 hover:bg-gray-800 rounded-full"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {/* Overlay guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="border-4 border-white border-dashed rounded-lg w-11/12 h-4/5 opacity-50" />
        </div>

        {/* Instructions */}
        <div className="absolute top-4 left-0 right-0 text-center">
          <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg inline-block mx-auto">
            <p className="text-sm">Position the form within the frame</p>
          </div>
        </div>
      </div>

      {/* Capture Button */}
      <div className="bg-gray-900 p-6 flex justify-center">
        <button
          onClick={capturePhoto}
          className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:bg-gray-200 transition-all shadow-lg"
        >
          <Camera className="w-10 h-10 text-gray-900" />
        </button>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );

  // Debug logging for step changes
  useEffect(() => {
    console.log('📍 Step changed:', currentStep);
    console.log('📊 Analysis results:', analysisResults);
  }, [currentStep, analysisResults]);

  // Mode Selection Screen
  if (currentStep === 'mode-select') {
    return (
      <div className="min-h-screen bg-gray-50 py-4 md:py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Safety Forms Analyzer
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Choose your processing mode
            </p>
          </div>

          {/* Mobile: Stack cards, Desktop: Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {Object.entries(uploadModes).map(([mode, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={mode}
                  onClick={() => handleModeSelect(mode)}
                  className={`p-4 md:p-6 rounded-lg border-2 ${config.color} hover:shadow-lg transition-all text-left active:scale-95 touch-manipulation`}
                >
                  <Icon className="w-6 h-6 md:w-8 md:h-8 mb-2 md:mb-3" />
                  <h3 className="font-semibold text-base md:text-lg mb-1 md:mb-2">{config.title}</h3>
                  <p className="text-xs md:text-sm mb-2 md:mb-3 opacity-80">{config.description}</p>
                  <p className="text-xs opacity-70">Best for: {config.useCase}</p>
                </button>
              );
            })}
          </div>

          {/* View Past Reports Button */}
          {analysisResults.length > 0 && (
            <div className="mt-6 md:mt-8 text-center space-y-3">
              <button
                onClick={() => setCurrentStep('reports')}
                className="w-full md:w-auto px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors inline-flex items-center justify-center space-x-2 touch-manipulation active:scale-95"
              >
                <FileText className="w-5 h-5" />
                <span>View Recent Reports ({analysisResults.length})</span>
              </button>
              
              <button
                onClick={clearReports}
                className="w-full md:w-auto px-4 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors touch-manipulation"
              >
                Clear All Reports
              </button>
            </div>
          )}

          {/* Camera support notice */}
          {isMobile && !cameraSupported && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Note:</strong> Direct camera capture requires HTTPS. Use "Select from Gallery" to take photos with your camera app.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Upload Screen
  if (currentStep === 'upload') {
    return (
      <div className="min-h-screen bg-gray-50 py-4 md:py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-4 md:mb-6">
            <button
              onClick={() => setCurrentStep('mode-select')}
              className="flex items-center text-gray-600 hover:text-gray-900 touch-manipulation active:scale-95 p-2 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="text-sm md:text-base">Back to Mode Selection</span>
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 md:mb-6">
              {uploadModes[currentMode].title}
            </h2>

            {/* Mobile Camera Button - only show if camera supported */}
            {isMobile && currentMode === 'INTERACTIVE' && cameraSupported && (
              <button
                onClick={startCamera}
                className="w-full mb-4 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 touch-manipulation active:scale-95 text-lg font-medium"
              >
                <Camera className="w-6 h-6" />
                <span>Take Photo</span>
              </button>
            )}

            {/* Divider for mobile */}
            {isMobile && currentMode === 'INTERACTIVE' && cameraSupported && (
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>
            )}

            {/* File Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-12 text-center hover:border-blue-400 transition-colors">
              <Upload className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 md:mb-4" />
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/*"
                capture={isMobile && currentMode === 'INTERACTIVE' ? 'environment' : undefined}
                multiple={currentMode !== 'INTERACTIVE'}
                onChange={handleFileSelect}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-block px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 touch-manipulation active:scale-95 text-sm md:text-base"
              >
                {isMobile && currentMode === 'INTERACTIVE' ? 'Take Photo or Select from Gallery' : 'Select Files'}
              </label>
              <p className="text-sm md:text-base text-gray-600 mt-3 md:mt-4">
                {currentMode === 'INTERACTIVE' ? 
                  'Select a single image file' :
                  'Select multiple image files'
                }
              </p>
              <p className="text-xs md:text-sm text-gray-500 mt-2">
                Supported formats: JPG, PNG (max 10MB each)
              </p>
            </div>

            {error && (
              <div className="mt-4 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm md:text-base">
                {error}
              </div>
            )}

            {files.length > 0 && (
              <div className="mt-4 md:mt-6">
                <h3 className="font-medium text-gray-900 mb-3 text-sm md:text-base">
                  Selected Files ({files.length})
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3 min-w-0">
                        <FileText className="w-4 h-4 md:w-5 md:h-5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs md:text-sm font-medium truncate">{file.name}</span>
                      </div>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={startProcessing}
                  disabled={processing}
                  className="w-full mt-4 md:mt-6 py-3 md:py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center touch-manipulation active:scale-95 text-sm md:text-base font-medium"
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

        {/* Camera Modal */}
        {showCamera && <CameraModal />}
      </div>
    );
  }

  // Processing Screen
  if (currentStep === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 max-w-md w-full">
          <div className="text-center">
            <Loader className="w-12 h-12 md:w-16 md:h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">
              Analyzing Safety Form
            </h2>
            <p className="text-sm md:text-base text-gray-600 mb-4">
              Processing file {currentFileIndex + 1} of {files.length}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 md:h-3 mb-4">
              <div 
                className="bg-blue-600 h-2 md:h-3 rounded-full transition-all duration-500"
                style={{ width: `${((currentFileIndex + 1) / files.length) * 100}%` }}
              />
            </div>
            <p className="text-xs md:text-sm text-gray-500">
              This may take up to 60 seconds per form
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation Screen (Interactive Mode)
  if (currentStep === 'confirmation' && analysisResults.length > 0) {
    console.log('🎯 RENDERING CONFIRMATION');
    console.log('Analysis to pass:', analysisResults[0]?.fullAnalysis);
    
    // Make sure we have the analysis data
    if (!analysisResults[0]?.fullAnalysis) {
      console.error('❌ Missing fullAnalysis!', analysisResults[0]);
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-bold text-red-800 mb-2">Error: No Analysis Data</h2>
            <p className="text-red-700 mb-4">The analysis completed but no data was returned.</p>
            <pre className="text-xs bg-white p-2 rounded overflow-auto mb-4">
              {JSON.stringify(analysisResults[0], null, 2)}
            </pre>
            <button
              onClick={() => setCurrentStep('upload')}
              className="w-full py-3 bg-gray-600 text-white rounded-lg"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <FormAnalysisConfirmation
        analysis={analysisResults[0].fullAnalysis}
        onConfirm={handleConfirmAnalysis}
        onBack={() => setCurrentStep('upload')}
      />
    );
  }

  // Completed Screen
  if (currentStep === 'completed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 max-w-md w-full text-center">
          <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">
            Analysis Complete!
          </h2>
          <p className="text-sm md:text-base text-gray-600 mb-6">
            Your safety form has been processed and saved.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setSelectedReportIndex(0)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation active:scale-95"
            >
              View Full Report
            </button>
            <button
              onClick={() => {
                setFiles([]);
                setCurrentStep('mode-select');
              }}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors touch-manipulation active:scale-95"
            >
              Analyze Another Form
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Bulk Complete Screen
  if (currentStep === 'bulk-complete') {
    const successful = analysisResults.filter(r => !r.error).length;
    const failed = analysisResults.filter(r => r.error).length;

    return (
      <div className="min-h-screen bg-gray-50 py-4 md:py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
            <div className="text-center mb-6 md:mb-8">
              <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">
                Bulk Processing Complete
              </h2>
              <p className="text-sm md:text-base text-gray-600">
                Processed {files.length} forms
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="bg-green-50 p-4 md:p-6 rounded-lg text-center">
                <p className="text-xl md:text-3xl font-bold text-green-600 mb-1">{successful}</p>
                <p className="text-xs md:text-sm text-green-700">Successful</p>
              </div>
              {failed > 0 && (
                <div className="bg-red-50 p-4 md:p-6 rounded-lg text-center">
                  <p className="text-xl md:text-3xl font-bold text-red-600 mb-1">{failed}</p>
                  <p className="text-xs md:text-sm text-red-700">Failed</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setCurrentStep('reports')}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation active:scale-95"
              >
                View Detailed Reports
              </button>
              <button
                onClick={() => {
                  setFiles([]);
                  setCurrentStep('mode-select');
                }}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors touch-manipulation active:scale-95"
              >
                Process More Forms
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Detailed Report View - CHECK THIS FIRST before reports list!
  if (selectedReportIndex !== null) {
    return (
      <DetailedReportView
        report={analysisResults[selectedReportIndex]}
        onBack={() => setSelectedReportIndex(null)}
      />
    );
  }

  // Reports List Screen
  if (currentStep === 'reports') {
    return (
      <div className="min-h-screen bg-gray-50 py-4 md:py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-4 md:mb-6">
            <button
              onClick={() => setCurrentStep('mode-select')}
              className="flex items-center text-gray-600 hover:text-gray-900 touch-manipulation active:scale-95 p-2 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="text-sm md:text-base">Back to Main Menu</span>
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 md:mb-6">
              Recent Reports ({analysisResults.length})
            </h2>

            <div className="space-y-3 md:space-y-4">
              {analysisResults.map((report, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedReportIndex(index)}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all text-left touch-manipulation active:scale-98"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm md:text-base text-gray-900 truncate mb-1">
                        {report.file}
                      </h3>
                      <p className="text-xs md:text-sm text-gray-600">
                        {report.formType} • {new Date(report.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className={`ml-2 px-2 md:px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getRiskColor(report.riskLevel)}`}>
                      {report.riskLevel} {report.riskScore}/10
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SmartSafetyFormsApp;