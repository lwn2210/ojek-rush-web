// PLAYWRIGHT_MODULE_PATH=/path/to/playwright node tests/score-browser.cjs report.json
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),port=4187;
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
 let browser;const report={attempted:0,passed:0,failed:0,blocked:0,scenarios:[]};
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Vite readiness timeout')),10000);server.stdout.on('data',s=>{if(s.toString().includes('127.0.0.1')){clearTimeout(timer);resolve()}});server.on('exit',code=>{clearTimeout(timer);reject(new Error('Vite exited '+code))})});
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  for(const mode of ['desktop','mobile','boost-summary']){
   const result={mode,pageErrors:[],consoleErrors:[]};report.attempted++;
   const page=await browser.newPage(mode==='mobile'?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1024,height:900}});
   page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text())});
   try{
    // Ignore optional browser favicon lookup, not an application asset.
    await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
    if(process.env.SCORE_BASELINE==='1')await page.route('**/src/logic.ts',async route=>{
     const response=await route.fetch();const body=await response.text();
     assert.ok(body.includes('Math.floor(g.distance) + Math.floor(g.bonus)'));
     await route.fulfill({response,body:body.replace('Math.floor(g.distance) + Math.floor(g.bonus)','Math.floor(g.distance) + g.bonus')});
    });
    if(mode==='boost-summary'){
     await page.route('**/src/main.ts',async route=>{
      const response=await route.fetch();const body=await response.text();
      // Test-only access to real closure and real finish/share functions.
      await route.fulfill({response,body:body+'\nwindow.scoreTest={finishWith:g=>{game=g;finish()}};'});
     });
     await page.addInitScript(()=>Object.defineProperty(navigator,'share',{value:async data=>{window.sharedScore=data}}));
    }
    await page.goto(`http://127.0.0.1:${port}/`);await page.locator('#start').waitFor();
    if(mode==='boost-summary'){
     result.calculation=await page.evaluate(async()=>{
      const logic=await import('/src/logic.ts');const {createRng}=await import('/src/rng.ts');
      const g=logic.newGame(createRng(7));g.boost=4;g.nextSpawn=1e9;
      for(let i=0;i<17;i++)logic.step(g,1/60);
      const rawBonus=g.bonus,hud=Math.floor(g.distance)+Math.floor(g.bonus);
      window.scoreTest.finishWith(g);return {hud,rawBonus,score:logic.score(g)};
     });
     const {hud,score}=result.calculation;assert.equal(score,hud);assert.equal(Number.isInteger(score),true);
     assert.equal(await page.locator('#over-score').textContent(),String(hud));
     assert.equal(await page.locator('#over-best').textContent(),String(hud));
     await page.locator('#share-score').click();
     result.shared=await page.evaluate(()=>window.sharedScore);
     assert.ok(result.shared.text.includes(`Total Skor: ${hud} poin`));
     await page.reload();assert.equal(await page.locator('#best').textContent(),`Rekor: ${hud}`);
    }else{
     await page.locator('#start').click();assert.equal(await page.locator('#menu').isVisible(),false);
     if(mode==='mobile')await page.locator('#scene').tap({position:{x:300,y:500}});else await page.keyboard.press('ArrowRight');
     await page.locator('#mute').click();assert.ok((await page.locator('#mute').textContent()).includes('🔇'));
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.consoleErrors,[]);result.state='passed';report.passed++;
   }catch(e){result.state='failed';result.failure=String(e);report.failed++;process.exitCode=1}
   await page.close();report.scenarios.push(result);
  }
 }finally{if(browser)await browser.close();server.kill();fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
