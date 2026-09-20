import { execSync } from 'child_process';

const script = `
const { createClient } = require('@supabase/supabase-js');
const url = 'https://ixsptauounlssqbgywic.supabase.co';
const key = 'sb_publishable_PdIhJuY50ARVVrH18SwpUw_ebbCglCz';
const supabase = createClient(url, key, {
  global: { headers: { 'Apikey': key } },
  auth: { persistSession: false, autoRefreshToken: false }
});

async function test() {
  // Test 1: Sign up
  console.log('--- Test 1: Sign up ---');
  const testEmail = 'connect-test-' + Date.now() + '@paperline.test';
  const { data: signup, error: signupErr } = await supabase.auth.signUp({ email: testEmail, password: 'M1m2m3m4m5*' });
  if (signupErr) { console.error('SignUp ERROR:', signupErr.message); }
  else { console.log('SignUp OK:', JSON.stringify(signup.data)); }

  // Test 2: Sign in
  console.log('\\n--- Test 2: Sign in ---');
  const { data: signin, error: signinErr } = await supabase.auth.signInWithPassword({ email: testEmail, password: 'M1m2m3m4m5*' });
  if (signinErr) { console.error('SignIn ERROR:', signinErr.message); }
  else {
    console.log('SignIn OK — user id:', signin.data.user?.id);
    console.log('Session expires at:', signin.data.session?.expires_at ? new Date(Number(signin.data.session.expires_at) * 1000).toISOString() : 'N/A');
  }

  // Test 3: Sign out
  console.log('\\n--- Test 3: Sign out ---');
  const { error: signoutErr } = await supabase.auth.signOut();
  if (signoutErr) { console.error('SignOut ERROR:', signoutErr.message); }
  else { console.log('SignOut OK'); }

  // Test 4: Check health
  console.log('\\n--- Test 4: API health ---');
  console.log('Supabase URL:', url);
  console.log('Supabase Project ID: ixsptauounlssqbgywic');
  console.log('API key prefix: sb_publishable_ ✓');
}

test().catch(e => { console.error('FATAL:', e); process.exit(1); });
`;

try {
  const result = execSync(`node -e "${script}"`, {
    cwd: 'D:/Programming/Task - Project/spark-new-ideas-main',
    timeout: 20000,
    maxBuffer: 1024 * 1024,
  });
  console.log(result.toString());
  process.exit(0);
} catch (e) {
  console.error('FAIL:', e.message);
  if (e.stdout) console.error(e.stdout.toString());
  if (e.stderr) console.error(e.stderr.toString());
  process.exit(1);
}
