"use server";

import { kuryanaGetReviews, KuryanaReview } from "@/lib/kuryana";

export async function loadMoreReviews(slug: string, page: number): Promise<KuryanaReview[]> {
    const result = await kuryanaGetReviews(slug, page);
    return result?.data?.reviews ?? [];
}
