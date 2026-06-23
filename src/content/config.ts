import { defineCollection, z } from 'astro:content';

// One Markdown file per article in src/content/insights/.
// `order` controls position (1 = newest / featured).
const insights = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    published: z.boolean().default(true), // uncheck in the admin to pull it from the live site without deleting it
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

// Single-entry "data" collections backing the homepage sections.
// Editable via the local Decap CMS admin (npm run cms -> /admin) as well
// as by hand — each is one YAML file at src/content/<name>/index.yaml.
const hero = defineCollection({
  type: 'data',
  schema: z.object({
    kicker: z.string(),
    headline: z.string(),
    bodyParagraphs: z.array(z.string()),
    maxim: z.string(),
    photo: z.string(),
  }),
});

const approach = defineCollection({
  type: 'data',
  schema: z.object({
    tagline: z.string(),
    paragraphs: z.array(z.string()),
    photo: z.string(),
    verdict: z.string(),
  }),
});

const contact = defineCollection({
  type: 'data',
  schema: z.object({
    lead: z.string(),
  }),
});

// Site-wide switches, editable from the admin. src/content/settings/index.yaml.
const settings = defineCollection({
  type: 'data',
  schema: z.object({
    insightsEnabled: z.boolean().default(true), // uncheck to take the whole Insights section offline (nav, homepage block, and all article pages) while it's still being worked on
  }),
});

// One YAML file per partner, flat in src/content/partners/<slug>.yaml.
const partners = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    role: z.string(),
    photo: z.string(),
    email: z.string(),
    bio: z.array(z.string()),
  }),
});

// Section-level copy for the Partners section (distinct from the per-partner
// bios above) - the intro line before the bios and the closing statement after.
const partnersSection = defineCollection({
  type: 'data',
  schema: z.object({
    intro: z.string(),
    closing: z.string(),
  }),
});

// One YAML file per legal page, flat in src/content/legal/<slug>.yaml.
// Paragraphs may contain inline HTML (links, <br>) - rendered with
// set:html in the page templates, so it's authored as raw HTML, not
// escaped text or markdown.
const legal = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    lastUpdated: z.string(),
    sections: z.array(z.object({
      heading: z.string(),
      paragraphs: z.array(z.string()),
    })),
  }),
});

export const collections = { insights, hero, approach, contact, partners, partnersSection, settings, legal };
