import { chromium } from "playwright";
import fs from "node:fs";
const out = process.env.VISUAL_OUT || "/tmp/opencode/final-shots";
fs.mkdirSync(out, { recursive: true });
const allPaths = ["/", "/features/", "/guide/", "/security/", "/faq/", "/docs/", "/ar/", "/ar/features/", "/ar/guide/", "/ar/security/", "/ar/faq/", "/ar/docs/", "/fr/", "/fr/features/", "/fr/guide/", "/fr/security/", "/fr/faq/", "/fr/docs/", "/es/", "/es/features/", "/es/guide/", "/es/security/", "/es/faq/", "/es/docs/"];
const allWidths = [320, 360, 375, 390, 412, 430, 600, 768, 900, 981, 1024, 1060, 1100, 1280, 1440, 1920];
const paths = process.env.VISUAL_PATHS ? process.env.VISUAL_PATHS.split(",") : allPaths;
const widths = process.env.VISUAL_WIDTHS ? process.env.VISUAL_WIDTHS.split(",").map(Number) : allWidths;
const b=await chromium.launch(); let failures=[];
for(const url of paths){
 for(const w of widths){
  for(const scheme of ["light","dark"]){
    const ctx=await b.newContext({viewport:{width:w,height:900},colorScheme:scheme,reducedMotion:"reduce"});
    const p=await ctx.newPage();
      const reqFailures=[]; p.on("requestfailed",r=>{const u=r.url();if(!u.includes("api.github.com") && !u.startsWith("https://aetherdz.github.io/opencode-mobile/"))reqFailures.push(u)});
    const pageErrors=[]; p.on("pageerror", e=>pageErrors.push(e.message));
    try {
       await p.goto(`http://127.0.0.1:4180${url}`,{waitUntil:"domcontentloaded",timeout:8000});
    } catch (error) {
        failures.push(`${url}@${w}/${scheme}: navigation failed (${error.message.split("\n")[0]})`);
        await ctx.close().catch(()=>{});
       continue;
    }
    let result;
    try { result=await p.evaluate(()=>{
    const vw=document.documentElement.clientWidth;
    const offenders=[...document.querySelectorAll("body *")].filter(e=>{if(e.matches('svg,svg *')) return false;const r=e.getBoundingClientRect();const code=e.closest('pre');const hiddenMenu=e.closest('.lang-menu') && !e.closest('.lang-switch')?.open;return r.width>0 && !code && !hiddenMenu && (r.left < -1 || r.right > vw+1)}).slice(0,6).map(e=>`${e.tagName}.${typeof e.className==="string"?e.className:"svg"}`);
    const hasSwitcher=!!document.querySelector(".cmd-switcher");
    const visiblePanels=[...document.querySelectorAll(".cmd-panel")].filter(e=>getComputedStyle(e).display!=="none").length;
    return {sw:document.documentElement.scrollWidth,vw,offenders, visiblePanels, hasSwitcher};
    }); } catch (error) { failures.push(`${url}@${w}/${scheme}: page closed during layout check (${error.message.split("\n")[0]})`); await ctx.close().catch(()=>{}); continue; }
    if(result.sw>result.vw+1 || result.offenders.length) failures.push(`${url}@${w}/${scheme}: ${JSON.stringify(result)}`);
      if(url==="/" && [390,1440].includes(w) && scheme==="light"){
     await p.screenshot({path:`${out}/home-${w}.png`,fullPage:true});
   }
   if(url==="/ar/" && [390,1440].includes(w) && scheme==="dark") await p.screenshot({path:`${out}/ar-dark-${w}.png`,fullPage:true});
    if(result.hasSwitcher && result.visiblePanels!==1) failures.push(`${url}@${w}/${scheme}: expected 1 visible platform panel, got ${result.visiblePanels}`);
    if(reqFailures.length) failures.push(`${url}@${w}/${scheme}: failed requests ${reqFailures.join(",")}`);
    if(pageErrors.length) failures.push(`${url}@${w}/${scheme}: page errors ${pageErrors.join(" | ")}`);
    await ctx.close().catch(()=>{});
  }
 }
}
await b.close();
console.log(`checked ${paths.length} routes x ${widths.length} widths x 2 themes`);
console.log(failures.length?failures.join("\n"):"matrix clean");
if (failures.length) process.exitCode = 1;
