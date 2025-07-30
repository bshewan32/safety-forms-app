// backend/src/services/ai/aiAnalysisService.js

const OpenAI = require('openai');
const { logger } = require('../../utils/logger');

class AIAnalysisService {
  constructor() {
    this.providers = {
      openai: new OpenAIProvider(),
      // deepseek: new DeepSeekProvider(), // Add later
      // gemini: new GeminiProvider(),     // Add later
    };
    this.currentProvider = process.env.AI_PROVIDER || 'openai';
  }

  async analyzeSafetyForm(extractedText, formType) {
    try {
      const provider = this.providers[this.currentProvider];
      if (!provider) {
        throw new Error(`Provider ${this.currentProvider} not found`);
      }

      const analysis = await provider.analyze(extractedText, formType);
      return {
        ...analysis,
        provider: this.currentProvider,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('AI Analysis failed:', error);
      throw error;
    }
  }

  switchProvider(providerName) {
    if (!this.providers[providerName]) {
      throw new Error(`Provider ${providerName} not available`);
    }
    this.currentProvider = providerName;
    logger.info(`Switched to AI provider: ${providerName}`);
  }
}

class OpenAIProvider {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  async analyze(extractedText, formType) {
    const prompt = this.buildPrompt(extractedText, formType);
    
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content: "You are a safety expert analyzing workplace safety forms. Identify risks, compliance issues, and provide actionable recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  buildPrompt(extractedText, formType) {
    return `
Analyze this ${formType} safety form and return a JSON response with the following structure:

{
  "riskScore": 1-10,
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "flaggedIssues": [
    {
      "category": "PPE|HAZARD|PROCEDURE|DOCUMENTATION",
      "description": "Brief description",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "recommendation": "Specific action to take"
    }
  ],
  "complianceIssues": [
    {
      "standard": "Regulation/Standard name",
      "issue": "Description of non-compliance",
      "action": "Required corrective action"
    }
  ],
  "summary": "Brief overall assessment",
  "requiresSupervisorReview": boolean
}

Form Content:
${extractedText}

Focus on:
1. Missing or inadequate PPE
2. Uncontrolled hazards
3. Incomplete procedures
4. Documentation gaps
5. Regulatory compliance
`;
  }
}

// Risk scoring utility
class RiskScorer {
  static calculateOverallRisk(issues) {
    if (!issues || issues.length === 0) return 1;
    
    const severityWeights = {
      'CRITICAL': 10,
      'HIGH': 7,
      'MEDIUM': 4,
      'LOW': 2
    };

    const totalWeight = issues.reduce((sum, issue) => {
      return sum + (severityWeights[issue.severity] || 2);
    }, 0);

    return Math.min(10, Math.ceil(totalWeight / issues.length));
  }

  static shouldFlag(riskScore, issues) {
    return riskScore >= 6 || 
           issues.some(issue => issue.severity === 'CRITICAL') ||
           issues.length >= 3;
  }
}

module.exports = { AIAnalysisService, RiskScorer };