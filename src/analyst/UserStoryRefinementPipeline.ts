import { LLMProvider } from "../llm/LLMProvider";
import { StoryGenerator, UserStoryMetrics } from "./StoryGenerator";
import { SYSTEM_PROMPT_STORY_REFINER } from "./prompts";
import { RequirementsSummary, UserStoriesOutput } from "./RequirementsTypes";

/**
 * Result of the user story refinement pipeline.
 */
export interface StoryRefinementPipelineResult {
  userStories: UserStoriesOutput;
  markdown: string;
  wasRefined: boolean;
  metrics: UserStoryMetrics;
}

/**
 * Orchestrates two-pass user story generation with optional refinement.
 * 
 * Pipeline:
 * 1. First pass with gpt-4o-mini (fast, cheap)
 * 2. Analyze story quality
 * 3. If issues detected, refine with gpt-4o (slow, expensive)
 * 4. Return final stories + markdown
 */
export class UserStoryRefinementPipeline {
  constructor(
    private llmMini: LLMProvider,
    private llmFull: LLMProvider,
    private storyGen: StoryGenerator,
    private markdownGenerator: (stories: UserStoriesOutput) => string
  ) {}

  /**
   * Decide if refinement is needed based on quality metrics.
   */
  private needsRefinement(metrics: UserStoryMetrics): boolean {
    // Quality score threshold: below 70 triggers refinement
    if (metrics.totalQualityScore < 70) {
      return true;
    }

    // Missing acceptance criteria is critical
    if (metrics.storiesWithoutAcceptanceCriteria.length > 0) {
      return true;
    }

    // Multiple vague actions indicate low quality
    if (metrics.storiesWithVagueActions.length >= 3) {
      return true;
    }

    return false;
  }

  /**
   * Refine user stories using the larger model.
   */
  private async refineStories(
    requirements: RequirementsSummary,
    originalStories: UserStoriesOutput,
    metrics: UserStoryMetrics
  ): Promise<UserStoriesOutput> {
    try {
      const userMessage = {
        requirements,
        originalUserStories: originalStories,
        qualityMetrics: metrics,
      };

      const json = await this.llmFull.chat({
        messages: [
          { role: "system", content: SYSTEM_PROMPT_STORY_REFINER },
          { 
            role: "user", 
            content: `Please return a refined UserStoriesOutput JSON, improving the stories to fix the issues indicated in qualityMetrics.\n\n${JSON.stringify(userMessage, null, 2)}`
          },
        ],
        responseFormat: "json",
        temperature: 0.3,
      });

      const refined = JSON.parse(json) as UserStoriesOutput;
      
      // Re-validate counts
      const actualTotal = refined.epics.reduce(
        (sum, epic) => sum + epic.stories.length,
        0
      );
      refined.totalStories = actualTotal;

      const priorityCounts = {
        mustHave: 0,
        shouldHave: 0,
        niceToHave: 0,
      };

      refined.epics.forEach((epic) => {
        epic.stories.forEach((story) => {
          if (story.priority === "must-have") priorityCounts.mustHave++;
          else if (story.priority === "should-have") priorityCounts.shouldHave++;
          else if (story.priority === "nice-to-have") priorityCounts.niceToHave++;
        });
      });

      refined.byPriority = priorityCounts;
      
      return refined;
    } catch (error) {
      console.error("❌ [Story Refinement] Error during refinement, falling back to original:", error);
      return originalStories;
    }
  }

  /**
   * Run the full story generation pipeline with optional refinement.
   */
  async generateWithRefinement(
    requirements: RequirementsSummary,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<StoryRefinementPipelineResult> {
    console.log("🚀 [Story Generation] Starting with gpt-4o-mini");
    
    if (onProgress) onProgress(30, "Sunny is crafting user stories...");
    
    // 1) First pass with mini model
    const baseStories = await this.storyGen.generateFromRequirements(requirements);

    if (onProgress) onProgress(55, "Sunny is analyzing story quality...");
    
    // 2) Analyze quality
    const metrics = this.storyGen.analyzeStoryQuality(baseStories);
    console.log(`📊 [Story Quality] Score: ${metrics.totalQualityScore}/100`);
    
    if (metrics.storiesWithoutAcceptanceCriteria.length > 0) {
      console.log(`⚠️  [Story Quality] ${metrics.storiesWithoutAcceptanceCriteria.length} stories missing acceptance criteria`);
    }
    if (metrics.storiesWithVagueActions.length > 0) {
      console.log(`⚠️  [Story Quality] ${metrics.storiesWithVagueActions.length} stories with vague actions`);
    }
    if (metrics.storiesWithoutBenefits.length > 0) {
      console.log(`⚠️  [Story Quality] ${metrics.storiesWithoutBenefits.length} stories missing benefits`);
    }

    // 3) Decide if refinement is needed
    let finalStories = baseStories;
    let wasRefined = false;

    if (this.needsRefinement(metrics)) {
      console.log("🔄 [Story Refinement] Quality issues detected, refining with gpt-4o");
      if (onProgress) onProgress(65, "Sunny is refining story quality...");
      
      finalStories = await this.refineStories(requirements, baseStories, metrics);
      wasRefined = true;
      
      if (onProgress) onProgress(80, "Sunny is verifying improvements...");
      
      // Re-analyze to show improvement
      const refinedMetrics = this.storyGen.analyzeStoryQuality(finalStories);
      console.log(`✅ [Story Refinement] Complete. New score: ${refinedMetrics.totalQualityScore}/100`);
    } else {
      console.log("✅ [Story Generation] Quality acceptable, using gpt-4o-mini result");
      if (onProgress) onProgress(75, "Sunny is organizing user stories...");
    }

    if (onProgress) onProgress(90, "Sunny is generating documentation...");
    
    // 4) Generate markdown
    const markdown = this.markdownGenerator(finalStories);

    return {
      userStories: finalStories,
      markdown,
      wasRefined,
      metrics,
    };
  }
}

