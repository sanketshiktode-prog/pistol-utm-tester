/* ═══════════ saved projects, on the server ═══════════
   They were the browser's own storage: a project saved on the office
   desktop did not exist on the laptop, nobody could open somebody
   else's work, and an admin could see none of it. They go to a Drive
   folder through the Apps Script now, under the account that saved
   them. A user sees their own; the admin sees everyone's.

   The browser copy is not thrown away. It is the fallback for a backend
   that cannot be reached — the signed-out first seconds of a page, a
   script being redeployed — so saving still works and nothing is lost
   while it is down. The server wins wherever both have a project of the
   same name, because the server is the one every device can see. */
let PROJ_REMOTE=[];          /* [{name,owner,ownerName,saved,hasAssets,mine}] */
let PROJ_REMOTE_OK=false;    /* has a list come back this session */
let PROJ_ADMIN=false;

const projRemoteFind=name=>PROJ_REMOTE.find(p=>p.name===name);
/* Two people may each have a project called "Dosti". The admin sees both,
   so the list shows whose it is and the open sends the owner back. */
const projLabel=p=>p.mine?p.name:`${p.name} — ${p.ownerName||p.owner}`;

async function projPull(quiet){
  if(typeof adsCall!=="function"||!USER)return false;
  const r=await adsCall("proj-list",{});
  if(!r||r.error){
    if(!quiet&&r&&r.error)toast(`Saved projects could not be listed: ${r.error}`,6000);
    return false;
  }
  PROJ_REMOTE=r.projects||[]; PROJ_REMOTE_OK=true; PROJ_ADMIN=!!r.admin;
  drawProjects();
  return true;
}

/* The picker: the server's, then whatever is only in this browser. */
function projOptions(){
  const local=projects();
  const seen={};
  const mine=[],team=[],here=[];
  PROJ_REMOTE.forEach(p=>{
    seen[p.name]=1;
    (p.mine?mine:team).push(
      `<option value="r:${esc(p.owner)}:${esc(p.name)}">${esc(projLabel(p))}</option>`);
  });
  Object.keys(local).sort((a,b)=>(local[b].saved||0)-(local[a].saved||0))
    .forEach(n=>{ if(!seen[n])here.push(`<option value="l:${esc(n)}">${esc(n)}</option>`); });
  let html="";
  if(mine.length)html+=`<optgroup label="Yours">${mine.join("")}</optgroup>`;
  if(team.length)html+=`<optgroup label="The team's">${team.join("")}</optgroup>`;
  if(here.length)html+=`<optgroup label="${PROJ_REMOTE_OK
    ?"This browser only — save again to put them on the server"
    :"This browser"}">${here.join("")}</optgroup>`;
  return {html, any:mine.length+team.length+here.length};
}

/* ── saving ── */
async function projPutRemote(name,snap,assets){
  const r=await adsCall("proj-put",{name,project:snap,assets:assets||null});
  if(!r||r.error)return {error:(r&&r.error)||"no answer from the script"};
  return r;
}

/* ── opening ── */
/* The restore happens across a reload, the way opening a project always
   has: every panel redraws from the restored state instead of being
   patched up in place. Named so a test can hold it still. */
function projReload(){ location.reload(); }
async function projOpenRemote(owner,name){
  const r=await adsCall("proj-get",{name,owner});
  if(!r||r.error)return toast(`Could not open it: ${(r&&r.error)||"no answer"}`,7000);
  const p=r.project||{};
  p.name=name;
  p.remote={owner,name};               /* so the reload fetches its pictures from the server */
  p.hasAssets=!!(r.meta&&r.meta.hasAssets);
  try{ sessionStorage.setItem("pp_restore",JSON.stringify(p)); }
  catch(e){ return toast("That project is too large for this browser to open.",7000); }
  if(typeof logEvent==="function")logEvent("project-open",name);
  projReload();
}

/* After the reload, the pictures. A project that came off the server has
   them on the server; one that was only ever in this browser has them in
   IndexedDB, where they always were. */
async function projFetchAssets(p){
  if(p.remote&&typeof adsCall==="function"){
    const r=await adsCall("proj-assets",{name:p.remote.name,owner:p.remote.owner});
    if(r&&r.assets)return r.assets;
    if(r&&r.error)toast(`Its images could not be read: ${r.error}`,7000);
    return null;
  }
  return AssetDB.get(p.name).catch(()=>null);
}

onBoot(()=>{ if(USER)projPull(true); });
