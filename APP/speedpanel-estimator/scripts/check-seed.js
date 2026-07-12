import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const PROJECT_A_ID = process.env.PROJECT_A_INSTALL_REVIEW;

if (!SUPABASE_URL || !SUPABASE_KEY || !PROJECT_A_ID) {
  console.error('Missing SUPABASE_URL, SUPABASE_KEY or PROJECT_A_INSTALL_REVIEW env');
  process.exit(2);
}

(async () => {
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/projects?id=eq.${PROJECT_A_ID}&select=id,name`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    console.error('Seed check HTTP error:', res.status, await res.text());
    process.exit(3);
  }

  const body = await res.json();
  if (!Array.isArray(body) || body.length === 0) {
    console.error(`Seeded project ${PROJECT_A_ID} not found. Ensure seed.sql ran and contains the expected project id/name.`);
    process.exit(4);
  }

  console.log('Seed check OK:', body[0]);
  process.exit(0);
})();
