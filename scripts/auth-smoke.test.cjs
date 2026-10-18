const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {assertLoginOrigin, runPrivateSmoke} = require('./auth-smoke.cjs');
test('credentials may only be filled on reviewed HTTPS origins', () => {
  for (const url of ['https://themeforest.net/sign_in','https://account.envato.com/sign_in']) assert.doesNotThrow(() => assertLoginOrigin(url));
  for (const url of ['http://themeforest.net','https://themeforest.net.attacker.test','https://attacker.test/account.envato.com','https://user:pass@themeforest.net']) assert.throws(() => assertLoginOrigin(url));
});
test('private runner suppresses sensitive errors, keeps secrets out of argv and cleans profiles', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'envato-auth-test-'));
  const logs = [];
  const env = {AUTH_SMOKE_ROOT:base, ENVATO_TEST_USERNAME:'synthetic-user', ENVATO_TEST_PASSWORD:'synthetic-password', DEBUG:'pw:*', GITHUB_TOKEN:'synthetic-token'};
  try {
    const result = runPrivateSmoke({env, log: s => logs.push(s), spawn: (exe,args,options) => {
      assert.equal(options.stdio,'ignore');
      assert.equal(args.includes(env.ENVATO_TEST_PASSWORD),false);
      assert.equal(options.env.DEBUG,undefined); assert.equal(options.env.GITHUB_TOKEN,undefined);
      assert.equal(options.env.ENVATO_TEST_PASSWORD,env.ENVATO_TEST_PASSWORD);
      fs.writeFileSync(path.join(base, fs.readdirSync(base)[0], 'fake-session'), 'synthetic-cookie');
      throw new Error(env.ENVATO_TEST_PASSWORD);
    }});
    assert.equal(result,1); assert.deepEqual(fs.readdirSync(base),[]);
    assert.equal(logs.join('').includes(env.ENVATO_TEST_PASSWORD),false);
  } finally { fs.rmSync(base,{recursive:true,force:true}); }
});
test('missing secrets and untrusted CI refs fail before launching a browser', () => {
  let launches = 0;
  const spawn = () => { launches++; return {status:0}; };
  assert.equal(runPrivateSmoke({env:{},spawn,log:()=>{}}),1);
  assert.equal(runPrivateSmoke({env:{CI:'true',GITHUB_REF:'refs/heads/develop',ENVATO_TEST_USERNAME:'fake',ENVATO_TEST_PASSWORD:'fake'},spawn,log:()=>{}}),1);
  assert.equal(launches,0);
});
test('private runner preserves exit status for success, failure and timeout without diagnostic output', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'envato-auth-status-'));
  try {
    for (const status of [0,1,null]) {
      const logs=[];
      const result = runPrivateSmoke({env:{AUTH_SMOKE_ROOT:base,ENVATO_TEST_USERNAME:'fake',ENVATO_TEST_PASSWORD:'fake'},log:s=>logs.push(s),spawn:()=>({status,error:new Error('private-diagnostic')})});
      assert.equal(result,status === 0 ? 0 : 1);
      assert.equal(logs.join('').includes('private-diagnostic'),false);
      assert.deepEqual(fs.readdirSync(base),[]);
    }
  } finally {fs.rmSync(base,{recursive:true,force:true});}
});
test('public workflow cannot automatically invoke authenticated checks or retain account artifacts', () => {
  const workflow = fs.readFileSync('.github/workflows/authenticated-smoke.yml','utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/pull_request|push:|schedule:|upload-artifact|cache:|self-hosted/);
  assert.match(workflow,/refs\/heads\/main/);
  assert.match(workflow,/environment: envato-auth-smoke/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/npm ci --ignore-scripts/);
  assert.match(workflow,/if: always\(\)/);
  const actions = [...workflow.matchAll(/uses: [^@\s]+@([^\s]+)/g)];
  assert.equal(actions.length,2);
  for (const action of actions) assert.match(action[1],/^[a-f0-9]{40}$/);
  const publicSuite=fs.readFileSync('scripts/extension-smoke.spec.cjs','utf8');
  assert.doesNotMatch(publicSuite,/ENVATO_TEST_PASSWORD|loadLocalEnv|downloads-hide-ads/);
});
