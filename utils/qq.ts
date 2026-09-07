// lib/qq.ts
export const qq = {
  myEvents: (uid: string) => ["ss:myEvents", uid] as const,
  /** Prefix that matches every user's event list. Mutations that add or remove
   *  an event invalidate through this, since they rarely know which uid the
   *  list was cached under. */
  myEventsAll: () => ["ss:myEvents"] as const,
  event: (slug: string) => ["ss:event", slug] as const,
  members: (eventId: string) => ["ss:members", eventId] as const,
  invites: (eventId: string) => ["ss:invites", eventId] as const,
  participants: (eventId: string) => ["ss:participants", eventId] as const,
  myAssignment: (eventId: string, uid: string) =>
    ["ss:myAssignment", eventId, uid] as const,
  /** Invitations addressed to me and still unanswered. */
  myInvites: (uid: string) => ["ss:myInvites", uid] as const,
  /** E-mail / link invitations issued for an event (organiser view). */
  emailInvites: (eventId: string) => ["ss:emailInvites", eventId] as const,
  /** Draw rules are per event, not per person — they are pairs. */
  drawRules: (eventId: string) => ["ss:drawRules", eventId] as const,
};
