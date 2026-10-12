const {chromium}=require('C:/Users/Phan Trinh Tien Dat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {spawn}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const root='D:/MORPH-AI',out=path.join(root,'output/playwright/commerce-20261012');fs.mkdirSync(out,{recursive:true});
process.env.TEMP=path.join(root,'.cache/tmp');process.env.TMP=process.env.TEMP;
const env={...process.env,MORPH_REVIEW:'1',NEXT_TELEMETRY_DISABLED:'1',BACKEND_URL:'http://127.0.0.1:8007',MPLCONFIGDIR:path.join(root,'.cache/matplotlib'),PYTHONUNBUFFERED:'1'};
const children=[];function start(exe,args,cwd,name){const log=fs.openSync(path.join(out,name+'.log'),'w');const p=spawn(exe,args,{cwd,env,windowsHide:true,stdio:['ignore',log,log]});children.push(p);p.on('error',e=>console.error(name,e));}
async function ready(url){for(let i=0;i<90;i++){try{if((await fetch(url,{signal:AbortSignal.timeout(1500)})).ok)return;}catch{}await new Promise(r=>setTimeout(r,700));}throw Error('Not ready '+url);}
(async()=>{let browser;const errors=[],consoleErrors=[];try{
start(path.join(root,'backend/.venv/Scripts/python.exe'),['-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8007'],path.join(root,'backend'),'backend');
start(process.execPath,[path.join(root,'frontend/node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3107'],path.join(root,'frontend'),'frontend');
await Promise.all([ready('http://127.0.0.1:8007/api/health'),ready('http://127.0.0.1:3107')]);console.log('SERVERS READY');
browser=await chromium.launchPersistentContext(path.join(root,'.cache/commerce-browser'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,env,viewport:{width:1440,height:1024}});
const fixtures=Object.fromEntries(['front','side'].map(key=>[key,'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'qa/rendered-'+key+'.png')).toString('base64')]));
await browser.addInitScript(({fixtures})=>{
  window.__cameraFixture='blank';window.__testTracks=[];window.__cameraRequests=[];
  Object.defineProperty(navigator.mediaDevices,'enumerateDevices',{value:async()=>[
    {kind:'videoinput',deviceId:'qa-wide',label:'QA camera wide'},
    {kind:'videoinput',deviceId:'qa-second',label:'QA camera second'}]});
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(request)=>{
    window.__cameraRequests.push(request);
    if(window.__cameraDenied)throw new DOMException('Test denied','NotAllowedError');
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),img=new Image();
    const fixture=window.__cameraFixture;
    if(fixture!=='blank'){img.src=fixtures[fixture];await img.decode();canvas.width=img.width;canvas.height=img.height;}else{canvas.width=1920;canvas.height=1080;}
    const draw=()=>{ctx.fillStyle='#aaaaaa';ctx.fillRect(0,0,canvas.width,canvas.height);if(fixture!=='blank')ctx.drawImage(img,0,0);};draw();
    const timer=setInterval(draw,100),stream=canvas.captureStream(10);window.__testTracks.push(...stream.getTracks());
    stream.getTracks().forEach(track=>{const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};let zoom=2;track.getCapabilities=()=>window.__noZoom?{}:{zoom:{min:1,max:3,step:.1}};track.getSettings=()=>({zoom});track.applyConstraints=async c=>{zoom=c.advanced[0].zoom;};});return stream;
  }});
},{fixtures});
const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
await page.goto('http://127.0.0.1:3107',{waitUntil:'networkidle',timeout:90000});

await page.setViewportSize({width:390,height:844});
await page.locator('.shop-header button').last().click();
await page.locator('dialog[open]').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished));});
await page.screenshot({path:path.join(out,'cart-mobile.png'),fullPage:false});
console.log('CART CAPTURED');
}finally{if(browser)await browser.close();for(const p of children)p.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
