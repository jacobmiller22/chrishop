import { seedDatabase } from './scripts/seed';

export { seedDatabase };

if (process.argv[1]?.includes('seed')) {
  seedDatabase().catch((err) => {
    console.error('❌ Directus database seed failed:', err);
    process.exit(1);
  });
}
