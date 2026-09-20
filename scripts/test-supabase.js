import { execSync } from 'child_process';
try {
  const result = execSync('node -e "'
    + 'const { createClient } = require(\'@supabase/supabase-js\');'
    + 'const url = \'https://ixsptauounlssqbgywic.supabase.co\';'
    + 'const key = \'sb_publishable_PdIhJuY50ARVVrH18SwpUw_ebbCglCz\';'
    + 'const supabase = createClient(url, key, { global: { headers: { \'Apikey\': key } } });'
    + 'supabase.auth.getUser().then(r => { console.log(JSON.stringify(r)); process.exit(0); }).catch(e => { console.error(JSON.stringify(e)); process.exit(1); });'
    + '"', { cwd: 'D:/Programming/Task - Project/spark-new-ideas-main', timeout: 15000 });
  console.log(result.toString());
  process.exit(0);
} catch(e) {
  console.error('FAIL:', e.message);
  process.exit(1);
}
