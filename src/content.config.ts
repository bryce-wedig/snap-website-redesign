import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string().optional(),
    editors: z.string().optional(),
    excerpt: z.string().optional(),
  }),
});

const newsletters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/newsletters' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
  }),
});

const initiatives = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/initiatives' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(['current', 'past', 'upcoming']),
    excerpt: z.string().optional(),
    permalink: z.string().optional(),
  }),
});

const courses = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/courses' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    comingSoon: z.boolean().optional().default(false),
  }),
});

export const collections = { blog, newsletters, initiatives, courses };
