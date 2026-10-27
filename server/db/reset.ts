import { db } from './connection.js';
import { seedDatabase } from './seed.js';

console.log('Resetting QueueCare database...');
seedDatabase(db);
console.log('Reset complete!');
process.exit(0);
