/* 数字能量 V1: 所有计算在设备浏览器完成；无 API、无遥测、无网络请求。 */
'use strict';
const DEFAULT_BASE = {
 '生气':['14','41','67','76','39','93','28','82'],
 '天医':['13','31','86','68','49','94','27','72'],
 '延年':['19','91','78','87','34','43','26','62'],
 '伏位':['11','22','88','99','66','77','33','44'],
 '祸害':['17','71','89','98','46','64','23','32'],
 '五鬼':['18','81','97','79','36','63','24','42'],
 '六煞':['16','61','47','74','38','83','29','92'],
 '绝命':['12','21','69','96','48','84','37','73']
};
const KEYS={pack:'ne.privateRules.v1',history:'ne.history.v1',override:'ne.corrected.v1',showOcr:'ne.showOCR.v1'};
const $=q=>document.querySelector(q);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function storageGet(key,fallback){try{const v=localStorage.getItem(key);return v===null?fallback:JSON.parse(v)}catch(e){return fallback}}
function storageSave(key,v){try{localStorage.setItem(key,JSON.stringify(v));return true}catch(e){toast('本机存储不可用，请先导出备份');return false}}
const STATE_KEY='ne.state.v1';
const storedState=storageGet(STATE_KEY,null);
let pack=storedState ? storedState.pack : storageGet(KEYS.pack,null) || (window.__PRIVATE_PACK_V1||null);
if(pack&&!isValidPack(pack))pack=null;
let history=cleanHistory(storedState ? storedState.history : storageGet(KEYS.history,[]));
let overrides=cleanOverrides(storedState ? storedState.overrides : storageGet(KEYS.override,{}));
let showOcr=!!(storedState ? storedState.showOcr : storageGet(KEYS.showOcr,false));
function cleanHistory(items){return Array.isArray(items)?items.filter(x=>x&&typeof x.number==='string'&&/^\d{3,20}$/.test(x.number)&&Number.isFinite(x.at)).slice(0,50):[]}
function cleanOverrides(items){return Object.fromEntries(Object.entries(items&&typeof items==='object'&&!Array.isArray(items)?items:{}).filter(([id,x])=>/^(普通组合|特殊数字|未覆盖|补充组合):\d{3,20}$/.test(id)&&x&&typeof x.detail==='string'&&x.detail.trim().length>0&&x.detail.length<=500&&Number.isFinite(x.at)))}
function saveState(next={}){const state={pack,history,overrides,showOcr,...next};if(!storageSave(STATE_KEY,state))return false;({pack,history,overrides,showOcr}=state);return true;}
let lastReport=null;
let toastTimer;
function toast(t){const x=$('#toast');x.textContent=t;x.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>x.classList.remove('show'),3000)}
function getBaseMap(){let pairs={};for(const [cat,arr] of Object.entries(pack?.base??DEFAULT_BASE))for(const code of arr)pairs[code]=cat;return pairs}
// Fixed column order from the supplied comparison chart; not an energy score.
function chartGroup(code,category){const index=DEFAULT_BASE[category]?.indexOf(code)??-1;return index<0?null:Math.floor(index/2)+1}
function pairLabel(p){return `${p.category} · ${p.group?'图表第 '+p.group+' 组':'图表组序待核对'}`}
function chunkGroups(x){
 if(x.code.length!==3)return '长组合按新版明确条目精确匹配，不推断整体磁场组序';
 if(/[05]/.test(x.code))return '图表组序：待核对（0／5 特殊组合不直接套用两位表）';
 const base=getBaseMap();
 return [x.code.slice(0,2),x.code.slice(1)].map(code=>pairLabel({category:base[code]||'未归类',group:chartGroup(code,base[code])})).join(' ＋ ');
}
function isValidPack(obj){
 if(!obj||obj.format!=='number-energy-rulepack-v1'||!obj.base||typeof obj.base!=='object'||Array.isArray(obj.base)||!Array.isArray(obj.three)||!Array.isArray(obj.special))return false;
 const cats=Object.keys(DEFAULT_BASE),seen=new Set();
 if(Object.keys(obj.base).length!==cats.length)return false;
 for(const cat of cats){const a=obj.base[cat];if(!Array.isArray(a)||a.length!==8)return false;for(const code of a){if(typeof code!=='string'||!/^[1-46-9]{2}$/.test(code)||seen.has(code))return false;seen.add(code)}}
 if(obj.three.length>10000||obj.special.length>10000)return false;
 const codes=new Set();
 if(obj.extra!==undefined&&(!Array.isArray(obj.extra)||obj.extra.length>10000))return false;
 if(obj.sourceDocument!==undefined&&(!obj.sourceDocument||typeof obj.sourceDocument.name!=='string'||obj.sourceDocument.name.length>200||typeof obj.sourceDocument.sha256!=='string'||!/^[a-f0-9]{64}$/.test(obj.sourceDocument.sha256)||obj.sourceDocument.replacesPrevious!==true||typeof obj.revision!=='string'))return false;
 for(const [kind,rules] of [['three',obj.three],['special',obj.special],['extra',obj.extra||[]]])for(const x of rules){
  if(!x||typeof x.code!=='string'||!(kind==='extra'?/^\d{3,20}$/:/^\d{3}$/).test(x.code)||codes.has(x.code)||typeof x.detail!=='string'||x.detail.length>=2000||!['checked','ocr','missing','document'].includes(x.status)||typeof x.verified!=='boolean'||!Number.isInteger(x.page)||x.page<0||x.page>10000)return false;
  if(x.status==='document'&&(!validDocumentSource(x.source)||!obj.sourceDocument||x.source.file!==obj.sourceDocument.name||x.source.sha256!==obj.sourceDocument.sha256||x.verified||x.page!==0))return false;
  if(x.sourceNote!==undefined&&(typeof x.sourceNote!=='string'||x.sourceNote.length>1000))return false;
  if(kind==='three'&&(!cats.includes(x.first)||!cats.includes(x.second)))return false;
  if(kind==='special'&&(!cats.includes(x.category)||!['0-mid','0-end','5-mid','5-end'].includes(x.kind)))return false;
  if(x.review!==undefined&&!validReview(x.review))return false;
  codes.add(x.code);
 }
 return (obj.baseReview===undefined||validReview(obj.baseReview))&&(obj.wordSource===undefined||validWordSource(obj.wordSource));
}
function validDocumentSource(s){return !!s&&typeof s.file==='string'&&s.file.length<=200&&typeof s.sha256==='string'&&/^[a-f0-9]{64}$/.test(s.sha256)&&Number.isInteger(s.paragraph)&&s.paragraph>0&&typeof s.section==='string'&&s.section.length<=300}
function validWordSource(s){
 if(!s||s.status!=='ocr'||typeof s.name!=='string'||s.name.length>200||typeof s.notice!=='string'||s.notice.length>2000||typeof s.sha256!=='string'||!/^[a-f0-9]{64}$/.test(s.sha256)||!Array.isArray(s.pages)||s.pages.length>500)return false;
 const seen=new Set();
 return s.pages.every(p=>{if(!p||!Number.isInteger(p.bookPage)||p.bookPage<1||p.bookPage>10000||seen.has(p.bookPage)||typeof p.title!=='string'||p.title.length>300||typeof p.text!=='string'||p.text.length>15000)return false;seen.add(p.bookPage);return true});
}
function wordReference(x){
 if(!pack?.wordSource||!/^\d{3}$/.test(x.code))return null;
 // A page-level reference is not a verified interpretation of this combination.
 return pack.wordSource.pages.find(p=>p.bookPage===x.page&&new RegExp('(^|[^0-9])'+x.code+'([^0-9]|$)').test(p.text))||null;
}
function wordReferenceText(x){const p=wordReference(x);return p?`Word OCR 参考·待核对（整页文字，不是本组合的独立结论）\n${pack.wordSource.name} · 稿内标注原书第 ${p.bookPage} 页\n${p.title}\n${p.text}`:''}
function wordReferenceHtml(x){const p=wordReference(x);if(!p)return '';return `<details class="notice"><summary>Word 参考页 · OCR 待核对</summary><p>以下为整页文字，不是本组合的独立结论；不替代上方已核验内容。文稿页码尚待核对。</p><div class="rule-description draft" style="white-space:pre-wrap">${showOcr?esc(wordReferenceText(x)):'请在设置开启待核对文字预览后查看。'}</div></details>`}
function validReview(r){return !!r&&r.method==='visual'&&/^[1-4]\.pdf$/.test(r.file)&&Number.isInteger(r.pdfPage)&&r.pdfPage>0&&r.pdfPage<=24&&Number.isInteger(r.bookPage)&&r.bookPage>0&&typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&typeof r.sha256==='string'&&/^[a-f0-9]{64}$/.test(r.sha256)}
function isReviewed(x){return x.status==='checked'&&x.verified===true&&validReview(x.review)&&x.review.bookPage===x.page}
function stateLabel(x){if(x.status==='document')return '最新版资料·待核对';return x.status==='corrected'?'个人修改·待核对':isReviewed(x)?'原图已核验':x.status==='checked'?'原包标记·待复核':x.status==='ocr'?'OCR 待校对':'未收录／待核对'}
function sourceFor(x){if(validDocumentSource(x.source))return `${x.source.file} · ${x.source.section} · 正文段落 ${x.source.paragraph}（非页码；原书页码未提供）`;if(validReview(x.review))return `${x.review.file} · PDF 第 ${x.review.pdfPage} 页 · 原书第 ${x.review.bookPage} 页`;return x.page?`原包标注原书第 ${x.page} 页 · 来源待核对`:'尚未核对原页'}
function ruleLookup(){let data=new Map();for(const x of pack?.three||[])data.set(x.code,{...x,categoryLabel:`${x.first}＋${x.second}`,type:'普通组合'});
 for(const x of pack?.special||[]){const m={'0-mid':'中间0','0-end':'结尾0','5-mid':'中间5','5-end':'结尾5'};data.set(x.code,{...x,categoryLabel:`${x.category} · ${m[x.kind]??'特殊数字'}`,type:'特殊数字'})}for(const x of pack?.extra||[])if(x.code.length===3)data.set(x.code,{...x,categoryLabel:'新版 BONUS 条目',type:'补充组合'});return data}
