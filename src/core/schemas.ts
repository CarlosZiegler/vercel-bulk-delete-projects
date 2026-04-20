import { z } from "zod";

export const UserResponse = z.object({
  user: z.object({
    id: z.string(),
    username: z.string(),
    email: z.string().optional(),
    name: z.string().optional(),
  }),
});
export type UserResponse = z.infer<typeof UserResponse>;

export const ProjectLink = z
  .object({
    type: z.string(),
    repo: z.string().optional().default(""),
  })
  .passthrough();
export type ProjectLink = z.infer<typeof ProjectLink>;

export const LatestDeployment = z
  .object({
    uid: z.string().optional(),
    createdAt: z.number().optional(),
  })
  .passthrough();

export const Project = z
  .object({
    id: z.string(),
    name: z.string(),
    framework: z.string().nullable().optional().default(null),
    link: ProjectLink.nullable()
      .optional()
      .transform((v) => v ?? null),
    latestDeployments: z.array(LatestDeployment).optional(),
    updatedAt: z.number().optional().default(0),
  })
  .passthrough();
export type Project = z.infer<typeof Project>;

export const ProjectListResponse = z
  .object({
    projects: z.array(Project),
    pagination: z
      .object({
        count: z.number().optional(),
        next: z.union([z.number(), z.string(), z.null()]).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type ProjectListResponse = z.infer<typeof ProjectListResponse>;
