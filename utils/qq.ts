// lib/qq.ts
export const qq = {
  myEvents: (uid: string) => ["ss:myEvents", uid] as const,
  event: (slug: string) => ["ss:event", slug] as const,
  members: (eventId: string) => ["ss:members", eventId] as const,
  myAssignment: (eventId: string, uid: string) =>
    ["ss:myAssignment", eventId, uid] as const,
};