function buildAnalysis(number){
 const base=getBaseMap();const sourceRules=ruleLookup();const pairItems=[];const chunks=[];
 for(let i=0;i<number.length-1;i++){
  const code=number.slice(i,i+2);
  pairItems.push({code,category:base[code]??(code.includes('0')||code.includes('5')?'需查特殊规则':'未归类'),group:chartGroup(code,base[code]),at:i+1});
 }
 for(let i=0;i<number.length-2;i++){
  const code=number.slice(i,i+3);
  let x=sourceRules.get(code);
  if(!x){
    if(!code.includes('0')&&!code.includes('5')&&base[code.slice(0,2)]&&base[code.slice(1)]){
      x={code,categoryLabel:`${base[code.slice(0,2)]}＋${base[code.slice(1)]}`,type:'普通组合',detail:'',page:0,status:'missing',verified:false};
    }else{
      x={code,categoryLabel:code.includes('0')||code.includes('5')?'0 / 5 组合未收录·待核对':'基础磁场未归类',type:'未覆盖',detail:'',page:0,status:'missing',verified:false};
    }
  }
  const id=`${x.type}:${code}`;
  if(overrides[id]&&(!pack?.sourceDocument?.replacesPrevious||overrides[id].sourceRevision===pack.revision))x={...x,detail:overrides[id].detail,status:'corrected',verified:false};
  chunks.push({...x,id,at:i+1});
 }
 for(const x of pack?.extra||[]){if(x.code.length<=3)continue;for(let i=0;i<=number.length-x.code.length;i++){if(number.slice(i,i+x.code.length)!==x.code)continue;const id='补充组合:'+x.code;const personal=overrides[id];const item=personal&&(!pack?.sourceDocument?.replacesPrevious||personal.sourceRevision===pack.revision)?{...x,detail:personal.detail,status:'corrected',verified:false}:x;chunks.push({...item,id,at:i+1,type:'补充组合',categoryLabel:'新版 BONUS 条目'});}}
 chunks.sort((a,b)=>a.at-b.at||a.code.length-b.code.length);
 return {number,pairs:pairItems,chunks,created:Date.now()};
}
function statusBadge(x){
 return '<span class="'+(isReviewed(x)?'badge-ok':x.status==='missing'?'badge-unknown':'badge-draft')+'">'+stateLabel(x)+'</span>';
}
function visibleDetail(x){if(x.status==='document')return (x.sourceNote?'【待核对提示】'+x.sourceNote+'\n':'')+'新版文稿记载（未经逐条原图核验）：\n'+x.detail;if(x.status==='ocr'&&!showOcr)return '教材已找到此三位组合，但原文尚未核对。可在「设置」开启 OCR 草稿预览。';
 if(x.status==='checked'&&!isReviewed(x))return '原规则包标记为已核对，但尚无本版原图核验记录，待复核。'+(showOcr?' 原包文字：'+x.detail:' 可在设置开启待核对文字预览。');
 if(x.detail)return x.detail;
 return x.type==='普通组合'?'可识别基础磁场的顺序，但没有已核对的独立三位解释。':'未查到这组三位数字的明确规则；不能擅自删掉 0 或 5 推断。';}
