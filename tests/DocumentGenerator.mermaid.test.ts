import { DocumentGenerator } from "../src/analyst/DocumentGenerator";
import { RequirementsSummary, Actor, CandidateModule } from "../src/analyst/RequirementsTypes";

// Helper to parse edges from Mermaid output
function parseEdges(mermaidOutput: string): Set<string> {
  const edges = new Set<string>();
  const lines = mermaidOutput.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^\s*(\w+)\s*-->\s*(\w+)/);
    if (match) {
      edges.add(`${match[1]} --> ${match[2]}`);
    }
  }
  
  return edges;
}

// Helper to generate expected ID (matches production logic)
function makeExpectedId(name: string, usedIds: Set<string>): string {
  let base = name.trim().toLowerCase()
    .replace(/[^a-z0-9_ ]+/g, "")
    .replace(/\s+/g, "_");
  
  if (!base) base = "node";
  
  let id = base;
  let counter = 1;
  while (usedIds.has(id)) {
    id = `${base}_${counter++}`;
  }
  usedIds.add(id);
  return id;
}

describe("DocumentGenerator.generateMermaidFlow", () => {
  describe("Consulting/Invoices Domain", () => {
    it("should connect consultant to invoice-related modules but not to reporting", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Manage consultant invoices and track time",
        secondaryGoals: [],
        currentTools: ["Time Doctor"],
        mainActors: [
          { name: "Consultant", description: "Freelancers who submit invoices" },
          { name: "Company Owner", description: "Reviews and approves invoices" }
        ],
        painPoints: [
          { description: "Consultants need an easy way to submit invoices", impact: "high", frequency: "often" }
        ],
        dataEntities: [],
        candidateModules: [
          { name: "Invoice Submission Portal", description: "Portal for consultants to upload and track invoices", priority: "must-have" },
          { name: "Time Tracking", description: "Time tracking for consultants using Time Doctor integration", priority: "must-have" },
          { name: "Reporting and Analytics", description: "Dashboard for owner to view reports and analytics", priority: "should-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const generator = new DocumentGenerator();
      const output = generator.generateMermaidFlow(req);
      const edges = parseEdges(output);

      // Generate expected IDs
      const usedIds = new Set<string>();
      const consultantId = makeExpectedId("Consultant", usedIds);
      const companyOwnerId = makeExpectedId("Company Owner", usedIds);
      const invoiceId = makeExpectedId("Invoice Submission Portal", usedIds);
      const timeTrackingId = makeExpectedId("Time Tracking", usedIds);
      const reportingId = makeExpectedId("Reporting and Analytics", usedIds);

      // Consultant should connect to invoice and time tracking
      expect(edges.has(`${consultantId} --> ${invoiceId}`)).toBe(true);
      expect(edges.has(`${consultantId} --> ${timeTrackingId}`)).toBe(true);
      
      // Consultant should NOT connect to reporting
      expect(edges.has(`${consultantId} --> ${reportingId}`)).toBe(false);
      
      // Company Owner should connect to reporting
      expect(edges.has(`${companyOwnerId} --> ${reportingId}`)).toBe(true);
    });
  });

  describe("E-commerce Domain", () => {
    it("should connect customer to catalog but not to admin panel", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Build an online store",
        secondaryGoals: ["Manage inventory", "Process orders"],
        currentTools: [],
        mainActors: [
          { name: "Customer", description: "Users who browse and purchase products" },
          { name: "Admin", description: "Store administrators who manage products" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Product Catalog", description: "Browse products for customers", priority: "must-have" },
          { name: "Order Management", description: "System for customers to place orders", priority: "must-have" },
          { name: "Admin Panel", description: "Admin interface for managing store", priority: "must-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const generator = new DocumentGenerator();
      const output = generator.generateMermaidFlow(req);
      const edges = parseEdges(output);

      const usedIds = new Set<string>();
      const customerId = makeExpectedId("Customer", usedIds);
      const adminId = makeExpectedId("Admin", usedIds);
      const catalogId = makeExpectedId("Product Catalog", usedIds);
      const adminPanelId = makeExpectedId("Admin Panel", usedIds);

      // Customer should connect to catalog
      expect(edges.has(`${customerId} --> ${catalogId}`)).toBe(true);
      
      // Customer should NOT connect to admin panel
      expect(edges.has(`${customerId} --> ${adminPanelId}`)).toBe(false);
      
      // Admin should connect to admin panel
      expect(edges.has(`${adminId} --> ${adminPanelId}`)).toBe(true);
    });
  });

  describe("No Clear Relationships", () => {
    it("should not create spurious connections when no clear relationship exists", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Improve operations",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [
          { name: "Maintenance Team", description: "Handles equipment maintenance" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Customer Feedback Portal", description: "Collect customer feedback", priority: "should-have" },
          { name: "Marketing Analytics", description: "Marketing campaign analytics", priority: "should-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const generator = new DocumentGenerator();
      const output = generator.generateMermaidFlow(req);
      const edges = parseEdges(output);

      const usedIds = new Set<string>();
      const maintenanceId = makeExpectedId("Maintenance Team", usedIds);
      const feedbackId = makeExpectedId("Customer Feedback Portal", usedIds);
      const analyticsId = makeExpectedId("Marketing Analytics", usedIds);

      // Should not create edges with no clear relationship
      expect(edges.has(`${maintenanceId} --> ${feedbackId}`)).toBe(false);
      expect(edges.has(`${maintenanceId} --> ${analyticsId}`)).toBe(false);
    });
  });

  describe("Custom Threshold Tests", () => {
    it("should create more edges with lower threshold", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Manage projects",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [
          { name: "Project Manager", description: "Manages projects" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Project Dashboard", description: "Dashboard for managers", priority: "must-have" },
          { name: "Task Management", description: "Manage tasks", priority: "should-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const generatorLowThreshold = new DocumentGenerator(1);
      const outputLow = generatorLowThreshold.generateMermaidFlow(req);
      const edgesLow = parseEdges(outputLow);

      const generatorHighThreshold = new DocumentGenerator(4);
      const outputHigh = generatorHighThreshold.generateMermaidFlow(req);
      const edgesHigh = parseEdges(outputHigh);

      // Lower threshold should produce more or equal edges
      expect(edgesLow.size).toBeGreaterThanOrEqual(edgesHigh.size);
    });
  });

  describe("Simple Mode Test", () => {
    it("should generate full bipartite graph in simple mode", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Test simple mode",
        secondaryGoals: [],
        currentTools: [],
        mainActors: [
          { name: "Actor1", description: "First actor" },
          { name: "Actor2", description: "Second actor" }
        ],
        painPoints: [],
        dataEntities: [],
        candidateModules: [
          { name: "Module1", description: "First module", priority: "must-have" },
          { name: "Module2", description: "Second module", priority: "must-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const generator = new DocumentGenerator(2, true); // Enable simple mode
      const output = generator.generateMermaidFlow(req);
      const edges = parseEdges(output);

      // In simple mode, should have all combinations: 2 actors × 2 modules = 4 edges
      expect(edges.size).toBe(4);
    });
  });

  describe("Real-World Consulting Scenario", () => {
    it("should handle client roles correctly without spurious fallbacks", () => {
      const req: RequirementsSummary = {
        businessContext: {},
        primaryGoal: "Manage consultant invoices for Omnigo",
        secondaryGoals: [],
        currentTools: ["Spreadsheet", "Payoneer"],
        mainActors: [
          { name: "Client (Omnigo)", description: "External client" },
          { name: "Consultants", description: "Freelancers submitting invoices" },
          { name: "Owner", description: "Company owner managing finances" },
          { name: "Wife of Owner", description: "Co-manages financial operations" }
        ],
        painPoints: [
          { description: "Consultants need invoice submission portal", impact: "high", frequency: "often" },
          { description: "Owner needs visibility into payment status", impact: "high", frequency: "often" }
        ],
        dataEntities: [],
        candidateModules: [
          { name: "Invoice Submission Portal", description: "Portal for consultants to submit invoices", priority: "must-have" },
          { name: "Automated Reminders", description: "Reminder system for deadlines", priority: "should-have" },
          { name: "Reporting and Analytics", description: "Dashboard for owner to view reports and analytics", priority: "must-have" },
          { name: "Status Tracking", description: "Track invoice and payment status for management", priority: "must-have" }
        ],
        nonFunctionalNeeds: [],
        risksAndConstraints: [],
        openQuestions: [],
        uploadedDocuments: []
      };

      const generator = new DocumentGenerator();
      const output = generator.generateMermaidFlow(req);
      const edges = parseEdges(output);

      const usedIds = new Set<string>();
      const clientId = makeExpectedId("Client (Omnigo)", usedIds);
      const consultantsId = makeExpectedId("Consultants", usedIds);
      const ownerId = makeExpectedId("Owner", usedIds);
      const wifeId = makeExpectedId("Wife of Owner", usedIds);
      const invoicePortalId = makeExpectedId("Invoice Submission Portal", usedIds);
      const reportingId = makeExpectedId("Reporting and Analytics", usedIds);
      const statusId = makeExpectedId("Status Tracking", usedIds);
      const remindersId = makeExpectedId("Automated Reminders", usedIds);

      // Positive assertions
      expect(edges.has(`${consultantsId} --> ${invoicePortalId}`)).toBe(true);
      expect(edges.has(`${ownerId} --> ${reportingId}`)).toBe(true);
      expect(edges.has(`${ownerId} --> ${statusId}`)).toBe(true);
      expect(edges.has(`${wifeId} --> ${reportingId}`)).toBe(true);
      expect(edges.has(`${wifeId} --> ${statusId}`)).toBe(true);

      // Negative assertions - client should NOT have spurious fallback
      expect(edges.has(`${clientId} --> ${remindersId}`)).toBe(false);
      
      // Verify Status Tracking node exists
      expect(output.includes('status_tracking')).toBe(true);
    });
  });
});

