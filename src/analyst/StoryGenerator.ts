import type { LLMProvider } from "../llm/LLMProvider";
import type { RequirementsSummary, UserStoriesOutput } from "./RequirementsTypes";
import { SYSTEM_PROMPT_STORY_GENERATOR } from "./prompts";

/**
 * Metrics to diagnose user story quality issues.
 */
export interface UserStoryMetrics {
  storiesWithoutAcceptanceCriteria: string[];
  storiesWithVagueActions: string[];
  storiesWithoutBenefits: string[];
  epicsWithFewStories: string[];
  totalQualityScore: number; // 0-100, higher is better
}

export class StoryGenerator {
  constructor(private llm: LLMProvider) {}

  async generateFromRequirements(
    requirements: RequirementsSummary
  ): Promise<UserStoriesOutput> {
    const messages = [
      {
        role: "system" as const,
        content: SYSTEM_PROMPT_STORY_GENERATOR,
      },
      {
        role: "user" as const,
        content: JSON.stringify(requirements, null, 2),
      },
    ];

    const json = await this.llm.chat({
      messages,
      responseFormat: "json",
    });

    const userStories = JSON.parse(json) as UserStoriesOutput;

    // Validation
    if (!userStories.epics || userStories.epics.length === 0) {
      throw new Error("No epics generated");
    }

    // Ensure counts are accurate
    const actualTotal = userStories.epics.reduce(
      (sum, epic) => sum + epic.stories.length,
      0
    );
    userStories.totalStories = actualTotal;

    const priorityCounts = {
      mustHave: 0,
      shouldHave: 0,
      niceToHave: 0,
    };

    userStories.epics.forEach((epic) => {
      epic.stories.forEach((story) => {
        if (story.priority === "must-have") priorityCounts.mustHave++;
        else if (story.priority === "should-have") priorityCounts.shouldHave++;
        else if (story.priority === "nice-to-have") priorityCounts.niceToHave++;
      });
    });

    userStories.byPriority = priorityCounts;

    return userStories;
  }

  /**
   * Analyze user story quality and return diagnostic metrics.
   */
  analyzeStoryQuality(userStories: UserStoriesOutput): UserStoryMetrics {
    const metrics: UserStoryMetrics = {
      storiesWithoutAcceptanceCriteria: [],
      storiesWithVagueActions: [],
      storiesWithoutBenefits: [],
      epicsWithFewStories: [],
      totalQualityScore: 100,
    };

    // Vague action keywords that indicate low quality
    const vagueKeywords = ['manage', 'handle', 'deal with', 'work with', 'use', 'access'];
    
    for (const epic of userStories.epics) {
      // Check epic story count
      if (epic.stories.length < 2 && userStories.epics.length > 1) {
        metrics.epicsWithFewStories.push(epic.name);
      }

      for (const story of epic.stories) {
        // Check acceptance criteria
        if (!story.acceptanceCriteria || story.acceptanceCriteria.length === 0) {
          metrics.storiesWithoutAcceptanceCriteria.push(story.id);
        }

        // Check for vague actions
        const actionLower = story.action.toLowerCase();
        const isVague = vagueKeywords.some(keyword => 
          actionLower.startsWith(keyword) && actionLower.split(' ').length <= 3
        );
        if (isVague) {
          metrics.storiesWithVagueActions.push(story.id);
        }

        // Check for missing or vague benefits
        if (!story.benefit || story.benefit.trim().length < 10) {
          metrics.storiesWithoutBenefits.push(story.id);
        }
      }
    }

    // Calculate quality score (0-100)
    const totalStories = userStories.totalStories;
    if (totalStories === 0) {
      metrics.totalQualityScore = 0;
      return metrics;
    }

    let deductions = 0;
    
    // Deduct points for issues (max 100 points total)
    deductions += metrics.storiesWithoutAcceptanceCriteria.length * 15; // 15 points per missing AC
    deductions += metrics.storiesWithVagueActions.length * 10; // 10 points per vague action
    deductions += metrics.storiesWithoutBenefits.length * 10; // 10 points per missing benefit
    deductions += metrics.epicsWithFewStories.length * 5; // 5 points per thin epic

    metrics.totalQualityScore = Math.max(0, 100 - deductions);

    return metrics;
  }
}