function renderReport(report){lastReport=report;const el=$('#results');if(!report){el.innerHTML='';return}
 const ver=report.chunks.filter(isReviewed).length;
 const pending=report.chunks.filter(x=>x.status==='document'||x.status==='corrected'||(x.status==='checked'&&!isReviewed(x))).length;
 const draft=report.chunks.filter(x=>x.status==='ocr').length;
 const missed=report.chunks.length-ver-draft-pending;
 let html=`<div class="result-head"><div class="smallcaps">分析报告 · 按原书逐组检索</div><div class="result-number">${esc(report.number)}</div><div class="summary-pills"><span>原图核验 ${ver} 组</span><span>待复核／个人修改 ${pending} 组</span><span>OCR 草稿 ${draft} 组</span><span>未覆盖 ${missed} 组</span></div></div>`;
 html+=`<div class="subhead">基础磁场 <small>按相邻两位顺序</small></div><div class="pair-track">`;
 for(const p of report.pairs)html+=`<div class="pair-chip ${p.category.includes('未')||p.category.includes('需')?'muted':''}" title="号码第 ${p.at}–${p.at+1} 位"><strong>${esc(p.code)}</strong><small>${esc(p.category)}</small><small>${p.group?'图表第 '+p.group+' 组':'组序待核对'}</small><small>号码第 ${p.at}–${p.at+1} 位</small></div>`;
 html+='<p class="hint">图表第 1–4 组：指该磁场在对比表中从左到右的数字列，不是号码位置或吉凶评分。</p>';
 html+='</div><div class="hint">'+esc(pack?.sourceDocument?pack.sourceDocument.name+' · 数字能量对比表（新版资料）':pack?.baseReview?sourceFor({review:pack.baseReview}):'基础表来源待复核')+'</div><div class="subhead">组合条目 <small>三位逐位检查 · 长组合精确匹配</small></div>';
 for(const x of report.chunks){let d=visibleDetail(x);html+=`<article class="rule-card card"><div class="rule-top"><div class="rule-code">${esc(x.code)} <span style="font-size:11px;font-weight:400;color:#96a59b">#${x.at}–${x.at+x.code.length-1}</span></div>${statusBadge(x)}</div><div class="rule-kind">${esc(x.categoryLabel)}</div><div class="rule-kind">${esc(chunkGroups(x))}</div><div class="rule-description ${x.status==='ocr'?'draft':''}">${esc(d)}</div>${wordReferenceHtml(x)}<div class="rule-bottom"><span class="page">${esc(sourceFor(x))}</span><button class="rule-edit" data-edit="${esc(x.id)}">自行校对</button></div></article>`}
 html+=`<div class="overlap"><strong>组合关系说明</strong><br>每个三位窗口与相邻窗口有重叠；新版明确列出的较长组合另行精确匹配。相同磁场或特殊数字重复出现，不代表能量可以倍增、相互抵消或自动排序。当前已核验资料尚不足以支持整个号码的总评分算法，因此本版不计算「吉凶分」。</div>`;
 html+=`<div class="danger-tip">教材中关于疾病、财运、感情等内容只是传统理论的说法，不可据此诊断健康、评估真实财务风险或决定重大事项。</div>`;
 html+=`<div class="actions"><button id="copyReport" class="outline">复制文字报告</button><button id="saveReport" class="outline">下载 TXT 报告</button></div>`;
 el.innerHTML=html;
 el.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editRule(b.dataset.edit)));
 $('#copyReport').addEventListener('click',copyReport);$('#saveReport').addEventListener('click',saveReport);
}
function reportText(){if(!lastReport)return '';const r=lastReport;let lines=[`数字能量教材分析：${r.number}`,'','图表第 1–4 组表示磁场行内从左到右的数字列，不是号码位置或吉凶评分。','基础磁场：'];for(const x of r.pairs)lines.push(`${x.code}（号码第 ${x.at}-${x.at+1} 位）：${pairLabel(x)}`);
 lines.push('','组合条目：');for(const x of r.chunks)lines.push(`${x.code}（第 ${x.at}-${x.at+x.code.length-1} 位）${x.categoryLabel}\n${chunkGroups(x)}\n${visibleDetail(x)}\n${sourceFor(x)} · ${stateLabel(x)}\n${showOcr?wordReferenceText(x):''}\n`);
 lines.push('重叠的组合不可相加、相抵或推断整体吉凶。', '仅供核对教材传统说法，不构成科学预测或医疗、财务建议。');return lines.join('\n')}
