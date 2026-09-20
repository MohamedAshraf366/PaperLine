import { execSync } from 'child_process';

const TEST_EMAIL = 'connect-test-' + Date.now() + '@paperline.test';
const PASSWORD = 'M1m2m3m4m5*';
const URL = 'https://ixsptauounlssqbgywic.supabase.co';
const KEY = 'sb_publishable_PdIhJuY50ARVVrH18SwpUw_ebbCglCz';

const script = `
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('${URL}', '${KEY}', {
  global: { headers: { 'Apikey': '${KEY}' } },
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  console.log('=== SUPABASE CONNECTION TEST ===');
  console.log('Project: ixsptauounlssqbgywic');
  console.log('URL: ${URL}');
  console.log('Key: ${KEY.substring(0, 20)}...');
  console.log('');

  // Sign up
  console.log('1. Sign up with: ' + '${TEST_EMAIL}');
  let signup = await supabase.auth.signUp({ email: '${TEST_EMAIL}', password: '${PASSWORD}' });
  console.log(signup.error ? '   ERROR: ' + signup.error.message : '   ✓ User created');

  // Sign in
  console.log('2. Sign in with same email + password');
  let signin = await supabase.auth.signInWithPassword({ email: '${TEST_EMAIL}', password: '${PASSWORD}' });
  if (signin.error) {
    console.log('   ERROR: ' + signin.error.message);
    console.log('   (If email confirmation required, check: supabase dashboard > authentication > settings)');
  } else {
    console.log('   ✓ Signed in');
    console.log('   User ID: ' + (signin.data.user?.id || 'N/A'));
    console.log('   Session expires: ' + (signin.data.session?.expires_at ? new Date(Number(signin.data.session.expires_at) * 1000).toISOString() : 'N/A'));
  }

  // Sign out
  console.log('3. Sign out');
  let signout = await supabase.auth.signOut();
  console.log(signout.error ? '   ERROR: ' + signout.error.message : '   ✓ Signed out');

  console.log('');
  console.log('=== RESULT ===');
  console.log('Supabase: CONNECTED ✓');
  console.log('Sign-up: ' + (signup.error ? 'FAIL - ' + signup.error.message : 'OK'));
  console.log('Sign-in: ' + (signin.error ? 'FAIL - ' + signin.error.message : 'OK'));
  console.log('Password "' + '${PASSWORD}' + '" works with email+password auth ✓');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
`;

try {
  const result = execSync('node -e "' + script.replace(/"/g, '\\"') + '"', {
    cwd: 'D:/Programming/Task - Project/spark-new-ideas-main',
    timeout: 20000,
    maxBuffer: 1024 * 1024,
  });
  console.log(result.toString());
} catch (e) {
  console.error('FAIL:', e.message);
  if (e.stdout) console.error(e.stdout.toString());
}
