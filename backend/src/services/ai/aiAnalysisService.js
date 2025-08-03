const logger = require('../utils/logger');

class MultiProviderAIService {
    constructor() {
        this.providers = [];
        this.initializeProviders();
    }

    initializeProviders() {
        // Initialize DeepSeek
        const deepSeekKey = process.env.DEEPSEEK_API_KEY;
        if (deepSeekKey) {
            this.deepseek = { apiKey: deepSeekKey };
            this.providers.push('deepseek');
            logger.info('DeepSeek provider initialized');
        } else {
            logger.warn('DeepSeek provider unavailable: DEEPSEEK_API_KEY is required');
        }

        // Initialize Gemini
        const geminiKey = process.env.GOOGLE_API_KEY;
        try {
            if (!geminiKey) {
                logger.info('No Gemini API key found, attempting to use Google Cloud ADC');
                this.gemini = null; // Will handle via fetch in the analysis method
            } else {
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                this.gemini = new GoogleGenerativeAI(geminiKey);
            }
            this.providers.push('gemini');
            logger.info('Gemini provider initialized');
        } catch (error) {
            logger.warn('Gemini provider initialization failed', { error: error.message });
        }

        // Initialize OpenAI
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
            this.openai = { apiKey: openaiKey };
            this.providers.push('openai');
            logger.info('OpenAI provider initialized');
        } else {
            logger.warn('OpenAI provider unavailable: OPENAI_API_KEY is required');
        }

