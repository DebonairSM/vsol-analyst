import { StoryGenerator, UserStoryMetrics } from "../src/analyst/StoryGenerator";
import { UserStoriesOutput } from "../src/analyst/RequirementsTypes";

describe("User Story Quality Analysis", () => {
  // Mock LLM - we're testing the quality analysis logic, not generation
  const mockLLM = {
    chat: jest.fn().mockResolvedValue("{}"),
  };
  
  const storyGen = new StoryGenerator(mockLLM as any);

  describe("analyzeStoryQuality", () => {
    it("should detect stories without acceptance criteria", () => {
      const stories: UserStoriesOutput = {
        totalStories: 2,
        byPriority: { mustHave: 2, shouldHave: 0, niceToHave: 0 },
        epics: [
          {
            name: "User Management",
            description: "Epic for user features",
            icon: "👤",
            stories: [
              {
                id: "US-001",
                epicName: "User Management",
                title: "Create User",
                actor: "Admin",
                action: "create a new user account",
                benefit: "onboard new team members",
                acceptanceCriteria: [], // Missing!
                priority: "must-have",
                effort: "medium",
              },
              {
                id: "US-002",
                epicName: "User Management",
                title: "Delete User",
                actor: "Admin",
                action: "delete a user account",
                benefit: "remove inactive users",
                acceptanceCriteria: [
                  { description: "User is marked as deleted" },
                  { description: "User cannot log in" },
                ],
                priority: "must-have",
                effort: "small",
              },
            ],
          },
        ],
      };

      const metrics = storyGen.analyzeStoryQuality(stories);

      expect(metrics.storiesWithoutAcceptanceCriteria).toContain("US-001");
      expect(metrics.storiesWithoutAcceptanceCriteria).not.toContain("US-002");
    });

    it("should detect vague actions", () => {
      const stories: UserStoriesOutput = {
        totalStories: 3,
        byPriority: { mustHave: 3, shouldHave: 0, niceToHave: 0 },
        epics: [
          {
            name: "Invoice Management",
            description: "Epic for invoices",
            icon: "📄",
            stories: [
              {
                id: "US-001",
                epicName: "Invoice Management",
                title: "Manage Invoices",
                actor: "Owner",
                action: "manage invoices", // Vague!
                benefit: "handle billing",
                acceptanceCriteria: [{ description: "Can manage" }],
                priority: "must-have",
                effort: "large",
              },
              {
                id: "US-002",
                epicName: "Invoice Management",
                title: "Create Invoice",
                actor: "Owner",
                action: "create a new invoice with line items", // Specific!
                benefit: "bill clients",
                acceptanceCriteria: [{ description: "Invoice is created" }],
                priority: "must-have",
                effort: "medium",
              },
              {
                id: "US-003",
                epicName: "Invoice Management",
                title: "Use System",
                actor: "User",
                action: "use", // Vague!
                benefit: "work",
                acceptanceCriteria: [{ description: "Can use" }],
                priority: "must-have",
                effort: "small",
              },
            ],
          },
        ],
      };

      const metrics = storyGen.analyzeStoryQuality(stories);

      expect(metrics.storiesWithVagueActions).toContain("US-001");
      expect(metrics.storiesWithVagueActions).toContain("US-003");
      expect(metrics.storiesWithVagueActions).not.toContain("US-002");
    });

    it("should detect missing or weak benefits", () => {
      const stories: UserStoriesOutput = {
        totalStories: 2,
        byPriority: { mustHave: 2, shouldHave: 0, niceToHave: 0 },
        epics: [
          {
            name: "Reporting",
            description: "Epic for reports",
            icon: "📊",
            stories: [
              {
                id: "US-001",
                epicName: "Reporting",
                title: "View Report",
                actor: "Owner",
                action: "view monthly reports",
                benefit: "see data", // Too short/vague
                acceptanceCriteria: [{ description: "Report displays" }],
                priority: "must-have",
                effort: "medium",
              },
              {
                id: "US-002",
                epicName: "Reporting",
                title: "Export Report",
                actor: "Owner",
                action: "export report to Excel",
                benefit: "share financial data with accountant and make tax preparation easier",
                acceptanceCriteria: [{ description: "Excel file downloads" }],
                priority: "must-have",
                effort: "small",
              },
            ],
          },
        ],
      };

      const metrics = storyGen.analyzeStoryQuality(stories);

      expect(metrics.storiesWithoutBenefits).toContain("US-001");
      expect(metrics.storiesWithoutBenefits).not.toContain("US-002");
    });

    it("should detect epics with few stories", () => {
      const stories: UserStoriesOutput = {
        totalStories: 3,
        byPriority: { mustHave: 3, shouldHave: 0, niceToHave: 0 },
        epics: [
          {
            name: "Core Features",
            description: "Main features",
            icon: "⭐",
            stories: [
              {
                id: "US-001",
                epicName: "Core Features",
                title: "Feature A",
                actor: "User",
                action: "do something",
                benefit: "get value",
                acceptanceCriteria: [{ description: "Works" }],
                priority: "must-have",
                effort: "medium",
              },
              {
                id: "US-002",
                epicName: "Core Features",
                title: "Feature B",
                actor: "User",
                action: "do another thing",
                benefit: "get more value",
                acceptanceCriteria: [{ description: "Also works" }],
                priority: "must-have",
                effort: "medium",
              },
            ],
          },
          {
            name: "Edge Case",
            description: "Rare feature",
            icon: "🔧",
            stories: [
              {
                id: "US-003",
                epicName: "Edge Case",
                title: "Single Story",
                actor: "Admin",
                action: "do rare thing",
                benefit: "handle edge case",
                acceptanceCriteria: [{ description: "Handles it" }],
                priority: "nice-to-have",
                effort: "small",
              },
            ],
          },
        ],
      };

      const metrics = storyGen.analyzeStoryQuality(stories);

      expect(metrics.epicsWithFewStories).toContain("Edge Case");
      expect(metrics.epicsWithFewStories).not.toContain("Core Features");
    });

    it("should calculate quality score based on issues", () => {
      const perfectStories: UserStoriesOutput = {
        totalStories: 2,
        byPriority: { mustHave: 2, shouldHave: 0, niceToHave: 0 },
        epics: [
          {
            name: "Features",
            description: "Feature set",
            icon: "✨",
            stories: [
              {
                id: "US-001",
                epicName: "Features",
                title: "Create Widget",
                actor: "User",
                action: "create a new widget with custom settings",
                benefit: "organize my workflow efficiently",
                acceptanceCriteria: [
                  { description: "Widget form opens" },
                  { description: "Settings are saved" },
                  { description: "Widget appears in list" },
                ],
                priority: "must-have",
                effort: "medium",
              },
              {
                id: "US-002",
                epicName: "Features",
                title: "Delete Widget",
                actor: "User",
                action: "delete an existing widget",
                benefit: "remove widgets I no longer need",
                acceptanceCriteria: [
                  { description: "Confirmation dialog appears" },
                  { description: "Widget is removed" },
                ],
                priority: "must-have",
                effort: "small",
              },
            ],
          },
        ],
      };

      const perfectMetrics = storyGen.analyzeStoryQuality(perfectStories);
      expect(perfectMetrics.totalQualityScore).toBe(100);

      const poorStories: UserStoriesOutput = {
        totalStories: 2,
        byPriority: { mustHave: 2, shouldHave: 0, niceToHave: 0 },
        epics: [
          {
            name: "Features",
            description: "Features",
            icon: "✨",
            stories: [
              {
                id: "US-001",
                epicName: "Features",
                title: "Do Thing",
                actor: "User",
                action: "use", // Vague (10 points)
                benefit: "work", // Too short (10 points)
                acceptanceCriteria: [], // Missing (15 points)
                priority: "must-have",
                effort: "medium",
              },
              {
                id: "US-002",
                epicName: "Features",
                title: "Manage Stuff",
                actor: "User",
                action: "manage", // Vague (10 points)
                benefit: "", // Missing (10 points)
                acceptanceCriteria: [], // Missing (15 points)
                priority: "must-have",
                effort: "small",
              },
            ],
          },
        ],
      };

      const poorMetrics = storyGen.analyzeStoryQuality(poorStories);
      // Should deduct: 2*15 (missing AC) + 2*10 (vague) + 2*10 (no benefit) = 70 points
      expect(poorMetrics.totalQualityScore).toBe(30);
    });
  });
});

