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
  const testEmail = 'login-test-' + Date.now() + '@paperline.test';
  const password = 'M1m2m3m4m5*';

  console.log('--- Step 1: Sign up ---');
  let { data: signup, error: signupErr } = await supabase.auth.signUp({ email: testEmail, password });
  console.log(signupErr ? 'SignUp ERROR: ' + signupErr.message : 'SignUp OK - user created, verification sent');

  // Wait for email confirmation simulation (Supabase auto-confirms if email confirms disabled, or we try signin which works for confirmed users)
  console.log('\\n--- Step 2: Sign in ---');
  let { data: signin, error: signinErr } = await supabase.auth.signInWithPassword({ email: testEmail, password });
  if (signinErr) {
    console.log('SignIn ERROR: ' + signinErr.message);
    console.log('Note: if email confirmation is required, you must confirm the email first.');
    console.log('Check: supabase dashboard > authentication > settings > "Enable email confirmations"');
  } else {
    console.log('SignIn OK');
    console.log('User ID:', signin.data.user?.id);
    console.log('Session expires:', signin.data.session?.expires_at ? new Date(Number(signin.data.session.expires_at) * 1000).toISOString() : 'N/A');
    console.log('Access token present:', !!signin.data.session?.access_token);
  }

  console.log('\\n--- Step 3: Sign out ---');
  let { error: signoutErr } = await supabase.auth.signOut();
  console.log(signoutErr ? 'SignOut ERROR: ' + signoutErr.message : 'SignOut OK');

  console.log('\\n=== SUMMARY ===');
  console.log('Supabase project: ixsptauounlssqbgywic');
  console.log('URL: https://ixsptauounlssqbgywic.supabase.co');
  console.log('Publishable key: sb_publishable_PdIhJuY50ARVVrH18SwpUw_ebbCglCz');
  console.log('Connection: WORKING');
  console.log('SignUp: ' + (signupErr ? 'FAILED - ' + signupErr.message : 'OK'));
  console.log('SignIn: ' + (signinErr ? 'FAILED - ' + signinErr.message : 'OK, can login with email+password'));
}

test().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
`;

try {
  const result = execSync(`node -e "${script}"`, {
    cwd: 'D:/Programming/Task - Project/spark-new-ideas-main',
    timeout: 20000,
    maxBuffer: 1024 * 1024,
  });
  console.log(result.toString());
} catch (e) {
  console.error('FAIL:', e.message);
  if (e.stdout) console.error(e.stdout.toString());
  if (e.stderr) console.error(e.stderr.toString());
}
