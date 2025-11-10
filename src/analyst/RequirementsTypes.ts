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
  workflowDiagram: string;
}

export interface AcceptanceCriterion {
  description: string;
}

export interface UserStory {
  id: string;
  epicName: string;
  title: string;
  actor: string;
  action: string;
  benefit: string;
  acceptanceCriteria: AcceptanceCriterion[];
  priority: "must-have" | "should-have" | "nice-to-have";
  effort: "small" | "medium" | "large";
  storyPoints?: number;
  sprint?: number;
}

export interface Epic {
  name: string;
  description: string;
  icon: string;
  stories: UserStory[];
}

export interface UserStoriesOutput {
  totalStories: number;
  byPriority: {
    mustHave: number;
    shouldHave: number;
    niceToHave: number;
  };
  epics: Epic[];
}