async function copyReport(){const s=reportText();try{await navigator.clipboard.writeText(s);toast('已复制完整报告')}catch(e){saveReport();toast('无法直接复制，已提供 TXT 下载')}}
function downloadText(name,text,mime='text/plain;charset=utf-8'){const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob);let a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
function saveReport(){if(lastReport)downloadText(`数字分析_${lastReport.number}.txt`,'\ufeff'+reportText())}
function analyze(v,{save=true}={}){
 const number=String(v||'').replace(/\D/g,'');$('#entryError').textContent='';
 if(number.length<3||number.length>20){$('#entryError').textContent='请输入 3–20 位数字';return}
 if(!pack){toast('目前仅有基础磁场表。请导入私人教材规则包，才能查看详细解释。')}
 $('#numberInput').value=number;const r=buildAnalysis(number);renderReport(r);
 if(save)saveState({history:[{number,at:Date.now()},...history.filter(x=>x.number!==number)].slice(0,50)});
 document.querySelector('#results').scrollIntoView({behavior:'smooth',block:'start'});renderHistory();
}
function renderHistory(){const el=$('#historyList');if(!history.length){el.innerHTML='<div class="empty">还没有分析记录。<br>在「分析」页面输入号码就会保存在本机。</div>';return}
 el.innerHTML=history.map((h,i)=>`<div class="history-item card"><div><div class="number">${esc(h.number)}</div><div class="date">${esc(new Date(h.at).toLocaleString('zh-CN'))}</div></div><button data-revisit="${i}">查看 →</button></div>`).join('');
 el.querySelectorAll('[data-revisit]').forEach(el=>el.addEventListener('click',()=>{const h=history[Number(el.dataset.revisit)];if(!h)return;selectTab('analyze');analyze(h.number,{save:false})}));}
