import type { LLMProvider } from "../llm/LLMProvider";
import type { RequirementsSummary, UserStoriesOutput } from "./RequirementsTypes";
import { SYSTEM_PROMPT_STORY_GENERATOR } from "./prompts";

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
}


