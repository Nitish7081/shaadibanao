import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { MigrationService } from '../src/services/migration.service';

async function main() {
  console.log('Connecting to database for approval migration...');
  await connectDatabase();

  const result = await MigrationService.runApprovalsMigration();
  console.log('Migration Result:', JSON.stringify(result, null, 2));

  await disconnectDatabase();
  console.log('Database disconnected. Migration complete.');
}

main().catch((err) => {
  console.error('Fatal error in migration script:', err);
  process.exit(1);
});
