/** Shared client/server-action contracts for connector UI. */

export type ActionResult = { ok: boolean; error?: string };

export type DisconnectAction = (projectId: string) => Promise<ActionResult>;

export type SelectPropertyAction = (
  projectId: string,
  value: string
) => Promise<ActionResult>;
