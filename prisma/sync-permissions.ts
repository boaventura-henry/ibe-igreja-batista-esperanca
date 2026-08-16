import { prisma } from "../src/prisma/client";
import { syncAdministratorPermissions, syncPermissions } from "./seed-permissions";

async function main() {
  await syncPermissions();
  const administratorUpdated = await syncAdministratorPermissions();

  console.log(`Permissions synchronized. Administrator updated: ${administratorUpdated ? "yes" : "no"}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Failed to synchronize permissions.");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
