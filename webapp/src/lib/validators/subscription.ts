import { z } from "zod";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const updateSubscriptionSchema = z.object({
  trial_ends_on: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ),
  cancel_url: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.url().optional(),
  ),
});

export const subscriptionIdSchema = z.string().regex(UUID, "ID inválido");
