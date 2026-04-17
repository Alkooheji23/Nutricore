import Parser from 'rss-parser';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { storage } from '../storage';
import type { InsertTrainerKnowledge, InsertLearningJobHistory } from '@shared/schema';

let openai: OpenAI | null = null;
const parser = new Parser();

function getOpenAIClient(): OpenAI | null {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    console.warn('[LearningService] OpenAI API key not configured, skipping AI operations');
    return null;
  }
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    });
  }
  return openai;
}

const KNOWLEDGE_SOURCES = [
  {
    name: 'ACE Fitness',
    type: 'rss_feed' as const,
    url: 'https://www.acefitness.org/education-and-resources/professional/prosource/rss/',
    categories: ['exercise_technique', 'programming', 'injury_prevention'],
  },
  {
    name: 'Precision Nutrition',
    type: 'rss_feed' as const,
    url: 'https://www.precisionnutrition.com/feed',
    categories: ['nutrition_science', 'recovery', 'behavior_change'],
  },
  {
    name: 'Breaking Muscle',
    type: 'rss_feed' as const,
    url: 'https://breakingmuscle.com/feed/',
    categories: ['exercise_technique', 'programming', 'strength_training'],
  },
];

const KNOWLEDGE_CATEGORIES = [
  'exercise_technique',
  'nutrition_science',
  'recovery',
  'programming',
  'injury_prevention',
  'behavior_change',
  'strength_training',
  'cardio_training',
  'flexibility_mobility',
] as const;

interface ArticleContent {
  title: string;
  content: string;
  link: string;
  pubDate?: string;
}

function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 64);
}

async function extractInsightsFromArticle(
  article: ArticleContent,
  sourceName: string
): Promise<InsertTrainerKnowledge[]> {
  try {
    const contentPreview = article.content.substring(0, 4000);
    
    const client = getOpenAIClient();
    if (!client) return [];
    
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a fitness knowledge extractor. Your job is to read fitness/nutrition articles and extract actionable insights that a personal trainer can apply when building workout or nutrition plans.

Extract 1-3 key insights from the article. Each insight should be:
- Actionable and practical (not just theory)
- Specific enough to apply to real training scenarios
- Written as knowledge the trainer "knows" (not citing the source)

For each insight, determine:
1. Category: One of ${KNOWLEDGE_CATEGORIES.join(', ')}
2. Subcategory: A more specific topic (e.g., "hypertrophy", "protein_timing", "sleep_optimization")
3. The insight itself: A clear, actionable principle
4. Application context: When/how to apply this (e.g., "when programming for muscle gain", "for athletes over 40")
5. Confidence score: 0.5-1.0 based on how well-supported the claim is
6. Relevance score: 0.5-1.0 based on how broadly applicable it is

Return JSON array of insights. If the article has no useful fitness/training insights, return empty array.

Example output:
[
  {
    "category": "programming",
    "subcategory": "hypertrophy",
    "insight": "For muscle growth, training each muscle group twice per week with 10-20 sets total produces better results than once-weekly higher volume.",
    "applicationContext": "When designing hypertrophy programs for intermediate to advanced lifters",
    "confidenceScore": 0.9,
    "relevanceScore": 0.85
  }
]`,
        },
        {
          role: 'user',
          content: `Article Title: ${article.title}\n\nContent:\n${contentPreview}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1000,
    });

    const result = response.choices[0]?.message?.content;
    if (!result) return [];

    const parsed = JSON.parse(result);
    const insights = parsed.insights || parsed || [];

    if (!Array.isArray(insights)) return [];

    return insights.map((insight: any) => ({
      category: insight.category || 'programming',
      subcategory: insight.subcategory,
      insight: insight.insight,
      applicationContext: insight.applicationContext,
      confidenceScore: insight.confidenceScore || 0.8,
      relevanceScore: insight.relevanceScore || 0.8,
      sourceType: 'rss_feed',
      sourceName: sourceName,
      sourceUrl: article.link,
      originalTitle: article.title,
      contentHash: generateContentHash(insight.insight),
      isActive: true,
    }));
  } catch (error) {
    console.error(`[LearningService] Error extracting insights from "${article.title}":`, error);
    return [];
  }
}

