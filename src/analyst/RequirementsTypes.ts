// Enums matching Prisma schema
export enum StoryStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  READY_FOR_REVIEW = "READY_FOR_REVIEW",
  IN_REVIEW = "IN_REVIEW",
  DONE = "DONE",
  REMOVED = "REMOVED"
}

export enum StoryPriority {
  MUST_HAVE = "MUST_HAVE",
  SHOULD_HAVE = "SHOULD_HAVE",
  NICE_TO_HAVE = "NICE_TO_HAVE"
}

export enum StoryEffort {
  SMALL = "SMALL",
  MEDIUM = "MEDIUM",
  LARGE = "LARGE"
}

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
  team?: string;
}

export interface StatusTransition {
  id: string;
  userStoryId: string;
  fromStatus: StoryStatus | null;
  toStatus: StoryStatus;
  transitionedAt: Date;
}

// Helper functions to convert between formats
export function convertPriorityToDb(priority: string): StoryPriority {
  switch (priority) {
    case "must-have": return StoryPriority.MUST_HAVE;
    case "should-have": return StoryPriority.SHOULD_HAVE;
    case "nice-to-have": return StoryPriority.NICE_TO_HAVE;
    default: return StoryPriority.SHOULD_HAVE;
  }
}

export function convertEffortToDb(effort: string): StoryEffort {
  switch (effort) {
    case "small": return StoryEffort.SMALL;
    case "medium": return StoryEffort.MEDIUM;
    case "large": return StoryEffort.LARGE;
    default: return StoryEffort.MEDIUM;
  }
}

export function convertPriorityFromDb(priority: StoryPriority): string {
  switch (priority) {
    case StoryPriority.MUST_HAVE: return "must-have";
    case StoryPriority.SHOULD_HAVE: return "should-have";
    case StoryPriority.NICE_TO_HAVE: return "nice-to-have";
  }
}

export function convertEffortFromDb(effort: StoryEffort): string {
  switch (effort) {
    case StoryEffort.SMALL: return "small";
    case StoryEffort.MEDIUM: return "medium";
    case StoryEffort.LARGE: return "large";
  }
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

