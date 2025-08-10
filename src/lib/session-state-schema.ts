import { z } from "zod"

export const sessionStateSchema = z.object({
  id: z.string(),
  projectId: z.number(),
  openFileIds: z.array(z.number()),
  openFilePaths: z.array(z.string()),
  activeFilePath: z.string().optional(),
  tabOrder: z.array(z.number()),
  lastUpdated: z.date(),
})

export type SessionState = z.infer<typeof sessionStateSchema>
