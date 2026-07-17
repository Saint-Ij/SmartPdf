import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "dotenv/config";
import * as coreSchema from "./schema.js";
import * as Relations from "./relations.js";
const schema = { ...coreSchema, ...Relations };
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Create a .env file with DATABASE_URL=postgresql://user:password@host:port/database");
}
const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
});
export const db = drizzle({ client, schema });
//# sourceMappingURL=index.js.map