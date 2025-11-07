export interface BusinessContext {
  companyName?: string;
  industry?: string;
  region?: string;
  sizeDescription?: string;
}

export interface Actor {
  name: string;
  description: string;
}

export interface DataEntity {
  name: string;
  fields: string[];
}

export interface PainPoint {
  description: string;
  impact: "low" | "medium" | "high";
  frequency: "rare" | "sometimes" | "often" | "constant";
}

export interface CandidateModule {
  name: string;
  description: string;
  priority: "must-have" | "should-have" | "nice-to-have";
}

export interface RiskOrConstraint {
  description: string;
  type: "technical" | "organizational" | "budget" | "timeline" | "unknown";
}

export interface UploadedDocumentSheet {
  name: string;
  rows: number;
  columns: number;
  headers: string[];
  sampleData: string;
}

export interface UploadedDocument {
  filename: string;
  type: "spreadsheet" | "image" | "document";
  summary: string;
  sheets?: UploadedDocumentSheet[];
}

export interface RequirementsSummary {
  businessContext: BusinessContext;
  primaryGoal: string;
  secondaryGoals: string[];
  currentTools: string[];
  mainActors: Actor[];
  painPoints: PainPoint[];
  dataEntities: DataEntity[];
  candidateModules: CandidateModule[];
  nonFunctionalNeeds: string[];
  risksAndConstraints: RiskOrConstraint[];
  openQuestions: string[];
  uploadedDocuments: UploadedDocument[];
}

