import { DocumentGenerator, MermaidMetrics } from "../src/analyst/DocumentGenerator";
import { RequirementsSummary } from "../src/analyst/RequirementsTypes";

describe("DocumentGenerator.analyzeMermaidRelationships", () => {
  const docs = new DocumentGenerator();

  describe("Diagnostics for actors with no connections", () => {
    it("should detect actors with no connections", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Test system",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [
          { name: "Owner", description: "Company owner" },
          { name: "Client", description: "External client" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Reporting Dashboard", description: "Dashboard for reports", priority: "must-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const metrics = docs.analyzeMermaidRelationships(req);

      // Owner should connect to dashboard (management role + dashboard keyword)
      expect(metrics.actorsWithNoConnections).not.toContain("Owner");
      
      // Client with no clear connection should be isolated
      expect(metrics.actorsWithNoConnections).toContain("Client");
    });

    it("should not flag actors with fallback connections", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Manage invoices",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [
          { name: "Manager", description: "Manages operations" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Dashboard", description: "Main dashboard", priority: "must-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const metrics = docs.analyzeMermaidRelationships(req);

      // Manager should connect via management-module affinity
      expect(metrics.actorsWithNoConnections).toHaveLength(0);
    });
  });

  describe("Diagnostics for modules with no connections", () => {
    it("should detect orphaned modules", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Build e-commerce",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [
          { name: "Customer", description: "Buys products" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Product Catalog", description: "Browse products for customers", priority: "must-have" },
          { name: "Admin Panel", description: "Administrative interface", priority: "must-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const metrics = docs.analyzeMermaidRelationships(req);

      // Customer should connect to catalog
      expect(metrics.modulesWithNoConnections).not.toContain("Product Catalog");
      
      // Admin Panel should be orphaned (no admin actor)
      expect(metrics.modulesWithNoConnections).toContain("Admin Panel");
    });
  });

  describe("Diagnostics for suspicious client edges", () => {
    it("should flag client connections to non-client-facing modules", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Invoice management",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [
          { name: "Client (Omnigo)", description: "External client who pays for invoices" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Automated Reminders", description: "Sends reminders to client", priority: "should-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const metrics = docs.analyzeMermaidRelationships(req);

      // Should flag client connecting to non-portal module
      expect(metrics.suspiciousClientEdges.length).toBeGreaterThan(0);
      expect(metrics.suspiciousClientEdges[0]).toContain("Client (Omnigo)");
      expect(metrics.suspiciousClientEdges[0]).toContain("Automated Reminders");
    });

    it("should not flag client connections to client-facing modules", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Invoice management",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [
          { name: "Client", description: "External client" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Client Portal", description: "Portal for client to view invoices", priority: "must-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const metrics = docs.analyzeMermaidRelationships(req);

      // Should not flag portal connections
      expect(metrics.suspiciousClientEdges).toHaveLength(0);
    });
  });

  describe("Diagnostics for key modules missing or orphaned", () => {
    it("should flag orphaned key modules", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Build system",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [
          { name: "User", description: "System user" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Status Tracking", description: "Track status", priority: "must-have" },
          { name: "Other Module", description: "Generic module for users", priority: "should-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const metrics = docs.analyzeMermaidRelationships(req);

      // Status Tracking is a key module and should be flagged if orphaned
      expect(metrics.keyModulesMissingOrOrphaned).toContain("Status Tracking");
      
      // Other Module is not a key module
      expect(metrics.keyModulesMissingOrOrphaned).not.toContain("Other Module");
    });

    it("should not flag connected key modules", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Manage invoices",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [
          { name: "Owner", description: "Owner uses Status Tracking to monitor invoices" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Status Tracking", description: "Track invoice status for owner", priority: "must-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const metrics = docs.analyzeMermaidRelationships(req);

      // Status Tracking should be connected
      expect(metrics.keyModulesMissingOrOrphaned).not.toContain("Status Tracking");
    });
  });

  describe("Real-world consulting scenario diagnostics", () => {
    it("should detect multiple issues in a poorly extracted summary", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Manage consultant invoices",
        secondaryGoals: [],
        currentTools: ["Time Doctor", "Payoneer"],
        mainActors: [
          { name: "Client (Omnigo)", description: "External client" },
          { name: "Consultants", description: "Submit invoices" },
          { name: "Owner", description: "Company owner" },
          { name: "Wife of Owner", description: "Co-manages finances" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Invoice Submission Portal", description: "Portal for consultants to submit invoices", priority: "must-have" },
          { name: "Automated Reminders", description: "Reminder system", priority: "should-have" },
          { name: "Reporting and Analytics", description: "Reports and analytics", priority: "must-have" },
          { name: "Status Tracking", description: "Track status", priority: "must-have" },
          { name: "Workflow Visualization Dashboard", description: "Visualize workflow", priority: "should-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const metrics = docs.analyzeMermaidRelationships(req);

      // Should detect orphaned actors (Wife of Owner likely has no clear connections)
      expect(metrics.actorsWithNoConnections.length).toBeGreaterThan(0);
      
      // Should detect orphaned key modules (Workflow Dashboard, Status Tracking if poorly described)
      expect(metrics.keyModulesMissingOrOrphaned.length).toBeGreaterThan(0);
    });

    it("should detect no issues in a well-extracted summary", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Manage consultant invoices",
        secondaryGoals: [],
        currentTools: ["Time Doctor", "Payoneer"],
        mainActors: [
          { name: "Consultants", description: "Consultants submit invoices through the Invoice Submission Portal" },
          { name: "Owner", description: "Owner reviews invoices using Status Tracking and Reporting and Analytics and monitors via Workflow Visualization Dashboard" },
          { name: "Wife of Owner", description: "Wife of Owner uses Reporting and Analytics and Status Tracking to help manage finances" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Invoice Submission Portal", description: "Portal for consultants to submit invoices", priority: "must-have" },
          { name: "Automated Reminders", description: "Reminder system for consultants about deadlines", priority: "should-have" },
          { name: "Reporting and Analytics", description: "Reports for owner and wife of owner", priority: "must-have" },
          { name: "Status Tracking", description: "Track invoice status used by owner and wife of owner", priority: "must-have" },
          { name: "Workflow Visualization Dashboard", description: "Dashboard for owner and wife of owner to visualize workflow", priority: "should-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const metrics = docs.analyzeMermaidRelationships(req);

      // All actors should be connected
      expect(metrics.actorsWithNoConnections).toHaveLength(0);
      
      // No key modules should be orphaned
      expect(metrics.keyModulesMissingOrOrphaned).toHaveLength(0);
      
      // No suspicious client edges
      expect(metrics.suspiciousClientEdges).toHaveLength(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty actors gracefully", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Test",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Module", description: "Test module", priority: "must-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const metrics = docs.analyzeMermaidRelationships(req);

      expect(metrics.actorsWithNoConnections).toHaveLength(0);
      expect(metrics.modulesWithNoConnections).toHaveLength(0);
      expect(metrics.suspiciousClientEdges).toHaveLength(0);
      expect(metrics.keyModulesMissingOrOrphaned).toHaveLength(0);
    });

    it("should handle empty modules gracefully", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Test",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [
          { name: "User", description: "Test user" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const metrics = docs.analyzeMermaidRelationships(req);

      expect(metrics.actorsWithNoConnections).toHaveLength(0);
      expect(metrics.modulesWithNoConnections).toHaveLength(0);
      expect(metrics.suspiciousClientEdges).toHaveLength(0);
      expect(metrics.keyModulesMissingOrOrphaned).toHaveLength(0);
    });
  });
});

