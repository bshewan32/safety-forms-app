// Risk scoring utility functions
function calculateRiskScore(aiAnalysis) {
  let score = 0;
  
  // Base score from hazards
  if (aiAnalysis.hazards && aiAnalysis.hazards.length > 0) {
    score += aiAnalysis.hazards.length * 15; // 15 points per hazard
  }
  
  // Add points for compliance issues
  if (aiAnalysis.compliance_issues && aiAnalysis.compliance_issues.length > 0) {
    score += aiAnalysis.compliance_issues.length * 20; // 20 points per issue
  }
  
  // Reduce score for safety controls
  if (aiAnalysis.controls && aiAnalysis.controls.length > 0) {
    score -= aiAnalysis.controls.length * 10; // -10 points per control
  }
  
  // Adjust based on AI confidence
  if (aiAnalysis.confidence < 70) {
    score += 10; // Add uncertainty penalty
  }
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

function getRiskLevel(score) {
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  if (score >= 40) return 'LOW';
  return 'MINIMAL';
}

module.exports = {
  calculateRiskScore,
  getRiskLevel
};