async function fetchRssFeed(source: typeof KNOWLEDGE_SOURCES[0]): Promise<ArticleContent[]> {
  try {
    console.log(`[LearningService] Fetching RSS feed: ${source.name}`);
    const feed = await parser.parseURL(source.url);
    
    const articles: ArticleContent[] = feed.items.slice(0, 5).map((item) => ({
      title: item.title || 'Untitled',
      content: item.contentSnippet || item.content || item.description || '',
      link: item.link || '',
      pubDate: item.pubDate,
    }));
    
    console.log(`[LearningService] Found ${articles.length} articles from ${source.name}`);
    return articles;
  } catch (error) {
    console.error(`[LearningService] Error fetching ${source.name}:`, error);
    return [];
  }
}

export async function runLearningJob(jobType: 'scheduled' | 'manual' = 'scheduled'): Promise<void> {
  console.log(`[LearningService] Starting ${jobType} learning job...`);
  
  const job = await storage.createLearningJob({
    jobType,
    status: 'running',
    sourcesUsed: KNOWLEDGE_SOURCES.map((s) => s.name),
  });

  let sourcesProcessed = 0;
  let articlesProcessed = 0;
  let insightsGenerated = 0;
  let duplicatesSkipped = 0;

  try {
    for (const source of KNOWLEDGE_SOURCES) {
      const articles = await fetchRssFeed(source);
      sourcesProcessed++;

      for (const article of articles) {
        articlesProcessed++;
        const insights = await extractInsightsFromArticle(article, source.name);

        for (const insight of insights) {
          const existing = await storage.getKnowledgeByHash(insight.contentHash!);
          if (existing) {
            duplicatesSkipped++;
            continue;
          }

          await storage.createKnowledge(insight);
          insightsGenerated++;
          console.log(`[LearningService] New insight: ${insight.insight.substring(0, 80)}...`);
        }
      }
    }

    await storage.updateLearningJob(job.id, {
      status: 'completed',
      completedAt: new Date(),
      sourcesProcessed,
      articlesProcessed,
      insightsGenerated,
      duplicatesSkipped,
    });

    console.log(`[LearningService] Job completed: ${insightsGenerated} new insights from ${articlesProcessed} articles`);
  } catch (error: any) {
    console.error(`[LearningService] Job failed:`, error);
    await storage.updateLearningJob(job.id, {
      status: 'failed',
      completedAt: new Date(),
      errorMessage: error.message || 'Unknown error',
      sourcesProcessed,
      articlesProcessed,
      insightsGenerated,
      duplicatesSkipped,
    });
  }
}

export async function getTrainerKnowledgeContext(categories?: string[]): Promise<string> {
  const relevantCategories = categories || [
    'exercise_technique',
    'programming',
    'nutrition_science',
    'recovery',
  ];
  
  const knowledge = await storage.getKnowledgeByCategories(relevantCategories, 20);
  
  if (knowledge.length === 0) {
    return '';
  }

  let context = '\n\nLEARNED KNOWLEDGE (apply these insights naturally when relevant):\n';
  
  for (const k of knowledge) {
    context += `- [${k.category}] ${k.insight}`;
    if (k.applicationContext) {
      context += ` (Apply: ${k.applicationContext})`;
    }
    context += '\n';
    
    await storage.markKnowledgeApplied(k.id);
  }

  return context;
}

