import { defineCollection, z } from 'astro:content';

// One Markdown file per article in src/content/insights/.
// `order` controls position (1 = newest / featured).
const insights = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    topic: z.string(),
    excerpt: z.string(),
    author: z.string(),
    role: z.string(),
    authorImg: z.string(),          // path in /public, e.g. "/shaan-mahrotri.jpg"
    read: z.string(),               // "9 min read"
    date: z.string(),               // "June 2026"
    dateShort: z.string(),          // "Jun 26"
    order: z.number(),
    featured: z.boolean().default(false),
    leadCaption: z.string(),        // intended photograph for the lead plate
    leadImage: z.string().optional(),// optional real image path in /public
  }),
});

export const collections = { insights };
