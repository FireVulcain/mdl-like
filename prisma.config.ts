import { defineConfig } from "@prisma/config";
import "dotenv/config";

export default defineConfig({
    datasource: {
        url: process.env.DIRECT_URL, // Use DIRECT_URL for migrations
    },
});
