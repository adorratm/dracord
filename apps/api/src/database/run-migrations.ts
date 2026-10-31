import dataSource from './data-source';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL gerekli');
    process.exit(1);
  }
  await dataSource.initialize();
  const executed = await dataSource.runMigrations({ transaction: 'each' });
  console.log(
    executed.length
      ? `Migrations: ${executed.map((m) => m.name).join(', ')}`
      : 'Migrations: up to date',
  );
  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
