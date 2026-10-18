const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const workflow=fs.readFileSync('.github/workflows/pr-metadata.yml','utf8');
const script=workflow.split('          script: |\n')[1].split('\n').map(line=>line.replace(/^            /,'')).join('\n');
const run=new (Object.getPrototypeOf(async function(){}).constructor)('github','context',script);
async function classify(paths,{title='Update',assigned=false,base='develop',head='feature/example'}={}) {
  const calls={assignees:[],labels:[]};
  const github={paginate:async()=>paths.map(filename=>({filename})),rest:{pulls:{listFiles(){}},issues:{
    addAssignees:async args=>calls.assignees.push(args),addLabels:async args=>calls.labels.push(args),
  }}};
  const context={repo:{owner:'mvuljevas',repo:'EnvatoXperience'},payload:{pull_request:{number:42,title,assignees:assigned?[{login:'mvuljevas'}]:[],base:{ref:base},head:{ref:head}}}};
  await run(github,context);return calls;
}
test('PR metadata assigns the owner and classifies documentation, tests and automation',async()=>{
  const result=await classify(['README.md','scripts/example.test.cjs','.github/workflows/check.yml']);
  assert.deepEqual(result.assignees[0].assignees,['mvuljevas']);
  assert.deepEqual(new Set(result.labels[0].labels),new Set(['documentation','tests','ci']));
});
test('release and bug labels are inferred without evaluating untrusted PR text',async()=>{
  const result=await classify(['content.js'],{title:'fix: `process.exit(1)` ${{ secrets.TEST }}',assigned:true,base:'main',head:'develop'});
  assert.equal(result.assignees.length,0);assert.deepEqual(new Set(result.labels[0].labels),new Set(['security','bug','release']));
});
test('store and security work are identifiable and uncategorized work has a fallback',async()=>{
  const result=await classify(['PRIVACY.md','scripts/package_extension.py']);
  assert.deepEqual(new Set(result.labels[0].labels),new Set(['documentation','security','store']));
  assert.deepEqual((await classify(['package-lock.json'])).labels[0].labels,['maintenance']);
  assert.doesNotMatch(workflow,/actions\/checkout|github\.event\.pull_request\.title|\brun:/);
  assert.match(workflow,/actions\/github-script@[a-f0-9]{40}/);
});
