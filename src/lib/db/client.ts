import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

export type Database = LibSQLDatabase<typeof schema>;

let client: Client | undefined;
let database: Database | undefined;

export function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
    const authToken = process.env.TURSO_AUTH_TOKEN;
    client = createClient(authToken ? { url, authToken } : { url });
  }
  return client;
}

export function getDb(): Database {
  if (!database) {
    database = drizzle(getClient(), { schema });
  }
  return database;
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await getClient().execute("select 1");
    return true;
  } catch {
    return false;
  }
}
