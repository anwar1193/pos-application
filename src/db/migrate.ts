import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { getDb } from "@/lib/db/client";

async function main() {
  const db = getDb();
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "src/db/migrations"),
  });
  console.log("Database migrations applied.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
