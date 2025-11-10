import { DocumentGenerator } from "../src/analyst/DocumentGenerator";
import { RequirementsSummary } from "../src/analyst/RequirementsTypes";

describe("Mermaid Output Validation", () => {
  const docs = new DocumentGenerator();

  it("should wrap output in mermaid code blocks", () => {
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
      candidateModules: [
        { name: "Module", description: "Test module", priority: "must-have" }
      ],
      nonFunctionalNeeds: [],
      risksAndConstraints: [],
      openQuestions: [],
      uploadedDocuments: []
    };

    const output = docs.generateMermaidFlow(req);

    expect(output.startsWith("```mermaid\n")).toBe(true);
    expect(output.endsWith("\n```")).toBe(true);
  });

  it("should separate actor edges from tool edges with blank line", () => {
    const req: RequirementsSummary = {
      businessContext: {},
      primaryGoal: "Test edge separation",
      secondaryGoals: [],
      currentTools: ["Time Doctor"],
      mainActors: [
        { name: "Owner", description: "Owner uses dashboard" }
      ],
      painPoints: [],
      dataEntities: [],
      candidateModules: [
        { name: "Dashboard", description: "Dashboard integrates with Time Doctor for owner", priority: "must-have" }
      ],
      nonFunctionalNeeds: [],
      risksAndConstraints: [],
      openQuestions: [],
      uploadedDocuments: []
    };

    const output = docs.generateMermaidFlow(req);
    const cleanOutput = output.replace(/^```mermaid\n/, '').replace(/\n```$/, '');
    const lines = cleanOutput.split('\n');

    // Find the last actor edge and first tool edge
    let lastActorEdgeIndex = -1;
    let firstToolEdgeIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('-->') && !line.includes('%% integration') && !line.includes('%% fallback')) {
        lastActorEdgeIndex = i;
      }
      if (line.includes('%% integration') && firstToolEdgeIndex === -1) {
        firstToolEdgeIndex = i;
      }
    }

    // If both types exist, there should be a blank line between them
    if (lastActorEdgeIndex >= 0 && firstToolEdgeIndex >= 0) {
      expect(firstToolEdgeIndex - lastActorEdgeIndex).toBeGreaterThan(1);
      expect(lines[lastActorEdgeIndex + 1].trim()).toBe('');
    }
  });

  it("should produce valid mermaid syntax without consecutive comments", () => {
    const req: RequirementsSummary = {
      businessContext: {},
      primaryGoal: "Manage invoices",
      secondaryGoals: [],
      currentTools: ["Time Doctor", "Payoneer", "Spreadsheet"],
      mainActors: [
        { name: "Owner", description: "Owner manages invoices" },
        { name: "Consultant", description: "Consultant submits invoices" }
      ],
      painPoints: [],
      dataEntities: [],
      candidateModules: [
        { name: "Invoice Portal", description: "Portal for consultants and owner to manage invoices", priority: "must-have" },
        { name: "Time Tracking", description: "Integration with Time Doctor for tracking", priority: "must-have" },
        { name: "Payment Export", description: "Export payments to Payoneer and Spreadsheet", priority: "must-have" }
      ],
      nonFunctionalNeeds: [],
      risksAndConstraints: [],
      openQuestions: [],
      uploadedDocuments: []
    };

    const output = docs.generateMermaidFlow(req);
    const lines = output.split('\n');

    // Check no consecutive lines end with %% comments without proper separation
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i].trim();
      const nextLine = lines[i + 1].trim();
      
      // If current line has a comment
      if (currentLine.includes('%%')) {
        // Next line should either be empty, another comment line, or a valid mermaid line
        // It should NOT start with a node ID immediately after a comment
        if (nextLine.length > 0 && !nextLine.startsWith('%%') && !nextLine.includes('-->')) {
          // This would be a syntax error - node definition immediately after edge with comment
          const nodeDefPattern = /^\w+\[/;
          expect(nodeDefPattern.test(nextLine)).toBe(false);
        }
      }
    }
  });

  it("should handle multiple tools without syntax errors", () => {
    const req: RequirementsSummary = {
      businessContext: {},
      primaryGoal: "Test multiple tool integrations",
      secondaryGoals: [],
      currentTools: [
        "Time Doctor",
        "Payoneer", 
        "Wells Fargo",
        "Excel Spreadsheet",
        "OneDrive"
      ],
      mainActors: [
        { name: "Owner", description: "Owner manages everything" }
      ],
      painPoints: [],
      dataEntities: [],
      candidateModules: [
        { name: "Dashboard", description: "Dashboard integrates Time Doctor and Excel Spreadsheet", priority: "must-have" },
        { name: "Payment System", description: "Payments via Payoneer and Wells Fargo", priority: "must-have" },
        { name: "Storage", description: "Files stored in OneDrive", priority: "should-have" }
      ],
      nonFunctionalNeeds: [],
      risksAndConstraints: [],
      openQuestions: [],
      uploadedDocuments: []
    };

    const output = docs.generateMermaidFlow(req);
    
    // Should not have parse errors when rendered
    expect(output).toContain("```mermaid");
    expect(output).toContain("flowchart TD");
    expect(output).toContain("```");
    
    // Count integration comments - should match number of tool->module connections
    const integrationComments = (output.match(/%% integration/g) || []).length;
    expect(integrationComments).toBeGreaterThan(0);
  });

  it("should produce parseable output for real-world consulting scenario", () => {
    const req: RequirementsSummary = {
      businessContext: {
        companyName: "Test Company",
        industry: "Consulting"
      },
      primaryGoal: "Manage consultant invoices",
      secondaryGoals: [],
      currentTools: [
        "Time Doctor",
        "Payoneer",
        "Wells Fargo bank account",
        "Spreadsheet for tracking invoices and payments"
      ],
      mainActors: [
        { name: "Client (Omnigo)", description: "External client who receives invoices" },
        { name: "Consultants", description: "Consultants submit invoices through Invoice Submission Portal" },
        { name: "Owner", description: "Owner reviews invoices and manages payments using Status Tracking and Reporting" },
        { name: "Wife of Owner", description: "Wife of Owner helps with reporting and status tracking" }
      ],
      painPoints: [],
      dataEntities: [],
      candidateModules: [
        { name: "Invoice Submission Portal", description: "Portal for consultants to submit invoices", priority: "must-have" },
        { name: "Status Tracking", description: "Track status for owner and wife of owner", priority: "must-have" },
        { name: "Reporting and Analytics", description: "Reports for owner and wife of owner", priority: "must-have" },
        { name: "Client Portal", description: "Portal for client to view invoices", priority: "should-have" },
        { name: "Integration with Time Tracking", description: "Backend integration with Time Doctor", priority: "must-have" },
        { name: "Payment Processing", description: "Process payments via Payoneer from Wells Fargo using spreadsheet data", priority: "must-have" }
      ],
      nonFunctionalNeeds: [],
      risksAndConstraints: [],
      openQuestions: [],
      uploadedDocuments: []
    };

    const output = docs.generateMermaidFlow(req);
    
    // Should be properly wrapped
    expect(output.startsWith("```mermaid\n")).toBe(true);
    expect(output.endsWith("\n```")).toBe(true);
    
    // Should have flowchart declaration
    expect(output).toContain("flowchart TD");
    
    // Should have actor nodes
    expect(output).toMatch(/client_omnigo\[/);
    expect(output).toMatch(/consultants\[/);
    expect(output).toMatch(/owner\[/);
    expect(output).toMatch(/wife_of_owner\[/);
    
    // Should have tool nodes
    expect(output).toMatch(/time_doctor\[/);
    
    // Should have edges
    expect(output).toContain("-->");
    
    // Verify no parsing issues by checking line structure
    const lines = output.split('\n');
    let inMermaidBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line === "```mermaid") {
        inMermaidBlock = true;
        continue;
      }
      
      if (line === "```") {
        inMermaidBlock = false;
        continue;
      }
      
      if (inMermaidBlock && line.trim().length > 0) {
        // Each non-empty line should be valid Mermaid syntax
        // Valid patterns: flowchart TD, node definitions, edges, or comments
        const validPatterns = [
          /^flowchart\s+TD$/,                    // flowchart declaration
          /^\s+\w+\[.*\]$/,                      // node definition
          /^\s+\w+\s+-->\s+\w+/,                 // edge
          /^\s*%%/                                // comment
        ];
        
        const isValid = validPatterns.some(pattern => pattern.test(line));
        expect(isValid).toBe(true);
      }
    }
  });
});

