// shared/types/index.ts

export interface ProcessedForm {
  id: string;
  processingId: string;
  originalFileName: string;
  formType: FormType;
  workerName?: string;
  site?: string;
  extractedText: string;
  aiAnalysis: AIAnalysis;
  riskScore: number;
  requiresSupervisorReview: boolean;
  status: FormStatus;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface AIAnalysis {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flaggedIssues: SafetyIssue[];
  complianceIssues: ComplianceIssue[];
  summary: string;
  requiresSupervisorReview: boolean;
}

export interface SafetyIssue {
  category: 'PPE' | 'HAZARD' | 'PROCEDURE' | 'DOCUMENTATION' | 'ENVIRONMENTAL' | 'EQUIPMENT' | 'TRAINING' | 'OTHER';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation: string;
}

export interface ComplianceIssue {
  standard: string;
  issue: string;
  action: string;
}

export type FormType = 'TAKE5' | 'SWMS' | 'JSEA' | 'JHA' | 'INCIDENT_REPORT' | 'TOOLBOX_TALK' | 'OTHER';
export type FormStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface UploadMetadata {
  fileName: string;
  formType: FormType;
  workerName?: string;
  site?: string;
  timestamp: string;
}