function updateSetup(){let loaded=!!pack;$('#importHint').style.display=loaded?'none':'';$('#packPill').textContent=loaded?'私人规则已导入':'尚未导入教材';$('#packStatus').textContent=loaded?`${pack.title||'私人规则包'} · ${pack.revision||'旧版规则包，请导入新版以查看核验记录'} · 仅保存在此设备`:'还没有导入教材规则包';const stats=$('#ruleStats');stats.innerHTML=loaded?`<span>基础数字 64 组</span><span>三位组合 ${pack.three.length} 组</span><span>原图核验 ${[...pack.three,...pack.special].filter(isReviewed).length} 组</span><span>特殊数字 ${pack.special.length} 组</span><span>新版资料待核对 ${[...pack.three,...pack.special,...(pack.extra||[])].filter(x=>x.status==='document').length} 条</span><span>BONUS ${pack.extra?.length||0} 条</span><span>Word 待校对参考 ${pack.wordSource?.pages.length||0} 页</span>`:'<span>基础两位磁场可先使用</span>';$('#showOcr').checked=showOcr;}
function selectTab(which){document.querySelectorAll('.tab-panel').forEach(el=>el.classList.toggle('active',el.id===`tab-${which}`));document.querySelectorAll('.navbtn').forEach(el=>el.classList.toggle('active',el.dataset.tab===which));window.scrollTo({top:0,behavior:'instant'});}
function editRule(id){if(!lastReport)return;const x=lastReport.chunks.find(x=>x.id===id);if(!x)return;
 const proposal=prompt(`个人修改 ${x.code}\n${sourceFor(x)}\n保存后仅修改本机版本，仍待核对。`,x.detail||'');
 if(proposal===null)return;const text=proposal.trim();if(!text||text.length>500){toast('请输入 1–500 字内容');return}
 if(!saveState({overrides:{...overrides,[id]:{detail:text,at:Date.now(),sourceRevision:pack?.revision||null}}}))return;renderReport(buildAnalysis(lastReport.number));toast('已保存个人修改，教材依据仍待核对');}
