"use server";

// Re-export so client components and server actions can call getMdlData as a server action.
// The underlying function is cache()-wrapped in lib/mdl-data, so server components that
// import directly from there share a single DB call per request.
export { getMdlData, type MdlData, type MdlCast, type MdlCastMember } from "@/lib/mdl-data";
