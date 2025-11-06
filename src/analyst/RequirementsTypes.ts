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
}

