/* Mis Finanzas - almacenamiento local y dashboard */
const STORAGE_KEY = 'misFinanzas_v1';
const DEFAULT_CATEGORIES = {
  expense: ['Casa','Salud','Colegiatura','Alimentación','Transporte','Entretenimiento','Servicios','Compras','Otros'],
  income: ['Sueldo','Honorarios','Negocio','Inversiones','Regalos','Otros']
};
const COLORS = ['#4d9b78','#e7a65a','#6d83c5','#c87583','#8b76b9','#54a9b4','#b6a05b','#758493','#d18c63','#78a58e'];
let state = loadState();
let period = 'day';
let anchor = new Date();
let expenseChart = null, incomeChart = null;

function loadState(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.transactions) && saved.categories) return saved;
  } catch(e) { console.warn('No se pudo leer el respaldo local.', e); }
  return {transactions: [], categories: structuredClone(DEFAULT_CATEGORIES)};
}
function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
const money = n => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);
const dateISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const sameDay = (a,b) => dateISO(a)===dateISO(b);
function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}
function periodRange(){
  const start=new Date(anchor), end=new Date(anchor);
  if(period==='day'){start.setHours(0,0,0,0);end.setHours(23,59,59,999);}
  if(period==='week'){start.setTime(startOfWeek(anchor).getTime());end.setTime(start);end.setDate(start.getDate()+6);end.setHours(23,59,59,999);}
  if(period==='month'){start.setDate(1);start.setHours(0,0,0,0);end.setMonth(end.getMonth()+1,0);end.setHours(23,59,59,999);}
  if(period==='year'){start.setMonth(0,0);start.setHours(0,0,0,0);end.setMonth(11,31);end.setHours(23,59,59,999);}
  return {start,end};
}
function periodTransactions(){const {start,end}=periodRange();return state.transactions.filter(t=>{const d=parseDate(t.date);return d>=start&&d<=end;});}
function totals(items){return items.reduce((a,t)=>{a[t.type]+=Number(t.amount);return a;},{income:0,expense:0});}
function fmtPeriod(){
  const {start,end}=periodRange(), opts={day:'numeric',month:'short',year:'numeric'};
  if(period==='day')return start.toLocaleDateString('es-MX',{weekday:'long',...opts});
  if(period==='week')return `${start.toLocaleDateString('es-MX',{day:'numeric',month:'short'})} – ${end.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}`;
  if(period==='month')return start.toLocaleDateString('es-MX',{month:'long',year:'numeric'});
  return String(start.getFullYear());
}
function render(){
  const all=totals(state.transactions), selected=totals(periodTransactions());
  document.getElementById('balance').textContent=money(all.income-all.expense);
  document.getElementById('totalIncome').textContent=money(all.income);
  document.getElementById('totalExpense').textContent=money(all.expense);
  document.getElementById('periodLabel').textContent=fmtPeriod();
  document.getElementById('periodIncome').textContent=money(selected.income);
  document.getElementById('periodExpense').textContent=money(selected.expense);
  const net=document.getElementById('periodNet');net.textContent=money(selected.income-selected.expense);net.className=selected.income-selected.expense>=0?'green':'red';
  document.getElementById('movementSubtitle').textContent=`${periodTransactions().length} movimiento(s) en este periodo`;
  renderCharts(periodTransactions());renderTransactions();
}
function grouped(items,type){
  const map={};items.filter(t=>t.type===type).forEach(t=>map[t.category]=(map[t.category]||0)+Number(t.amount));
  return Object.entries(map).sort((a,b)=>b[1]-a[1]);
}
function drawChart(canvasId,legendId,entries,oldChart){
  if(oldChart)oldChart.destroy();
  const ctx=document.getElementById(canvasId);
  const total=entries.reduce((s,e)=>s+e[1],0);
  if(!entries.length){ctx.parentElement.innerHTML='<div class="empty">Sin movimientos en este periodo</div>';document.getElementById(legendId).innerHTML='';return null;}
  const chart=new Chart(ctx,{type:'doughnut',data:{labels:entries.map(e=>e[0]),datasets:[{data:entries.map(e=>e[1]),backgroundColor:entries.map((_,i)=>COLORS[i%COLORS.length]),borderWidth:3,borderColor:'#fff',hoverOffset:8}]},options:{responsive:true,maintainAspectRatio:false,cutout:'67%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${money(c.raw)} (${(c.raw/total*100).toFixed(1)}%)`}}}}});
  document.getElementById(legendId).innerHTML=entries.map((e,i)=>`<div class="legend-item"><i class="legend-dot" style="background:${COLORS[i%COLORS.length]}"></i><span>${escapeHTML(e[0])}</span><b>${(e[1]/total*100).toFixed(0)}%</b></div>`).join('');
  return chart;
}
function renderCharts(items){
  // Recrea los canvas si una gráfica anterior estaba vacía.
  ['expenseChart','incomeChart'].forEach((id,i)=>{
    const wrap=document.getElementById(id).parentElement;
    if(!wrap.querySelector('canvas'))wrap.innerHTML=`<canvas id="${id}"></canvas>`;
  });
  expenseChart=drawChart('expenseChart','expenseLegend',grouped(items,'expense'),expenseChart);
  incomeChart=drawChart('incomeChart','incomeLegend',grouped(items,'income'),incomeChart);
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderTransactions(){
  const q=document.getElementById('searchInput').value.toLowerCase(), filter=document.getElementById('typeFilter').value;
  const items=periodTransactions().filter(t=>(filter==='all'||t.type===filter)&&(`${t.category} ${t.note||''}`).toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date));
  const root=document.getElementById('transactionList');
  if(!items.length){root.innerHTML='<div class="empty">No hay movimientos que mostrar todavía.</div>';return;}
  root.innerHTML=items.map(t=>`<div class="transaction"><div class="tx-icon">${t.type==='income'?'↗':'↘'}</div><div class="tx-main"><strong>${escapeHTML(t.note||t.category)}</strong><small>${escapeHTML(t.category)} · ${parseDate(t.date).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}</small></div><span class="tx-amount ${t.type}">${t.type==='income'?'+':'−'}${money(t.amount)}</span><button class="delete-tx" data-delete="${t.id}" title="Eliminar" aria-label="Eliminar movimiento">×</button></div>`).join('');
  root.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>{if(confirm('¿Eliminar este movimiento?')){state.transactions=state.transactions.filter(t=>t.id!==btn.dataset.delete);persist();render();}}));
}
function openTransaction(type){
  document.getElementById('transactionForm').reset();
  document.getElementById('transactionType').value=type;
  document.getElementById('formTitle').textContent=type==='income'?'Agregar ingreso':'Agregar gasto';
  document.getElementById('formEyebrow').textContent=type==='income'?'REGISTRAR INGRESO':'REGISTRAR GASTO';
  document.getElementById('date').value=dateISO(new Date());
  fillCategories(type);
  document.getElementById('transactionDialog').showModal();
  setTimeout(()=>document.getElementById('amount').focus(),50);
}
function fillCategories(type){
  const select=document.getElementById('category');
  select.innerHTML=state.categories[type].map(c=>`<option>${escapeHTML(c)}</option>`).join('');
}
function renderCategoryManager(){
  const type=document.getElementById('newCategoryType').value;
  document.getElementById('categoryManager').innerHTML=state.categories[type].map(c=>`<span class="category-chip">${escapeHTML(c)} <button type="button" data-cat="${escapeHTML(c)}" aria-label="Eliminar ${escapeHTML(c)}">×</button></span>`).join('');
  document.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{const name=b.dataset.cat;if(state.categories[type].length<=1){alert('Debe quedar al menos una categoría.');return;}if(state.transactions.some(t=>t.type===type&&t.category===name)){alert('Esta categoría ya está en uso. No se puede eliminar.');return;}state.categories[type]=state.categories[type].filter(c=>c!==name);persist();renderCategoryManager();}));
}
document.getElementById('addIncome').addEventListener('click',()=>openTransaction('income'));
document.getElementById('addExpense').addEventListener('click',()=>openTransaction('expense'));
document.getElementById('transactionForm').addEventListener('submit',e=>{
  e.preventDefault();const type=document.getElementById('transactionType').value,amount=Number(document.getElementById('amount').value);
  if(!Number.isFinite(amount)||amount<=0)return;
  state.transactions.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),type,amount,date:document.getElementById('date').value,category:document.getElementById('category').value,note:document.getElementById('note').value.trim()});
  persist();document.getElementById('transactionDialog').close();render();
});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
document.querySelectorAll('.period').forEach(b=>b.addEventListener('click',()=>{period=b.dataset.period;document.querySelectorAll('.period').forEach(x=>x.classList.toggle('active',x===b));render();}));
function shiftPeriod(delta){if(period==='day')anchor.setDate(anchor.getDate()+delta);if(period==='week')anchor.setDate(anchor.getDate()+7*delta);if(period==='month')anchor.setMonth(anchor.getMonth()+delta);if(period==='year')anchor.setFullYear(anchor.getFullYear()+delta);render();}
document.getElementById('prevPeriod').addEventListener('click',()=>shiftPeriod(-1));
document.getElementById('nextPeriod').addEventListener('click',()=>shiftPeriod(1));
document.getElementById('searchInput').addEventListener('input',renderTransactions);
document.getElementById('typeFilter').addEventListener('change',renderTransactions);
document.getElementById('categoryBtn').addEventListener('click',()=>{renderCategoryManager();document.getElementById('categoryDialog').showModal();});
document.getElementById('newCategoryType').addEventListener('change',renderCategoryManager);
document.getElementById('categoryForm').addEventListener('submit',e=>{e.preventDefault();const type=document.getElementById('newCategoryType').value,name=document.getElementById('newCategoryName').value.trim();if(!name)return;if(state.categories[type].some(c=>c.toLowerCase()===name.toLowerCase())){alert('Esa categoría ya existe.');return;}state.categories[type].push(name);document.getElementById('newCategoryName').value='';persist();renderCategoryManager();});
document.getElementById('exportBtn').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`respaldo-finanzas-${dateISO(new Date())}.json`;a.click();URL.revokeObjectURL(url);
});
document.getElementById('exportBtn').addEventListener('contextmenu',e=>{e.preventDefault();document.getElementById('importFile').click();});
document.getElementById('importFile').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.transactions)||!data.categories)throw Error();if(confirm('Importar reemplazará los datos actuales. ¿Continuar?')){state=data;persist();render();alert('Respaldo importado correctamente.');}}catch{alert('El archivo no es un respaldo válido.');}e.target.value='';
});
if('serviceWorker' in navigator && location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
render();