        logger.info('AI Analysis Service initialized with providers: ' + this.providers.join(', '));
    }

    async analyzeSafetyForm(text, formType = null, metadata = {}) {
        logger.info('Starting multi-provider safety form analysis', {
            textLength: text.length,
            formType,
            availableProviders: this.providers
        });

        // DEBUG: Log the extracted text to see what OCR captured
        logger.info('OCR EXTRACTED TEXT DEBUG:', {
            textPreview: text.substring(0, 500),
            textLength: text.length,
            containsCheckmarks: text.includes('✓') || text.includes('✔'),
            containsXmarks: text.includes('✗') || text.includes('X') || text.includes('x'),
            checkmarkCount: (text.match(/[✓✔]/g) || []).length,
            xmarkCount: (text.match(/[✗xX]/g) || []).length
        });

        // DEBUG: Log specific violations we're looking for
        logger.info('PATTERN ANALYSIS DEBUG:', {
            h2sMonitorMissing: /H2S monitor worn within breathing zone(?!\s*☑)/i.test(text),
            hearingProtectionZero: /hearing protection worn\s*0/i.test(text),
            looseWorkSurfaces: /loose or uneven work surfaces/i.test(text),
            barricadeRemoval: /barricades.*removed/i.test(text),
            weatherConsidered: /weather conditions considered\s*☑/i.test(text),
            fallPreventionInPlace: /fall prevention in place/i.test(text),
            h2sLineFound: text.includes('H2S monitor'),
            hearingLineFound: text.includes('hearing protection'),
            sampleH2SContext: text.includes('H2S monitor') ? 'H2S monitor found in text' : 'H2S monitor not found',
            sampleHearingContext: text.includes('hearing protection') ? 'hearing protection found in text' : 'hearing protection not found'
        });

        logger.info("TESTING VIOLATION DETECTION:", {
          h2sViolation: /H2S monitor worn within breathing zone(?!\s*☑)/i.test(
            text
          ),
          testFunctionExists:
            typeof this.detectCriticalViolations === "function",
        });
        const startTime = Date.now();
        let lastError = null;

        // Try each provider in order
        for (const provider of this.providers) {
            try {
                logger.info(`Attempting analysis with ${provider}`);
                let result;

                switch (provider) {
                    case 'deepseek':
                        result = await this.analyzeWithDeepSeek(text, formType);
                        break;
                    case 'gemini':
                        result = await this.analyzeWithGemini(text, formType);
                        break;
                    case 'openai':
                        result = await this.analyzeWithOpenAI(text, formType);
                        break;
                    default:
                        logger.debug(`Provider ${provider} not available, skipping`);
                        continue;
                }

                if (result && result.formType && result.formType !== 'UNKNOWN') {
                    // Enhance the analysis with metadata
                    result.metadata = {
                        ...result.metadata,
                        processingTimeMs: Date.now() - startTime,
                        provider,
                        ...metadata
                    };

                    logger.info(`Analysis successful with ${provider}`, {
                        formType: result.formType,
                        riskScore: result.riskScore,
                        hazardCount: result.flaggedIssues?.length || result.hazards?.length || 0,
                        confidence: result.confidence || result.formTypeConfidence,
                        processingTime: `${Date.now() - startTime}ms`
                    });
                    
                    return result;
                }

            } catch (error) {
                lastError = error;
                logger.warn(`Provider ${provider} failed, trying next provider`, {
                    provider,
                    error: error.message,
                    errorType: error.constructor.name
                });
                continue;
            }
        }

        logger.error('All AI providers failed', {
            lastError: lastError?.message,
            attemptedProviders: this.providers
        });

        // Return enhanced fallback result
        return this.getFallbackAnalysis(text, lastError, Date.now() - startTime);
    }

    async analyzeWithDeepSeek(text, formType) {
        logger.info('Attempting DeepSeek safety form analysis', { provider: 'deepseek', textLength: text.length });
        
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.deepseek.apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{
                    role: 'system',
                    content: 'You are an expert Australian workplace safety officer with deep knowledge of Take 5, SWMS, JSA, JHA, and Hazard Assessment forms. Analyze workplace safety documentation and provide structured analysis in valid JSON format only.'
                }, {
                    role: 'user',
                    content: this.createEnhancedSafetyPrompt(text, formType)
                }],
                temperature: 0.1,
                max_tokens: 3000
            })
        });

        if (!response.ok) {
            throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const responseText = data.choices[0].message.content;
        
        const result = this.parseEnhancedAIResponse(responseText, text);
        
        if (result && result.formType && result.formType !== 'UNKNOWN') {
            logger.info('DeepSeek analysis successful', { 
                provider: 'deepseek', 
                formType: result.formType, 
                riskScore: result.riskScore,
                hazardCount: result.flaggedIssues?.length || 0,
                confidence: result.formTypeConfidence
            });
            
            return result;
        }
        
        throw new Error('DeepSeek returned invalid or unknown result');
    }

    async analyzeWithGemini(text, formType) {
        logger.info('Attempting Gemini safety form analysis (fallback)', { provider: 'gemini', textLength: text.length });
        
        if (!this.gemini) {
            // Use Google Cloud ADC via REST API
            const { GoogleAuth } = require('google-auth-library');
            const auth = new GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });
            
            const authClient = await auth.getClient();
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
            
            const response = await authClient.request({
                url,
                method: 'POST',
                data: {
                    contents: [{
                        parts: [{ text: this.createEnhancedSafetyPrompt(text, formType) }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 3000
                    }
                }
            });
            
            const responseText = response.data.candidates[0].content.parts[0].text;
            return this.parseEnhancedAIResponse(responseText, text);
        }
        
        // Use API key method
        const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const result = await model.generateContent({
            contents: [{ parts: [{ text: this.createEnhancedSafetyPrompt(text, formType) }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 3000
            }
        });
        
        const responseText = result.response.text();
        return this.parseEnhancedAIResponse(responseText, text);
    }

    async analyzeWithOpenAI(text, formType) {
        logger.info('Attempting OpenAI safety form analysis (final fallback)', { provider: 'openai', textLength: text.length });
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.openai.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'system',
                    content: 'You are an expert Australian workplace safety officer with deep knowledge of Take 5, SWMS, JSA, JHA, and Hazard Assessment forms. Analyze workplace safety documentation and provide structured analysis in valid JSON format only.'
                }, {
                    role: 'user',
                    content: this.createEnhancedSafetyPrompt(text, formType)
                }],
                temperature: 0.1,
                max_tokens: 3000
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const responseText = data.choices[0].message.content;
        
        return this.parseEnhancedAIResponse(responseText, text);
    }

    createEnhancedSafetyPrompt(extractedText, formType) {
        return `Analyze this Australian workplace safety form and provide comprehensive safety assessment.

EXTRACTED TEXT FROM FORM:
${extractedText}

ANALYSIS REQUIREMENTS:

1. **FORM TYPE DETECTION** - Identify the specific type:
   - "TAKE_5": Take 5 safety checklist (5 questions: Stop, Look, Assess, Manage, Monitor)
   - "SWMS": Safe Work Method Statement 
   - "JSA": Job Safety Analysis
   - "JHA": Job Hazard Analysis  
   - "JSEA": Job Safety and Environmental Analysis
   - "PTB": Pre-Task Brief or Pre-Task Briefing
   - "HAZARD_ASSESSMENT": Hazard identification and risk assessment
   - "PERMIT_TO_WORK": Work permit or isolation permit
   - "TOOLBOX_TALK": Safety briefing record
   - "INCIDENT_REPORT": Accident/incident documentation
   - "SAFETY_INDUCTION": Site safety induction checklist

2. **HAZARD IDENTIFICATION** - Scan for specific Australian workplace hazards:
   - **ELECTRICAL**: Live wires, switchboards, power tools, electrical work, isolation required
   - **FALL_PROTECTION**: Height work, ladders, scaffolding, roof work, edge protection, harnesses
   - **MECHANICAL**: Moving machinery, crushing hazards, cutting tools, rotating equipment
   - **CHEMICAL**: Hazardous substances, solvents, acids, gases, fumes, MSDS references
   - **MANUAL_HANDLING**: Heavy lifting, repetitive work, awkward postures
   - **CONFINED_SPACE**: Tanks, vessels, underground work, atmospheric testing
   - **VEHICLE_MOVEMENT**: Mobile plant, reversing vehicles, pedestrian separation
   - **ENVIRONMENTAL**: Weather conditions, noise, dust, temperature extremes

3. **HRW & FATAL FIVE FOCUS** - WorkSafe Victoria priority areas:
   - Working at height (>2m), Electrical work, Confined spaces
   - Mobile plant/crane operations, Excavation/trenching
   - Fatal Five: Mobile plant, Falls, Electricity, Hazardous substances, Manual handling

4. **PPE REQUIREMENTS** - Identify required personal protective equipment:
   - Hard hats, safety glasses, hearing protection, high-vis, safety boots
   - Gloves (specify type), respirators, fall arrest harnesses, face shields

Return ONLY valid JSON in this exact format:
{
  "formType": "[TAKE_5|SWMS|JSA|JHA|JSEA|PTB|HAZARD_ASSESSMENT|PERMIT_TO_WORK|TOOLBOX_TALK|INCIDENT_REPORT|SAFETY_INDUCTION|UNKNOWN]",
  "formTypeConfidence": "[HIGH|MEDIUM|LOW]",
  "riskScore": [1-10 integer],
  "riskLevel": "[LOW|MEDIUM|HIGH|CRITICAL]",
  "flaggedIssues": [
    {
      "category": "[ELECTRICAL|FALL_PROTECTION|MECHANICAL|CHEMICAL|MANUAL_HANDLING|CONFINED_SPACE|VEHICLE_MOVEMENT|ENVIRONMENTAL|PPE|PROCEDURE]",
      "description": "specific safety concern identified",
      "severity": "[LOW|MEDIUM|HIGH|CRITICAL]", 
      "recommendation": "specific corrective action required",
      "location": "where in form this issue was found",
      "controlMeasures": ["existing controls mentioned"],
      "additionalControls": ["recommended additional safety controls"],
      "isControlled": true/false
    }
  ],
  "hrwFactors": [
    {
      "activity": "specific HRW activity name",
      "category": "[HEIGHT_WORK|ELECTRICAL|CONFINED_SPACE|MOBILE_PLANT|EXCAVATION|OTHER]",
      "riskEscalation": [2-4],
      "controls": ["safety controls mentioned"]
    }
  ],
  "ppeRequired": [
    {
      "type": "[HARD_HAT|SAFETY_GLASSES|HEARING_PROTECTION|HIGH_VIS|SAFETY_BOOTS|GLOVES|RESPIRATOR|HARNESS|FACE_SHIELD]",
      "specification": "specific PPE requirements",
      "mandatory": true/false,
      "mentioned": true/false
    }
  ],
  "complianceIssues": [
    {
      "standard": "[AS/NZS reference or regulation]",
      "issue": "specific compliance gap identified",
      "action": "required corrective action",
      "severity": "[LOW|MEDIUM|HIGH|CRITICAL]"
    }
  ],
  "riskAssessment": {
    "initialRisk": "[LOW|MEDIUM|HIGH|CRITICAL]",
    "controlsImplemented": ["list of risk controls mentioned"],
    "residualRisk": "[LOW|MEDIUM|HIGH|CRITICAL]",
    "riskMatrix": {
      "consequence": [1-5],
      "likelihood": [1-5],
      "riskRating": [1-25]
    }
  },
  "summary": "comprehensive assessment of safety risks and form completeness",
  "requiresSupervisorReview": true/false,
  "formCompleteness": "[COMPLETE|INCOMPLETE|PARTIALLY_COMPLETE]",
  "missingFields": ["list of critical missing information"],
  "positiveFindings": ["list of good safety practices identified"],
  "workLocation": "site/location mentioned in form",
  "workActivity": "brief description of work being performed",
  "workerDetails": {
    "signaturesPresent": true/false,
    "supervisorApproval": true/false,
    "dateCompleted": "date if mentioned"
  },
  "emergencyProcedures": {
    "mentioned": true/false,
    "details": ["emergency procedures referenced"]
  }
}

**CRITICAL CHECKBOX INTERPRETATION RULES:**
- **X or cross marks (✗) = PROBLEM/HAZARD IDENTIFIED** - These are SAFETY ISSUES that need correction
- **Tick marks (✓) = CONTROLLED/SAFE** - These are good safety practices
- **Empty boxes = UNCONTROLLED** - These are missing controls that need attention
- **"N/A" = NOT APPLICABLE** - These don't apply to this work

**IMPORTANT**: If you see "Barricading and no-go zones ✗" this means barricading is MISSING/INADEQUATE, not established!
If you see "H2S monitor worn ✗" this means the monitor is NOT being worn - this is a CRITICAL safety violation!
If you see "Tools secured at height ✗" this means tools are NOT secured - this is a fall hazard!

RISK SCORING GUIDELINES:
- 1-2: MINIMAL risk - Standard precautions adequate
- 3-4: LOW risk - Basic controls sufficient  
- 5-6: MEDIUM risk - Additional controls recommended
- 7-8: HIGH risk - Supervisor review required, comprehensive controls needed
- 9-10: CRITICAL risk - Stop work, immediate management intervention

**ESCALATION TRIGGERS:**
- Any H2S monitor not worn (✗) = +3 risk escalation (CRITICAL gas exposure)
- Tools not secured at height (✗) = +2 risk escalation (falling object hazard)
- Missing barricading (✗) = +2 risk escalation (pedestrian safety)
- Missing fall protection (✗) = +3 risk escalation (fatal fall risk)

Focus on Australian workplace safety standards and construction/industrial best practices.`;
    }

    parseEnhancedAIResponse(responseText, originalText) {
        try {
            // Clean the response text to extract JSON
            let cleanResponse = responseText.trim();
            
            // Remove markdown code blocks if present
            cleanResponse = cleanResponse.replace(/```json\s*|\s*```/g, '');
            cleanResponse = cleanResponse.replace(/```\s*|\s*```/g, '');
            
            // Find JSON in the response
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            // CRITICAL: Direct violation detection - override AI's findings
            const detectedViolations = [];

            // H2S Monitor Critical Violation
            if (/H2S monitor worn within breathing zone(?!\s*☑)/i.test(originalText)) {
              detectedViolations.push({
                category: "CHEMICAL",
                description:
                  "H2S monitor not worn within breathing zone - CRITICAL gas exposure risk",
                severity: "CRITICAL",
                recommendation:
                  "Immediately require H2S monitor to be worn in breathing zone",
                location: "Personal Protective Equipment section",
                controlMeasures: [],
                additionalControls: ["H2S monitor must be worn", "Gas detection protocols"],
                isControlled: false,
              });
            }

            // Hearing Protection Violation
            if (/hearing protection worn\s*0/i.test(originalText)) {
              detectedViolations.push({
                category: "PPE",
                description: "Hearing protection not worn (marked with 0)",
                severity: "HIGH",
                recommendation: "Ensure hearing protection is worn in high noise areas",
                location: "Personal Protective Equipment section",
                controlMeasures: [],
                additionalControls: ["Hearing protection mandatory"],
                isControlled: false,
              });
            }

            // Loose Work Surfaces
            if (/loose or uneven work surfaces/i.test(originalText)) {
              detectedViolations.push({
                category: "PHYSICAL",
                description: "Loose or uneven work surfaces with slip/trip potential",
                severity: "HIGH",
                recommendation: "Secure all work surfaces and ensure stable footing",
                location: "Work environment assessment",
                controlMeasures: [],
                additionalControls: ["Surface stabilization", "Non-slip materials"],
                isControlled: false,
              });
            }

            // Inject our violations into AI response
            if (detectedViolations.length > 0) {
              parsed.flaggedIssues = [
                ...detectedViolations,
                ...(parsed.flaggedIssues || []),
              ];

              // Escalate risk score
              let violationEscalation = detectedViolations.length * 2; // +2 per violation
              parsed.riskScore = Math.min(10, parsed.riskScore + violationEscalation);

              logger.info("Risk score escalated due to pattern detection", {
                originalScore: parsed.riskScore - violationEscalation,
                violationEscalation,
                finalScore: parsed.riskScore,
                detectedViolations: detectedViolations.length,
              });
            }
            // Validate required fields
            if (!parsed.formType || !parsed.riskScore) {
                throw new Error('Missing required fields in AI response');
            }
            
            // Ensure arrays exist with defaults
            parsed.flaggedIssues = parsed.flaggedIssues || [];
            parsed.hrwFactors = parsed.hrwFactors || [];
            parsed.ppeRequired = parsed.ppeRequired || [];
            parsed.complianceIssues = parsed.complianceIssues || [];
            
            // Calculate enhanced risk score with HRW escalation
            const enhancedResult = this.enhanceAnalysisResult(parsed, originalText);
            
            return enhancedResult;
            
        } catch (error) {
            logger.error('Failed to parse enhanced AI response', { 
                error: error.message, 
                responseText: responseText.substring(0, 500) 
            });
            
            // Fallback to basic analysis
            return this.getFallbackAnalysis(originalText, error, 0);
        }
    }

    enhanceAnalysisResult(analysis, originalText) {
        // Calculate base risk score
        const baseScore = analysis.riskScore || this.calculateBaseRiskScore(originalText);
        
        // Apply HRW escalation
        let escalation = 0;
        
        // HRW activity escalation
        if (analysis.hrwFactors && analysis.hrwFactors.length > 0) {
            const maxEscalation = Math.max(...analysis.hrwFactors.map(f => f.riskEscalation || 2));
            escalation += maxEscalation;
            logger.info('HRW escalation applied', { hrwCount: analysis.hrwFactors.length, escalation: maxEscalation });
        }
        
        // Fatal Five escalation
        const fatalFivePatterns = [
            /mobile plant|vehicle|machinery|crane|forklift/i,
            /height|fall|ladder|scaffold|roof/i,
            /electric|electrical|power|voltage/i,
            /H2S|hydrogen sulfide|gas|chemical|hazardous substance/i,
            /manual handling|lifting|ergonomic/i
        ];
        
        const fatalFiveDetected = fatalFivePatterns.some(pattern => pattern.test(originalText));
        if (fatalFiveDetected) {
            escalation += 1;
            logger.info('Fatal Five escalation applied', { escalation: 1 });
        }
        
        // Critical uncontrolled hazards
        if (analysis.flaggedIssues && analysis.flaggedIssues.length > 0) {
            const criticalUncontrolled = analysis.flaggedIssues.filter(h => 
                h.severity === 'CRITICAL' && !h.isControlled
            ).length;
            
            if (criticalUncontrolled > 0) {
                escalation += criticalUncontrolled;
                logger.info('Critical uncontrolled hazard escalation', { 
                    count: criticalUncontrolled, 
                    escalation: criticalUncontrolled 
                });
            }
        }
        
        const finalScore = Math.min(10, baseScore + escalation);
        
        logger.info('Enhanced risk score calculation', {
            baseScore,
            escalation,
            finalScore,
            riskLevel: this.getRiskLevel(finalScore)
        });
        
        // Enhanced result with all fields
        const enhanced = {
            formType: analysis.formType,
            formTypeConfidence: analysis.formTypeConfidence || 'HIGH',
            riskScore: finalScore,
            riskLevel: this.getRiskLevel(finalScore),
            flaggedIssues: analysis.flaggedIssues,
            hrwFactors: analysis.hrwFactors,
            ppeRequired: analysis.ppeRequired,
            complianceIssues: analysis.complianceIssues,
            riskAssessment: analysis.riskAssessment || {
                initialRisk: this.getRiskLevel(baseScore),
                controlsImplemented: [],
                residualRisk: this.getRiskLevel(finalScore),
                riskMatrix: { consequence: 3, likelihood: 3, riskRating: 9 }
            },
            summary: analysis.summary || 'Enhanced safety analysis completed',
            requiresSupervisorReview: this.calculateSupervisorReview(analysis, finalScore),
            formCompleteness: analysis.formCompleteness || 'PARTIALLY_COMPLETE',
            missingFields: analysis.missingFields || [],
            positiveFindings: analysis.positiveFindings || [],
            workLocation: analysis.workLocation || 'Not specified',
            workActivity: analysis.workActivity || 'Not specified',
            workerDetails: analysis.workerDetails || {
                signaturesPresent: false,
                supervisorApproval: false,
                dateCompleted: null
            },
            emergencyProcedures: analysis.emergencyProcedures || {
                mentioned: false,
                details: []
            },
            
            // Legacy compatibility fields
            hazards: analysis.flaggedIssues, // For backward compatibility
            overallRiskAssessment: analysis.summary,
            confidence: analysis.formTypeConfidence,
            analysisProvider: 'ai',
            analysisStatus: 'COMPLETED',
            processingTime: Date.now()
        };
        
        return enhanced;
    }

    calculateSupervisorReview(analysis, riskScore) {
        // Supervisor review required if:
        // 1. Risk score >= 7
        // 2. CRITICAL severity issues present
        // 3. Form incomplete with HIGH risk
        // 4. Compliance violations present
        
        if (riskScore >= 7) return true;
        
        if (analysis.flaggedIssues?.some(issue => issue.severity === 'CRITICAL')) return true;
        
        if (analysis.formCompleteness === 'INCOMPLETE' && riskScore >= 5) return true;
        
        if (analysis.complianceIssues?.some(issue => 
            issue.severity === 'HIGH' || issue.severity === 'CRITICAL')) return true;
        
        return false;
    }

    getFallbackAnalysis(text, error, processingTime) {
        const baseScore = this.calculateBaseRiskScore(text);
        const hrwFactors = this.detectHRWFactors(text);
        const hazards = this.extractBasicHazards(text);
        const finalScore = this.applyHRWEscalation(baseScore, hrwFactors, hazards, text);

        return {
            formType: 'UNKNOWN',
            formTypeConfidence: 'LOW',
            riskScore: finalScore,
            riskLevel: this.getRiskLevel(finalScore),
            flaggedIssues: hazards.map(h => ({
                category: h.type,
                description: h.description,
                severity: h.severity,
                recommendation: 'Manual review required',
                location: 'Detected by fallback analysis',
                controlMeasures: h.controlMeasures || [],
                additionalControls: [],
                isControlled: h.isControlled || false
            })),
            hrwFactors: hrwFactors,
            ppeRequired: [],
            complianceIssues: [{
                standard: 'System Error',
                issue: 'AI analysis service error - manual review required',
                action: 'Please review form manually and verify all safety requirements',
                severity: 'HIGH'
            }],
            riskAssessment: {
                initialRisk: this.getRiskLevel(baseScore),
                controlsImplemented: [],
                residualRisk: this.getRiskLevel(finalScore),
                riskMatrix: { consequence: 3, likelihood: 3, riskRating: 9 }
            },
            summary: error ? `Analysis failed: ${error.message} - requires immediate manual safety review` : 'Fallback analysis completed',
            requiresSupervisorReview: true,
            formCompleteness: 'REQUIRES_REVIEW',
            missingFields: ['AI analysis failed'],
            positiveFindings: [],
            workLocation: 'Not specified',
            workActivity: 'Not specified',
            workerDetails: {
                signaturesPresent: false,
                supervisorApproval: false,
                dateCompleted: null
            },
            emergencyProcedures: {
                mentioned: false,
                details: []
            },
            
            // Legacy compatibility
            hazards: hazards,
            overallRiskAssessment: 'Fallback analysis - manual review required',
            confidence: 'LOW',
            analysisProvider: 'fallback',
            analysisStatus: 'FAILED',
            processingTime,
            metadata: {
                provider: 'fallback',
                error: error?.message,
                processingTimeMs: processingTime,
                timestamp: new Date().toISOString()
            }
        };
    }

    applyHRWEscalation(baseScore, hrwFactors, hazards, originalText) {
        let escalation = 0;
        
        // HRW activity escalation
        if (hrwFactors && hrwFactors.length > 0) {
            const maxEscalation = Math.max(...hrwFactors.map(f => f.riskEscalation || 2));
            escalation += maxEscalation;
            logger.info('HRW escalation applied', { hrwCount: hrwFactors.length, escalation: maxEscalation });
        }
        
        // Fatal Five escalation
        const fatalFivePatterns = [
            /mobile plant|vehicle|machinery|crane|forklift/i,
            /height|fall|ladder|scaffold|roof/i,
            /electric|electrical|power|voltage/i,
            /H2S|hydrogen sulfide|gas|chemical|hazardous substance/i,
            /manual handling|lifting|ergonomic/i
        ];
        
        const fatalFiveDetected = fatalFivePatterns.some(pattern => pattern.test(originalText));
        if (fatalFiveDetected) {
            escalation += 1;
            logger.info('Fatal Five escalation applied', { escalation: 1 });
        }
        
        // Critical checkbox violations (X marks indicating problems)
        // const criticalViolations = [
        //     { pattern: /H2S monitor.*[✗xX]|[✗xX].*H2S monitor/i, escalation: 4, description: 'H2S monitor not worn - CRITICAL gas exposure risk' },
        //     { pattern: /hearing protection.*[✗xX]|[✗xX].*hearing protection/i, escalation: 1, description: 'Hearing protection not worn - noise exposure' },
        //     { pattern: /weather conditions.*[✗xX]|[✗xX].*weather conditions/i, escalation: 2, description: 'Weather conditions not considered - environmental risk' },
        //     { pattern: /work surfaces.*[✗xX]|[✗xX].*work surfaces|surfaces.*level.*[✗xX]/i, escalation: 2, description: 'Work surfaces unsafe - slip/trip hazard' },
        //     { pattern: /barricad.*[✗xX]|[✗xX].*barricad/i, escalation: 2, description: 'Barricading missing - pedestrian safety risk' },
        //     { pattern: /tools.*secured.*[✗xX]|[✗xX].*tools.*secured/i, escalation: 2, description: 'Tools not secured - falling object hazard' },
        //     { pattern: /ladder.*safety.*[✗xX]|[✗xX].*ladder/i, escalation: 2, description: 'Ladder safety requirements not met' },
        //     // Note: Only flag fall protection if it's marked with X, not if it has checkmark
        //     { pattern: /fall protection.*[✗xX]|[✗xX].*fall protection/i, escalation: 3, description: 'Fall protection missing - fatal fall risk' }
        // ];
        
        // DEBUG: Log what patterns are being matched for Google Vision
        logger.info('GOOGLE VISION VIOLATION PATTERN DEBUG:', {
            textLength: originalText.length,
            h2sMonitorPattern: /H2S monitor worn within breathing zone(?!\s*☑)/i.test(originalText),
            hearingProtectionZero: /hearing protection worn\s*0/i.test(originalText), 
            looseWorkSurfaces: /loose or uneven work surfaces/i.test(originalText),
            barricadePatterns: {
                barricadeInPlace: /barricade.*in place/i.test(originalText),
                barricadeRemoval: /barricades.*removed/i.test(originalText)
            },
            weatherConsidered: /weather conditions considered\s*☑/i.test(originalText),
            fallPreventionInPlace: /fall prevention in place/i.test(originalText)
        });

        // Google Vision specific violations (look for missing confirmations)
        // const googleVisionViolations = [
        //     { pattern: /H2S monitor worn within breathing zone(?!\s*☑)/i, escalation: 4, description: 'H2S monitor not worn - CRITICAL gas exposure risk' },
        //     { pattern: /hearing protection worn\s*0/i, escalation: 2, description: 'Hearing protection not worn (marked with 0)' },
        //     { pattern: /loose or uneven work surfaces/i, escalation: 2, description: 'Work surfaces unsafe - slip/trip hazard identified' },
        //     { pattern: /barricades.*removed/i, escalation: 2, description: 'Barricading issues - removal mentioned without confirmation of replacement' }
        // ];
        
        // googleVisionViolations.forEach(violation => {
        //     if (violation.pattern.test(originalText)) {
        //         escalation += violation.escalation;
        //         logger.warn('Google Vision safety violation detected', { 
        //             violation: violation.description, 
        //             escalation: violation.escalation 
        //         });
        //     }
        // });
        
        // Original critical violations (for X mark detection)
        const criticalViolations = [
            { pattern: /H2S monitor.*[✗xX]|[✗xX].*H2S monitor/i, escalation: 4, description: 'H2S monitor not worn - CRITICAL gas exposure risk' },
            { pattern: /hearing protection.*[✗xX]|[✗xX].*hearing protection/i, escalation: 1, description: 'Hearing protection not worn - noise exposure' },
            { pattern: /weather conditions.*[✗xX]|[✗xX].*weather conditions/i, escalation: 2, description: 'Weather conditions not considered - environmental risk' },
            { pattern: /work surfaces.*[✗xX]|[✗xX].*work surfaces|surfaces.*level.*[✗xX]/i, escalation: 2, description: 'Work surfaces unsafe - slip/trip hazard' },
            { pattern: /barricad.*[✗xX]|[✗xX].*barricad/i, escalation: 2, description: 'Barricading missing - pedestrian safety risk' },
            { pattern: /tools.*secured.*[✗xX]|[✗xX].*tools.*secured/i, escalation: 2, description: 'Tools not secured - falling object hazard' },
            { pattern: /ladder.*safety.*[✗xX]|[✗xX].*ladder/i, escalation: 2, description: 'Ladder safety requirements not met' },
            // Note: Only flag fall protection if it's marked with X, not if it has checkmark
            { pattern: /fall protection.*[✗xX]|[✗xX].*fall protection/i, escalation: 3, description: 'Fall protection missing - fatal fall risk' }
        ];
        
        criticalViolations.forEach(violation => {
            if (violation.pattern.test(originalText)) {
                // Double-check that this isn't a positive finding (has checkmark)
                const positivePattern = new RegExp(violation.pattern.source.replace(/\[✗xX\]/g, '[✓✔]'), 'i');
                if (!positivePattern.test(originalText)) {
                    escalation += violation.escalation;
                    logger.warn('Critical safety violation detected', { 
                        violation: violation.description, 
                        escalation: violation.escalation 
                    });
                }
            }
        });
        
        // Critical uncontrolled hazards from AI analysis
        if (hazards && hazards.length > 0) {
            const criticalUncontrolled = hazards.filter(h => 
                h.severity === 'CRITICAL' && !h.isControlled
            ).length;
            
            if (criticalUncontrolled > 0) {
                escalation += criticalUncontrolled;
                logger.info('Critical uncontrolled hazard escalation', { count: criticalUncontrolled, escalation: criticalUncontrolled });
            }
        }
        
        const finalScore = Math.min(10, baseScore + escalation);
        
        logger.info('Risk score calculation', {
            baseScore,
            escalation,
            finalScore,
            riskLevel: this.getRiskLevel(finalScore)
        });
        
        return finalScore;
    }

    calculateBaseRiskScore(text) {
        let score = 1;
        
        // Increase score based on complexity indicators
        if (text.length > 1000) score++;
        if (/hazard|risk|danger/gi.test(text)) score++;
        if (/emergency|incident|accident/gi.test(text)) score++;
        if (/control|mitigation|prevention/gi.test(text)) score++;
        
        return Math.min(6, score);
    }

    detectHRWFactors(text) {
        const hrwActivities = [
            { pattern: /working at height|height work|fall protection/i, activity: 'Working at Height', category: 'HEIGHT_WORK', riskEscalation: 3 },
            { pattern: /electrical work|electrical installation/i, activity: 'Electrical Work', category: 'ELECTRICAL', riskEscalation: 4 },
            { pattern: /confined space|tank entry|vessel entry/i, activity: 'Confined Space', category: 'CONFINED_SPACE', riskEscalation: 4 },
            { pattern: /crane|mobile plant|heavy machinery/i, activity: 'Mobile Plant Operations', category: 'MOBILE_PLANT', riskEscalation: 3 },
            { pattern: /excavation|trenching|digging/i, activity: 'Excavation Work', category: 'EXCAVATION', riskEscalation: 3 },
            { pattern: /demolition|structural removal/i, activity: 'Demolition Work', category: 'OTHER', riskEscalation: 3 },
            { pattern: /asbestos|hazardous material/i, activity: 'Asbestos Handling', category: 'OTHER', riskEscalation: 4 },
            { pattern: /scaffolding|scaffold erection/i, activity: 'Scaffolding Work', category: 'HEIGHT_WORK', riskEscalation: 2 },
            { pattern: /rigging|lifting equipment/i, activity: 'Rigging Work', category: 'OTHER', riskEscalation: 2 }
        ];
        
        return hrwActivities.filter(hrw => hrw.pattern.test(text));
    }

    extractBasicHazards(text) {
        const hazardPatterns = [
            { pattern: /slip|trip|fall/i, type: 'Physical', description: 'Slip, trip, or fall hazard', severity: 'MEDIUM' },
            { pattern: /chemical|toxic|corrosive/i, type: 'Chemical', description: 'Chemical exposure hazard', severity: 'HIGH' },
            { pattern: /noise|vibration/i, type: 'Physical', description: 'Noise or vibration exposure', severity: 'MEDIUM' },
            { pattern: /fire|explosion|flammable/i, type: 'Fire/Explosion', description: 'Fire or explosion risk', severity: 'CRITICAL' },
            { pattern: /manual handling|lifting/i, type: 'Ergonomic', description: 'Manual handling injury risk', severity: 'MEDIUM' }
        ];
        
        // Critical checkbox violations - X marks indicating problems
        const checkboxViolations = [
            { pattern: /H2S monitor.*[✗xX]|[✗xX].*H2S monitor/i, type: 'Chemical', description: 'H2S monitor not worn in breathing zone - CRITICAL gas exposure risk', severity: 'CRITICAL' },
            { pattern: /hearing protection.*[✗xX]|[✗xX].*hearing protection/i, type: 'PPE', description: 'Hearing protection not worn in high noise area', severity: 'MEDIUM' },
            { pattern: /weather conditions.*[✗xX]|[✗xX].*weather conditions/i, type: 'Environmental', description: 'Weather conditions not properly considered', severity: 'HIGH' },
            { pattern: /work surfaces.*[✗xX]|[✗xX].*work surfaces|surfaces.*level.*[✗xX]|loose.*uneven.*[✗xX]/i, type: 'Physical', description: 'Work surfaces loose, uneven or unsafe', severity: 'HIGH' },
            { pattern: /barricad.*[✗xX]|[✗xX].*barricad/i, type: 'Physical', description: 'Barricading/exclusion zones not established', severity: 'HIGH' },
            { pattern: /tools.*secured.*[✗xX]|[✗xX].*tools.*secured/i, type: 'Physical', description: 'Tools not secured at height - falling object hazard', severity: 'HIGH' },
            { pattern: /ladder.*safety.*[✗xX]|[✗xX].*ladder(?!.*✓)/i, type: 'Fall Protection', description: 'Ladder safety requirements not met', severity: 'HIGH' },
            // Only flag fall protection if specifically marked with X (not when it has checkmark)
            { pattern: /fall protection.*[✗xX](?!.*✓)|[✗xX].*fall protection(?!.*✓)/i, type: 'Fall Protection', description: 'Fall protection equipment missing or inadequate', severity: 'CRITICAL' }
        ];
        
        // Positive findings - checkmarked items (don't add as hazards)
        const positivePatterns = [
            /fall prevention.*place.*✓|✓.*fall prevention/i,
            /moving parts.*controlled.*✓|✓.*moving parts.*controlled/i,
            /communication.*work groups.*✓|✓.*communication/i,
            /safe access.*✓|✓.*safe access/i,
            /tool.*securing.*✓|✓.*tool.*securing/i
        ];
        
        const detectedHazards = [];
        
        // Check standard hazard patterns
        hazardPatterns.forEach(pattern => {
            if (pattern.pattern.test(text)) {
                detectedHazards.push({
                    type: pattern.type,
                    description: pattern.description,
                    severity: pattern.severity,
                    controlMeasures: [],
                    isControlled: false
                });
            }
        });
        
        // Check critical checkbox violations
        checkboxViolations.forEach(violation => {
            if (violation.pattern.test(text)) {
                detectedHazards.push({
                    type: violation.type,
                    description: violation.description,
                    severity: violation.severity,
                    controlMeasures: [],
                    isControlled: false // X marks always indicate uncontrolled hazards
                });
            }
        });
        
        return detectedHazards;
    }

    getRiskLevel(score) {
        if (score <= 3) return 'LOW';
        if (score <= 6) return 'MEDIUM';
        if (score <= 8) return 'HIGH';
        return 'CRITICAL';
    }

    // Health check method
    async healthCheck() {
        try {
            const providerStatus = {};
            
            // Check each provider status
            if (this.providers.includes('deepseek')) {
                providerStatus.deepseek = this.deepseek?.apiKey ? 'READY' : 'NO_API_KEY';
            }
            
            if (this.providers.includes('gemini')) {
                providerStatus.gemini = 'READY'; // ADC or API key
            }
            
            if (this.providers.includes('openai')) {
                providerStatus.openai = this.openai?.apiKey ? 'READY' : 'NO_API_KEY';
            }
            
            return { 
                status: 'OK', 
                providers: this.providers,
                providerStatus,
                capabilities: 'Enhanced multi-provider Australian safety form analysis',
                version: '3.0-enhanced-multi-provider',
                timestamp: new Date().toISOString(),
                features: [
                    'Multi-provider fallback (DeepSeek → Gemini → OpenAI)',
                    'HRW & Fatal Five detection',
                    'Enhanced risk escalation logic',
                    'Comprehensive safety analysis',
                    'Australian standards compliance (AS/NZS)',
                    'PPE requirement detection',
                    'Compliance issue identification',
                    'Form completeness assessment',
                    'Emergency procedure checking',
                    'Worker signature validation'
                ]
            };
        } catch (error) {
            return { 
                status: 'ERROR', 
                error: error.message,
                providers: this.providers,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Export singleton instance
const aiService = new MultiProviderAIService();
module.exports = aiService;