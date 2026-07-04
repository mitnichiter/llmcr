import { sql } from '@vercel/postgres';
import 'dotenv/config'; // loads .env.local

async function initDb() {
  if (!process.env.POSTGRES_URL) {
    console.error('ERROR: POSTGRES_URL is not set.');
    console.error('Please accept the Neon terms in your browser (https://vercel.com/integrations/neon) to provision the database, or provide a valid POSTGRES_URL in .env.local.');
    return;
  }

  try {
    console.log('Initializing Vercel Postgres Database Schema...');

    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Created sessions table.');

    await sql`
      CREATE TABLE IF NOT EXISTS personas (
        id UUID PRIMARY KEY,
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        name VARCHAR(255),
        avatar_url TEXT,
        provider VARCHAR(50),
        model_name VARCHAR(255),
        system_prompt TEXT,
        memory_md TEXT DEFAULT ''
      );
    `;
    console.log('✅ Created personas table.');

    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY,
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        sender_id VARCHAR(255),
        sender_name VARCHAR(255),
        content TEXT,
        is_summary INT DEFAULT 0,
        token_count INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Created messages table.');

    console.log('Database initialization complete.');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initDb();