async function importPack(file){if(!file)return;try{const o=JSON.parse(await file.text());if(!isValidPack(o))throw new Error('格式不符合第一版规则包要求');if(!saveState({pack:o}))return;updateSetup();if($('#numberInput').value.trim())renderReport(buildAnalysis($('#numberInput').value.replace(/\D/g,'')));toast(pack.sourceDocument?.replacesPrevious?'新版资料已启用；旧个人修改已保留但不自动套用':'私人规则包导入成功，可离线分析')}catch(e){toast(`导入失败：${e.message}`)}}
function exportBackup(){let b={format:'number-energy-backup-v1',at:new Date().toISOString(),pack,history,overrides,showOcr};downloadText('数字能量_私人备份.json',JSON.stringify(b,null,2),'application/json');toast('已生成私人备份，请妥善保管')} 
async function restoreBackup(file){if(!file)return;try{const obj=JSON.parse(await file.text());if(!obj||obj.format!=='number-energy-backup-v1'||(obj.pack!==null&&!isValidPack(obj.pack))||!Array.isArray(obj.history)||!obj.overrides||typeof obj.overrides!=='object'||Array.isArray(obj.overrides)||typeof obj.showOcr!=='boolean')throw new Error('不是有效的私人备份');
 const nextHistory=cleanHistory(obj.history),nextOverrides=cleanOverrides(obj.overrides);
 if(nextHistory.length!==obj.history.length||Object.keys(nextOverrides).length!==Object.keys(obj.overrides).length)throw new Error('备份字段无效，未覆盖现有资料');
 if(!confirm('恢复备份将覆盖本机规则包、历史和自订校对，确定继续吗？'))return;
 if(!saveState({pack:obj.pack,history:nextHistory,overrides:nextOverrides,showOcr:obj.showOcr}))return;
 updateSetup();renderHistory();renderReport(lastReport?buildAnalysis(lastReport.number):null);toast('私人备份已恢复');
 }catch(e){toast(`恢复失败：${e.message}`)}}
function init(){
 $('#numberInput').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,20)});
 $('#numberInput').addEventListener('keydown',e=>{if(e.key==='Enter')analyze($('#numberInput').value)});
 $('#analyzeBtn').addEventListener('click',()=>analyze($('#numberInput').value));
 $('#clearInput').addEventListener('click',()=>{$('#numberInput').value='';$('#numberInput').focus()});
 for(const sel of ['#choosePackBtn','#choosePackSettings'])$(sel).addEventListener('click',()=>$('#packFile').click());
 $('#packFile').addEventListener('change',async e=>{await importPack(e.target.files?.[0]);e.target.value=''});
 $('#restoreFile').addEventListener('change',async e=>{await restoreBackup(e.target.files?.[0]);e.target.value=''});
 $('#restoreBackup').addEventListener('click',()=>$('#restoreFile').click());$('#exportBackup').addEventListener('click',exportBackup);
 $('#showOcr').addEventListener('change',e=>{if(!saveState({showOcr:e.target.checked})){e.target.checked=showOcr;return;}if(lastReport)renderReport(buildAnalysis(lastReport.number))});
 $('#clearHistory').addEventListener('click',()=>{if(!history.length)return;if(confirm('确定清除本机所有分析记录吗？')){if(saveState({history:[]})){renderHistory();toast('历史记录已清除')}}});
 document.querySelectorAll('.navbtn').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
 updateSetup();renderHistory();
 if('serviceWorker' in navigator && /^https?:/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>toast('离线缓存未能启用，请联网重试；私人资料不受影响'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
