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

// One YAML file per questionnaire, flat in src/content/questionnaires/<slug>.yaml
// (same folder-collection shape as `partners`, so adding a second
// questionnaire later is just a new file - no code change). Reachable only
// at /questionnaire/<slug>, never linked from site nav.
//
// Question `type` covers exactly the shapes this site's questionnaires have
// needed so far - not a generic form-builder:
//  - scale:  1-5 rating with labelled endpoints
//  - single: single-select, with an optional free-text "detail" box that
//            can be always-shown or only revealed for specific answers
//  - multi:  checkbox list (optionally capped via maxSelections), same
//            optional detail box
//  - rankTwo: pick exactly two options; the order clicked is the rank
//  - grid:   a row x column matrix (e.g. Yes/No/Not sure per row), with an
//            optional per-row follow-up text field shown for one column
//  - open:   free text
// `showIfQuestionId`/`showIfValues` makes a question's visibility depend on
// an earlier question's answer (e.g. a follow-up shown only when someone
// answered "No" to something else).
const questionOptionalFields = {
  detailPrompt: z.string().optional(),
  detailShowIfValues: z.array(z.string()).optional(), // omitted = always show once answered
  showIfQuestionId: z.string().optional(),
  showIfValues: z.array(z.string()).optional(),
};

const questionSchema = z.object({
  id: z.string(),
  type: z.enum(['scale', 'single', 'multi', 'rankTwo', 'grid', 'open']),
  prompt: z.string(),
  scaleMin: z.number().optional(),
  scaleMax: z.number().optional(),
  scaleMinLabel: z.string().optional(),
  scaleMaxLabel: z.string().optional(),
  options: z.array(z.string()).optional(), // single / multi / rankTwo
  maxSelections: z.number().optional(),    // multi
  gridColumns: z.array(z.string()).optional(),
  gridRows: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  gridFollowUpColumn: z.string().optional(),
  gridFollowUpPrompt: z.string().optional(),
  ...questionOptionalFields,
});

const questionnaires = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    intro: z.string(),
    formVersion: z.number(),
    submitLabel: z.string().default('See my results'),
    // The opt-in gate, if present, is asked first and controls whether the
    // closing contact step appears at all - answering "no" skips straight
    // to a thank-you with no name/email ever requested.
    gate: z.object({
      id: z.string(),
      prompt: z.string(),
      yesLabel: z.string(),
      noLabel: z.string(),
      note: z.string().optional(),
    }).optional(),
    sections: z.array(z.object({
      heading: z.string().optional(),
      intro: z.string().optional(),
      questions: z.array(questionSchema),
    })),
    closing: z.object({
      leadText: z.string(),
      consentNote: z.string(),
      fields: z.array(z.enum(['name', 'organisation', 'email'])).default(['name', 'organisation', 'email']),
      // Off by default: this questionnaire's own consent copy is a single
      // opt-in (tied to the gate above), not the two-purpose report vs.
      // marketing-contact consent some other questionnaire might want.
      offerMarketingConsent: z.boolean().default(false),
      marketingLabel: z.string().optional(),
    }).optional(),
  }).superRefine((data, ctx) => {
    const allIds = [
      ...(data.gate ? [data.gate.id] : []),
      ...data.sections.flatMap((s) => s.questions.map((q) => q.id)),
    ];
    const seen = new Set<string>();
    for (const id of allIds) {
      if (seen.has(id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate question id "${id}" - question ids must be unique within a questionnaire` });
        return;
      }
      seen.add(id);
    }
  }),
});

export const collections = { insights, hero, approach, contact, partners, partnersSection, settings, legal, questionnaires };
