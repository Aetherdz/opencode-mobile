import { chromium } from "playwright";
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
const route = process.env.A11Y_ROUTE || '/';
const p=await ctx.newPage();await p.goto(`http://127.0.0.1:4180${route}`,{waitUntil:'domcontentloaded'});
const issues=await p.evaluate(()=>{
 const out=[];
 for(const e of document.querySelectorAll('a,button,summary,input[type=radio]')){
  const r=e.getBoundingClientRect(); if(!r.width||!r.height)continue;
   if(r.height<44 && !e.classList.contains('cmd-radio') && !e.matches('.footer-links a,.copy-button,.site-nav a,.brand,.lang-menu a,.footer-legal a,.download-meta a,.link-row a'))out.push(`${e.tagName}.${e.className}: ${r.height.toFixed(0)}px`);
  if((e.matches('button')||e.matches('a'))&&!e.textContent.trim()&&!e.getAttribute('aria-label'))out.push(`unnamed ${e.tagName}.${e.className}`);
 }
 const cfg=document.querySelector('.docs-table');if(cfg){const r=cfg.getBoundingClientRect();if(r.right>innerWidth+1)out.push('docs-table exceeds viewport');}
 return out;
});
console.log(issues.length?issues.join('\n'):`no basic interactive target/name issues on ${route}`);
if(issues.length) process.exitCode = 1;
await b.close();
