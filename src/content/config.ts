import { defineCollection, z } from 'astro:content';

const insights = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    pillar: z.string(),
    date: z.date(),
  }),
});

export const collections = { insights };
