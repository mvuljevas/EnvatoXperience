const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function productFixture(source=null) {
  const calls=[];
  const window={location:{href:'https://themeforest.net/item/product/123'}};
  const context={window,URL,Date,chrome:{runtime:{sendMessage:async request=>{calls.push(request);return request.action === 'get_widget_product' ? source : null;}}}};
  vm.runInNewContext(fs.readFileSync('envato-shared.js','utf8'),context);
  vm.runInNewContext(fs.readFileSync('widget-product.js','utf8'),context);
  return {api:window.EnvatoWidgetProduct,calls};
}
test('rich source metadata is used without a network fetch and never crosses product IDs',async()=>{
  const {api,calls}=productFixture({itemId:'123',title:'Real title',imageUrl:'https://images.example.org/cover.jpg',avatarUrl:'https://images.example.org/author.jpg'});
  const result=await api.resolve({itemId:'123',title:'Preview',itemUrl:'https://themeforest.net/item/product/123'});
  assert.equal(result.title,'Real title');assert.ok(result.imageUrl);assert.ok(result.avatarUrl);
  assert.deepEqual(calls.map(c=>c.action),['get_widget_product']);
  const mismatch=await api.resolve({itemId:'456',title:'Other',itemUrl:'https://themeforest.net/item/other/456'});
  assert.equal(mismatch.imageUrl,undefined);
});
test('source capture is delegated to trusted background session storage',async()=>{
  const {api,calls}=productFixture();
  await api.remember({itemId:'123',title:'Product'});
  assert.equal(calls[0].action,'remember_widget_product');assert.equal(calls[0].product.itemId,'123');
});
test('metadata extraction normalizes titles and rejects unsafe image URLs',()=>{
  const {api}=productFixture();
  const doc={querySelector:selector=>selector==='h1'?{textContent:'Reviews for Product'}:selector.includes('.js-item-preview')?{getAttribute:()=> 'javascript:alert(1)'}:null,querySelectorAll:()=>[]};
  const info=api.read(doc,'https://themeforest.net/item/product/123');
  assert.equal(info.title,'Product'); assert.equal(info.itemId,'123'); assert.equal(info.imageUrl,'');
});
function backgroundFixture() {
  const data={};const listeners={};let handler;let fetches=0;
  const storage={get:async keys=>Object.fromEntries(Object.entries(data).filter(([key])=>keys===null || (Array.isArray(keys)?keys.includes(key):key===keys))),set:async patch=>Object.assign(data,patch),remove:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}};
  const chrome={action:{onClicked:{addListener(){}}},runtime:{onInstalled:{addListener(){}},onMessage:{addListener(fn){handler=fn;}}},tabs:{get:async id=>({id,openerTabId:id===2?1:undefined}),onRemoved:{addListener:fn=>listeners.removed=fn},onUpdated:{addListener:fn=>listeners.updated=fn}},storage:{session:storage,local:{remove:async()=>{}},onChanged:{addListener:fn=>listeners.changed=fn}}};
  const context=vm.createContext({chrome,URL,console,Date,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{
    fetches++;assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    return {ok:true,headers:{get:()=> 'text/html'},text:async()=>'<h1>Product</h1>'};
  }});
  context.importScripts=file=>vm.runInContext(fs.readFileSync(file,'utf8'),context);
  vm.runInContext(fs.readFileSync('background.js','utf8'),context);
  const request=(payload,url,id=1)=>new Promise(resolve=>handler(payload,{url,tab:{id},frameId:0},resolve));
  return {data,listeners,request,fetches:()=>fetches};
}
const item='https://themeforest.net/item/product/123';
const preview='https://preview.themeforest.net/item/product/full_screen_preview/123';
test('metadata and demo contexts follow the opener tab and are removed on abandonment or closure',async()=>{
  const {request,data,listeners}=backgroundFixture();
  await request({action:'remember_widget_product',product:{itemId:'123',title:'Product',imageUrl:'https://images.example.org/cover.jpg'}},item);
  const product=await request({action:'get_widget_product',itemId:'123'},preview,2);
  assert.equal(product.imageUrl,'https://images.example.org/cover.jpg');
  await request({action:'set_widget_context',info:product,targetUrl:'https://demo.example.org/'},preview,2);
  listeners.updated(1,{url:'https://elsewhere.example.org/'});await new Promise(setImmediate);
  assert.equal(data['envatoWidgetSource:1'],undefined);
  assert.ok((await request({action:'get_widget_context'},'https://demo.example.org/',2)).imageUrl);
  listeners.removed(2);await new Promise(setImmediate);
  assert.equal(data['envatoWidgetContext:2'],undefined);
});
test('different tabs, products and hosts cannot reuse unrelated widget context',async()=>{
  const {request,data,listeners}=backgroundFixture();
  await request({action:'remember_widget_product',product:{itemId:'123',title:'Product'}},item);
  assert.equal(await request({action:'get_widget_product',itemId:'456'},preview,2),null);
  assert.equal(await request({action:'get_widget_product',itemId:'123'},preview,3),null);
  const product=await request({action:'get_widget_product',itemId:'123'},preview,2);
  await request({action:'set_widget_context',info:product,targetUrl:'https://demo.example.org/'},preview,2);
  listeners.updated(2,{url:'https://elsewhere.example.org/'});await new Promise(setImmediate);
  assert.equal(data['envatoWidgetContext:2'],undefined);
});
test('public fallback only fetches the current preview canonical product and disabling clears temporary contexts',async()=>{
  const {request,fetches,data,listeners}=backgroundFixture();
  for(const [url,sender] of [['https://attacker.test/item/product/123',preview],[item,'https://demo.example.org/'],['https://codecanyon.net/item/product/123',preview]]) {
    assert.equal(await request({action:'get_widget_item_page',url},sender),null);
  }
  assert.equal(fetches(),0);
  assert.ok((await request({action:'get_widget_item_page',url:item},preview)).html);
  assert.equal(fetches(),1);
  data['envatoWidgetSource:1']={};data['envatoWidgetContext:2']={};data.unrelated='keep';
  listeners.changed({widgetMode:{newValue:false}},'sync');await new Promise(setImmediate);
  assert.deepEqual(Object.keys(data),['unrelated']);
});