export async function seedInitialKnowledge(): Promise<void> {
  const stats = await storage.getKnowledgeStats();
  if (stats.total > 0) {
    console.log(`[LearningService] Knowledge base already has ${stats.total} insights, skipping seed`);
    return;
  }

  console.log(`[LearningService] Seeding initial knowledge base...`);
  
  const fundamentalInsights: InsertTrainerKnowledge[] = [
    {
      category: 'programming',
      subcategory: 'progressive_overload',
      insight: 'Progressive overload is the foundation of strength gains - gradually increase weight, reps, or training volume over time to continue making progress.',
      applicationContext: 'When designing any strength training program',
      confidenceScore: 0.95,
      relevanceScore: 0.95,
      sourceType: 'research_summary',
      sourceName: 'Fundamental Training Principles',
      isActive: true,
      contentHash: generateContentHash('progressive_overload_fundamental'),
    },
    {
      category: 'nutrition_science',
      subcategory: 'protein_timing',
      insight: 'Distribute protein intake evenly across 3-5 meals per day (0.4-0.5g/kg per meal) rather than consuming most protein in one sitting for optimal muscle protein synthesis.',
      applicationContext: 'When advising on meal timing for muscle building or retention',
      confidenceScore: 0.85,
      relevanceScore: 0.9,
      sourceType: 'research_summary',
      sourceName: 'Fundamental Training Principles',
      isActive: true,
      contentHash: generateContentHash('protein_distribution_fundamental'),
    },
    {
      category: 'recovery',
      subcategory: 'sleep_optimization',
      insight: 'Aim for 7-9 hours of sleep per night as inadequate sleep impairs muscle recovery, hormone production, and training performance.',
      applicationContext: 'When athletes report fatigue, poor recovery, or stalled progress',
      confidenceScore: 0.95,
      relevanceScore: 0.95,
      sourceType: 'research_summary',
      sourceName: 'Fundamental Training Principles',
      isActive: true,
      contentHash: generateContentHash('sleep_recovery_fundamental'),
    },
    {
      category: 'exercise_technique',
      subcategory: 'compound_movements',
      insight: 'Prioritize compound movements (squats, deadlifts, presses, rows, pull-ups) as they train multiple muscle groups efficiently and build functional strength.',
      applicationContext: 'When programming for strength, muscle gain, or general fitness',
      confidenceScore: 0.95,
      relevanceScore: 0.95,
      sourceType: 'research_summary',
      sourceName: 'Fundamental Training Principles',
      isActive: true,
      contentHash: generateContentHash('compound_movements_fundamental'),
    },
    {
      category: 'programming',
      subcategory: 'frequency',
      insight: 'Training each muscle group 2-3 times per week with moderate volume per session produces better results than once-weekly high-volume training.',
      applicationContext: 'When setting training frequency for hypertrophy or strength programs',
      confidenceScore: 0.9,
      relevanceScore: 0.9,
      sourceType: 'research_summary',
      sourceName: 'Fundamental Training Principles',
      isActive: true,
      contentHash: generateContentHash('training_frequency_fundamental'),
    },
    {
      category: 'nutrition_science',
      subcategory: 'caloric_deficit',
      insight: 'For fat loss, a moderate caloric deficit of 300-500 calories per day preserves muscle mass better than aggressive deficits while still producing steady weight loss.',
      applicationContext: 'When setting nutrition targets for fat loss goals',
      confidenceScore: 0.9,
      relevanceScore: 0.9,
      sourceType: 'research_summary',
      sourceName: 'Fundamental Training Principles',
      isActive: true,
      contentHash: generateContentHash('moderate_deficit_fundamental'),
    },
    {
      category: 'recovery',
      subcategory: 'deload',
      insight: 'Plan deload weeks every 4-8 weeks of hard training to allow for recovery and prevent overtraining - reduce volume by 40-50% while maintaining intensity.',
      applicationContext: 'When programming for athletes who train consistently',
      confidenceScore: 0.85,
      relevanceScore: 0.85,
      sourceType: 'research_summary',
      sourceName: 'Fundamental Training Principles',
      isActive: true,
      contentHash: generateContentHash('deload_fundamental'),
    },
    {
      category: 'injury_prevention',
      subcategory: 'warmup',
      insight: 'Begin every session with 5-10 minutes of dynamic warm-up targeting the muscles to be trained, plus progressive warm-up sets for the first compound movement.',
      applicationContext: 'When programming any training session',
      confidenceScore: 0.9,
      relevanceScore: 0.95,
      sourceType: 'research_summary',
      sourceName: 'Fundamental Training Principles',
      isActive: true,
      contentHash: generateContentHash('warmup_fundamental'),
    },
  ];

  for (const insight of fundamentalInsights) {
    const existing = await storage.getKnowledgeByHash(insight.contentHash!);
    if (!existing) {
      await storage.createKnowledge(insight);
    }
  }

  console.log(`[LearningService] Seeded ${fundamentalInsights.length} fundamental insights`);
}
