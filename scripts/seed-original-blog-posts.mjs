import fs from 'node:fs';

const workspaceHtml = fs.readFileSync('workspace.html', 'utf8');
const configJs = fs.readFileSync('config.js', 'utf8');

const seedBlock = workspaceHtml.match(/const SEED_POSTS=([\s\S]*?);\s*function getSeedPosts/);
if (!seedBlock) throw new Error('Could not locate SEED_POSTS in workspace.html');

const seeds = Function(`return (${seedBlock[1]});`)();
const supabaseUrl =
  process.env.SUPABASE_URL ||
  configJs.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/)?.[1];
const supabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  configJs.match(/DEFAULT_SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)?.[1];

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL and SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY');
}

const rows = seeds.map((post) => ({
  id: post.id,
  title: post.title,
  subtitle: post.subtitle || '',
  category: post.category || 'Education & Career',
  status: post.status || 'published',
  read_time: post.readTime || '5 min read',
  date: post.date,
  excerpt: post.excerpt || '',
  image: post.image || '',
  emoji: post.emoji || '',
  content: post.content || '',
}));

const upsert = await fetch(`${supabaseUrl}/rest/v1/posts?on_conflict=id`, {
  method: 'POST',
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation',
  },
  body: JSON.stringify(rows),
});

const upsertText = await upsert.text();
if (!upsert.ok) {
  throw new Error(`Supabase upsert failed ${upsert.status}: ${upsertText}`);
}

const verify = await fetch(
  `${supabaseUrl}/rest/v1/posts?select=id,title,date,content&id=in.(${rows.map((row) => row.id).join(',')})&order=date.asc`,
  { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
);
const verifyText = await verify.text();
if (!verify.ok) {
  throw new Error(`Supabase verify failed ${verify.status}: ${verifyText}`);
}

const restored = JSON.parse(verifyText).map((post) => ({
  id: post.id,
  title: post.title,
  date: post.date,
  contentLength: String(post.content || '').length,
}));

console.log(JSON.stringify({ upserted: rows.map((row) => row.id), restored }, null, 2));
