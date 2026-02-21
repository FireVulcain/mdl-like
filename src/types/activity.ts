export const ActivityAction = {
    ADDED: "ADDED",
    REMOVED: "REMOVED",
    PROGRESS: "PROGRESS",
    STATUS_CHANGED: "STATUS_CHANGED",
    SCORED: "SCORED",
    NOTED: "NOTED",
} as const;

export type ActivityActionType = (typeof ActivityAction)[keyof typeof ActivityAction];
