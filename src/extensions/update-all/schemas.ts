import { HookBase } from '@rossum/api-client/types/src/hooks/models/hook';
import { z } from 'zod';

export const outdatedExtensionSchema = z.object({
  extensionName: z.string(),
  latestVersion: z.string(),
  currentVersion: z.string(),
  extensionKey: z.string(),
  id: z.number(),
  integration_id: z.number(),
});
export type OutdatedExtension = z.TypeOf<typeof outdatedExtensionSchema>;

export const formSchema = z.object({
  outdatedExtensions: z.array(outdatedExtensionSchema),
});

export type Form = z.TypeOf<typeof formSchema>;

const metadataSchema = z.object({
  upstream: z.object({
    version: z.string(),
    extension_id: z.string(),
    integration_id: z.coerce.number(),
  }),
});

type Metadata = z.TypeOf<typeof metadataSchema>;

export type HookWithParsedMetadata = Omit<HookBase, 'metadata'> & {
  metadata: Metadata;
};

export const isHookWithMetadata = (
  hook: HookBase
): hook is HookWithParsedMetadata => {
  const parsed = metadataSchema.safeParse(hook.metadata);

  return parsed.success;
};
