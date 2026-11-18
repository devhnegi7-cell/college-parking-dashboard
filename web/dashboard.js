const icons = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
  list:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h6"/>',
  car:'<path d="m5 10 2-5h10l2 5m-15 8v2m16-2v2M4 18h16a1 1 0 0 0 1-1v-4l-2-3H5l-2 3v4a1 1 0 0 0 1 1Zm2-4h2m8 0h2"/>',
  bike:'<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="M5 17h7l-4-8m4 8 4-8m3 8-3-11h3M7 9h4"/>',
  pass:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 15h3m2-5h4m-4 4h4"/><circle cx="9.5" cy="11" r="1"/>',
  building:'<path d="M3 21h18M6 21V5l12-2v18M10 8h1m3 0h1m-5 4h1m3 0h1m-5 4h1m3 0h1"/>',
  enter:'<path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M4 12h11m-4-4 4 4-4 4"/>',
  exit:'<path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m9-8H9m7-4 4 4-4 4"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const $ = id => document.getElementById(id);
const campus = { timeZone: 'Asia/Kolkata' };
const fullDay = new Intl.DateTimeFormat('en-IN', { ...campus, weekday:'short', day:'numeric', month:'short', year:'numeric' });
const shortDay = new Intl.DateTimeFormat('en-IN', { ...campus, day:'numeric', month:'short' });
const clock = new Intl.DateTimeFormat('en-IN', { ...campus, hour:'numeric', minute:'2-digit', hour12:true });
const isoDay = new Intl.DateTimeFormat('en-CA', { ...campus, year:'numeric', month:'2-digit', day:'2-digit' });
const duration = ms => { const minutes = Math.max(0, Math.floor(ms / 60000)); return minutes < 60 ? minutes + 'm' : Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm'; };
const asDate = stamp => new Date(stamp.length === 10 ? stamp + 'T00:00:00+05:30' : stamp);
const views = {
  overview:['Overview','Parking overview','Monitor campus parking and manage vehicle movements.'],
  slots:['Parking slots','Parking slots','Find open spaces by location and vehicle type.'],
  log:['Entry & exit log','Entry & exit log','Track vehicles on campus and review recent parking history.'],
  vehicles:['Vehicles','Registered vehicles','Search by vehicle number, owner, department, or student ID.'],
  passes:['Parking passes','Parking passes','Check expiry dates and issue semester or temporary passes.']
};
let data, syncing = false, lastRefresh = 0, toastTimer;
const filters = {
  slots:{ kind:'all', area:'all', availability:'all' },
  log:{ q:'', date:'', activity:'all' },
  vehicles:{ q:'' }, passes:{ q:'', validity:'all' },
  overview:{ span:'fortnight', metric:'movement' }
};
const getView = () => Object.hasOwn(views, location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
const isOpen = record => !record.exited;
const vehicleIcon = type => type === 'Car' ? 'car' : 'bike';
const nameOf = student => student ? student.first_name + ' ' + student.last_name : 'Unknown student';
const pill = (label, tone = '') => '<span class="pill '+tone+'">'+esc(label)+'</span>';
const displayPlate = plate => plate.replace(/^([A-Z]{2})([0-9]{2})([A-Z]{1,3})([0-9]{4})$/, '$1 $2 $3 $4');
const plateLabel = v => '<span class="table-id"><span class="plate-icon">'+icon(vehicleIcon(v.type))+'</span><strong>'+esc(displayPlate(v.plate))+'</strong></span>';
const btn = (title, glyph, action, primary = false, attrs = '') => '<button class="button '+(primary?'primary':'')+'" type="button" data-dialog="'+action+'" '+attrs+'>'+icon(glyph)+esc(title)+'</button>';
const field = (label, inner) => '<label class="field"><span>'+esc(label)+'</span>'+inner+'</label>';
const options = (choices, selected) => choices.map(([key,label])=>'<option value="'+esc(key)+'"'+(key===selected?' selected':'')+'>'+esc(label)+'</option>').join('');
const choicesOf = list => list.map(x => [x,x]);
const filterSelect = (label, name, values, current) => field(label,'<select id="filter-'+name+'" data-filter="'+name+'">'+options(values,current)+'</select>');
const search = (label, placeholder, value) => field(label,'<input id="filter-q" type="search" data-filter="q" placeholder="'+esc(placeholder)+'" value="'+esc(value)+'">');
const head = (title, hint, extra = '') => '<div class="panel-head"><div><h2>'+esc(title)+'</h2>'+(hint?'<p class="hint">'+esc(hint)+'</p>':'')+'</div>'+extra+'</div>';
const table = (headers, rows, empty) => rows.length
  ? '<div class="table-wrap" tabindex="0" aria-label="Scrollable results"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(cells=>'<tr>'+cells.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'
  : '<div class="empty">'+esc(empty)+'</div>';
const lookup = () => ({
  vehicle:new Map(data.vehicles.map(v=>[v.id,v])),
  student:new Map(data.students.map(s=>[s.id,s])),
  active:new Map(data.records.filter(isOpen).map(r=>[r.slot_id,r]))
});
const matches = (q,...strings) => strings.filter(Boolean).join(' ').toLowerCase().includes(q.trim().toLowerCase());
const daysBetween = (start,end) => Math.round((Date.parse(end)-Date.parse(start))/86400000);
function passStatus(pass) {
  if (pass.expires < data.date) return ['Expired','red'];
  if (pass.issued > data.date) return ['Upcoming','gray'];
  return daysBetween(data.date,pass.expires) <= 7 ? ['Expiring soon','amber'] : ['Valid','green'];
}
function status(ok, message) {
  $('status').className = 'status '+(ok?'live':'error');
  $('statusText').textContent = message;
}
function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => $('toast').hidden = true, 4200);
}

function metrics(active) {
  const todayRecords = data.records.filter(r=>isoDay.format(new Date(r.entered))===data.date);
  const finished = data.records.filter(r=>r.exited && isoDay.format(new Date(r.exited))===data.date);
  const carCount = data.slots.filter(s=>s.type==='Car').length;
  const bikeCount = data.slots.filter(s=>s.type==='Two-wheeler').length;
  const percent = data.slots.length ? Math.round(active.size * 100 / data.slots.length) : 0;
  const cards = [
    ['Total capacity', data.slots.length, 'grid', '', carCount+' car slots · '+bikeCount+' bike slots'],
    ['Occupied slots', active.size, 'car', 'orange', percent+'% of total capacity'],
    ['Available now', data.slots.length-active.size, 'check', 'green', 'Ready for vehicle entry'],
    ['Entries today', todayRecords.length, 'enter', 'blue', finished.length+' exits recorded today']
  ];
  return '<div class="stats">'+cards.map(([title,value,glyph,color,note])=>
    '<article class="stat"><div class="stat-top">'+title+'<span class="stat-icon '+color+'">'+icon(glyph)+'</span></div><strong>'+value+'</strong><small>'+note+'</small></article>').join('')+'</div>';
}

function traffic() {
  const {span,metric}=filters.overview, occupancy=metric==='occupancy';
  const filtersHtml = '<div class="chart-filters"><select class="compact" aria-label="Chart metric" data-filter="metric" id="filter-metric">'+
    options([['movement','Movement'],['occupancy','Occupancy']],metric)+'</select><select class="compact" aria-label="Chart date range" data-filter="span" id="filter-span">'+
    options([['today','Today'],['yesterday','Yesterday'],['week','Last 7 days'],['fortnight','Last 14 full days']],span)+'</select></div>';
  const midnight = asDate(data.date).getTime();
  const fortnight = span === 'fortnight';
  const daily = span === 'week' || fortnight;
  const first = midnight - (fortnight ? 14 : span === 'week' ? 6 : span === 'yesterday' ? 1 : 0) * 86400000;
  const step = daily ? 86400000 : 7200000;
  const events = data.records.flatMap(r=>[{time:Date.parse(r.entered),delta:1},...(r.exited?[{time:Date.parse(r.exited),delta:-1}]:[])])
    .sort((a,b)=>a.time-b.time || a.delta-b.delta);
  let active = 0, cursor = 0;
  const groups = Array.from({length:fortnight?14:daily?7:12},(_,i)=>{
    const start=first+i*step, end=start+step;
    while(cursor<events.length && events[cursor].time<start) active+=events[cursor++].delta;
    let peak=active, arrival=0, departure=0;
    while(cursor<events.length && events[cursor].time<end){
      const {delta}=events[cursor++];
      active+=delta;
      if(delta===1) arrival+=1; else departure+=1;
      peak=Math.max(peak,active);
    }
    const observed = start <= Date.parse(data.updated);
    return { label:daily?shortDay.format(new Date(start)):String(i*2).padStart(2,'0')+':00',
      ticks:span==='week'||i%2===0||(fortnight&&i===13), amounts:occupancy?[observed?peak:0]:[arrival,departure] };
  });
  const max = Math.max(4, Math.ceil(Math.max(...groups.flatMap(g=>g.amounts))/4)*4);
  const labels=occupancy?['Peak vehicles parked']:['Entries','Exits'];
  const modifier = (i) => occupancy?'occupancy':i===1?'exit':'';
  const bars=groups.map(g=>{
    const tooltip=g.label+' · '+g.amounts.map((value,i)=>labels[i]+' '+value).join(', ');
    return '<div class="bucket" title="'+esc(tooltip)+'">'+g.amounts.map((v,i)=>'<i class="'+modifier(i)+'" style="height:'+(v / max * 100)+'%"></i>').join('')+(g.ticks?'<b>'+esc(g.label)+'</b>':'')+'</div>';
  }).join('');
  const legend=labels.map((x,i)=>'<span><i class="legend-dot '+modifier(i)+'"></i>'+x+'</span>').join('');
  return '<section class="panel chart-panel">'+head(occupancy?'Parking occupancy':'Parking activity',occupancy?'Peak vehicles parked in each interval':'Vehicle entries and exits by '+(daily?'day':'two-hour interval'),filtersHtml)+
    '<div class="chart-scroll"><div class="chart-layout" role="img" aria-label="'+esc(groups.map(g=>g.label+' '+g.amounts.map((v,i)=>labels[i]+' '+v).join(', ')).join('; '))+'"><div class="axis">'+
    [max,max*.75,max*.5,max*.25,0].map(n=>'<span>'+n+'</span>').join('')+'</div><div class="plot"><div class="gridlines"><i></i><i></i><i></i><i></i><i></i></div><div class="bars">'+bars+'</div></div></div></div><div class="chart-legend">'+legend+'</div></section>';
}
function zones(active) {
  const groups=new Map();
  for(const slot of data.slots){
    const key=slot.location+' · '+slot.type;
    if(!groups.has(key)) groups.set(key,{ kind:slot.type, total:0, occupied:0 });
    const group=groups.get(key); group.total++; if(active.has(slot.id)) group.occupied++;
  }
  return '<section class="panel zones-panel">'+head('Slot utilization','Current occupancy by area and vehicle type','<a class="plain-button" href="#slots">View slots '+icon('arrow')+'</a>')+
    '<div class="zones">'+[...groups].map(([title,g])=>'<div class="zone"><span class="zone-icon">'+icon(vehicleIcon(g.kind))+'</span><strong>'+esc(title)+'</strong><small>'+g.occupied+' / '+g.total+'</small><progress aria-label="'+esc(title)+' occupancy" value="'+g.occupied+'" max="'+g.total+'"></progress></div>').join('')+'</div></section>';
}
function recordsTable(records, lookup, overview = false) {
  const rows=records.map(r=>{
    const v=lookup.vehicle.get(r.vehicle_id), s=lookup.student.get(v.student_id);
    const now=Date.parse(data.updated), diff=(r.exited?Date.parse(r.exited):now)-Date.parse(r.entered);
    const status=r.exited?pill('Exited','gray'):diff>8*3600000?pill('Review exit','amber'):pill('Parked','green');
    const end=r.exited?clock.format(new Date(r.exited)):'—';
    const entry=esc(clock.format(new Date(r.entered)))+(overview?'':'<small>'+esc(shortDay.format(new Date(r.entered)))+'</small>');
    return [plateLabel(v),esc(nameOf(s)),esc(v.type),esc(r.slot_id),entry,overview?status:esc(end),...(overview?[]:[esc(duration(diff)),status])];
  });
  return table(['Vehicle','Student','Type','Slot','Entry time',...(overview?['Status']:['Exit time','Duration','Status'])],rows,'No parking records match these filters.');
}
function overview() {
  const refs=lookup();
  const recent=[...data.records].sort((a,b)=>String(b.exited||b.entered).localeCompare(a.exited||a.entered)).slice(0,5);
  return metrics(refs.active)+'<div class="overview-grid">'+traffic()+zones(refs.active)+'</div><section class="panel">'+
    head('Recent parking activity','Latest check-ins and check-outs','<a class="plain-button" href="#log">View full log '+icon('arrow')+'</a>')+recordsTable(recent,refs,true)+'</section>'+
    (data.demo?'<div class="demo-note"><span>Fictional demo vehicles and parking activity are loaded. Clear them before using the register with real records.</span><button type="button" class="plain-button" data-dialog="clear">Clear sample records</button></div>':'');
}
function slotsView() {
  const refs=lookup(), f=filters.slots;
  const areas=[...new Set(data.slots.map(s=>s.location))];
  const cards=data.slots.filter(s=>(f.kind==='all'||s.type===f.kind)&&(f.area==='all'||s.location===f.area)&&
    (f.availability==='all'||refs.active.has(s.id)===(f.availability==='occupied'))).map(s=>{
      const active=refs.active.get(s.id);
      const inner='<strong>'+esc(s.id)+'</strong><small>'+esc(s.location)+' · '+esc(s.type)+'</small>'+ (active?pill(displayPlate(refs.vehicle.get(active.vehicle_id).plate)):pill('Available','green'));
      return active?'<div class="slot busy">'+inner+'</div>':'<button type="button" class="slot free" data-dialog="entry" data-slot="'+esc(s.id)+'">'+inner+'</button>';
    });
  return '<section class="panel">'+head('Parking areas','Select a free slot to check in a vehicle.')+
    '<div class="toolbar">'+filterSelect('Vehicle type','kind',[['all','All vehicle types'],...choicesOf(['Car','Two-wheeler'])],f.kind)+
    filterSelect('Location','area',[['all','All locations'],...choicesOf(areas)],f.area)+
    filterSelect('Availability','availability',[['all','All slots'],['free','Available'],['occupied','Occupied']],f.availability)+
    '</div>'+(cards.length?'<div class="slot-grid">'+cards.join('')+'</div>':'<div class="empty">No slots match these filters.</div>')+'</section>';
}
function logView() {
  const refs=lookup(), f=filters.log;
  const records=data.records.filter(r=>{
    const v=refs.vehicle.get(r.vehicle_id), s=refs.student.get(v.student_id);
    const dateMatch=!f.date||isoDay.format(new Date(r.entered))===f.date;
    const statusMatch=f.activity==='all'||(f.activity==='parked'&&isOpen(r))||(f.activity==='exited'&&!isOpen(r))||
      (f.activity==='review'&&isOpen(r)&&Date.parse(data.updated)-Date.parse(r.entered)>8*3600000);
    return dateMatch&&statusMatch&&matches(f.q,v.plate,displayPlate(v.plate),v.type,nameOf(s),s.id,r.slot_id);
  });
  const finished=records.filter(r=>r.exited);
  const average=finished.length?duration(finished.reduce((total,r)=>total+Date.parse(r.exited)-Date.parse(r.entered),0)/finished.length):'—';
  return '<section class="panel">'+head('Parking register','Completed visits from the last 90 days and all open visits.')+'<div class="toolbar">'+
    search('Search','Vehicle, student, or slot',f.q)+field('Entry date','<input id="filter-date" type="date" data-filter="date" value="'+esc(f.date)+'">')+
    filterSelect('Status','activity',[['all','All statuses'],['parked','Parked'],['exited','Exited'],['review','Open more than 8 hours']],f.activity)+
    '</div>'+recordsTable(records,refs)+'<p class="table-note">'+records.length+' matching visits · Average completed parking duration '+esc(average)+'</p></section>';
}
function vehiclesView() {
  const refs=lookup(), f=filters.vehicles;
  const rows=data.vehicles.flatMap(v=>{
    const s=refs.student.get(v.student_id);
    if(!matches(f.q,v.plate,nameOf(s),s.id,s.department)&&!v.plate.includes(f.q.toUpperCase().replace(/[\s-]/g,''))) return [];
    return [[plateLabel(v),'<strong>'+esc(nameOf(s))+'</strong><small>'+esc(s.id)+'</small>',esc(s.department),esc(v.type),
      esc([v.brand,v.model].filter(Boolean).join(' ')||'—'),esc(v.color||'—')]];
  });
  return '<section class="panel">'+head('Vehicle register','Find the student associated with a vehicle number.')+'<div class="toolbar">'+
    search('Search','Vehicle number, name or student ID',f.q)+'</div>'+table(['Vehicle','Student','Department','Vehicle type','Brand and model','Color'],rows,'No registered vehicles match your search.')+'</section>';
}
function passesView() {
  const refs=lookup(), f=filters.passes;
  const rows=data.passes.flatMap(p=>{
    const s=refs.student.get(p.student_id), [state,tone]=passStatus(p);
    if(!matches(f.q,nameOf(s),s.id,p.type)||(f.validity!=='all'&&state!==f.validity)) return [];
    return [['<strong>'+esc(nameOf(s))+'</strong><small>'+esc(s.id)+'</small>',esc(p.type),esc(shortDay.format(asDate(p.issued))),
      esc(fullDay.format(asDate(p.expires))),pill(state,tone)]];
  });
  return '<section class="panel">'+head('Pass register','Passes expiring in the next seven days are flagged.')+'<div class="toolbar">'+
    search('Search','Student name or ID',f.q)+filterSelect('Pass status','validity',[['all','All statuses'],...choicesOf(['Valid','Expiring soon','Expired','Upcoming'])],f.validity)+
    '</div>'+table(['Student','Pass type','Issued','Expiry date','Status'],rows,'No parking passes match these filters.')+'</section>';
}

function render(keepFocus=false) {
  const view=getView(), [crumb,title,subtitle]=views[view];
  const selected=keepFocus?document.activeElement:null;
  const selection=selected?.type==='search'?[selected.selectionStart,selected.selectionEnd]:null;
  $('crumb').textContent=crumb;
  $('title').textContent=title;
  $('subtitle').textContent=subtitle;
  $('today').textContent=fullDay.format(new Date());
  document.querySelectorAll('[data-view]').forEach(a=>{
    if(a.dataset.view===view) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
  if ($('actions').dataset.view !== view) {
    $('actions').dataset.view = view;
    $('actions').innerHTML=view==='passes'?btn('Issue pass','plus','pass',true):view==='vehicles'?btn('Register vehicle','plus','vehicle',true):
    btn('Record exit','exit','exit')+btn('Vehicle entry','enter','entry',true);
  }
  if(!data) return;
  $('content').innerHTML={overview,slots:slotsView,log:logView,vehicles:vehiclesView,passes:passesView}[view]();
  $('content').setAttribute('aria-busy','false');
  if(selected?.id) {
    const updated=$(selected.id);
    updated?.focus({preventScroll:true});
    if(selection) updated?.setSelectionRange(...selection);
  }
}
async function refresh(force=false){
  if(syncing&&!force) return;
  if(!force&&(document.hidden||$('dialog').open||(document.activeElement?.closest('#content')&&!document.activeElement?.dataset.filter))) return;
  const started=Date.now();
  syncing=true;
  try {
    const res=await fetch('/api/state',{cache:'no-store'});
    const snapshot=await res.json();
    if(!res.ok) throw new Error(snapshot.error);
    if(started<lastRefresh) return;
    lastRefresh=started;
    data=snapshot;
    status(true, 'Live register · Updated '+clock.format(new Date(data.updated)));
    render(Boolean(document.activeElement?.dataset.filter));
  } catch(err) {
    status(false,data?'Could not refresh. Showing the last available records.':'Unable to load the parking database.');
    if(!data){
      $('content').setAttribute('aria-busy','false');
      $('content').innerHTML='<div class="panel empty"><p>'+esc(err.message)+'</p><br><button id="retry" class="button" type="button">Retry</button></div>';
    }
  } finally {syncing=false;}
}

function popup(action, element) {
  if(!data) {toast('Wait for the parking register to load.');return;}
  const dialog=$('dialog'), refs=lookup(), today=data.date;
  const input=(name,attrs='')=>'<input name="'+name+'" '+attrs+'>';
  const required='required maxlength="24"';
  const pair=(...items)=>'<div class="two">'+items.join('')+'</div>';
  const list=(id,values)=>'<datalist id="'+id+'">'+values.map(([value,label])=>'<option value="'+esc(value)+'">'+esc(label)+'</option>').join('')+'</datalist>';
  const studentOptions=data.students.map(s=>[s.id,nameOf(s)]);
  const configs={
    entry:['Record vehicle entry','Check in a registered vehicle with a valid parking pass.',
      field('Vehicle number',input('plate', required+' placeholder="Enter vehicle number" list="entry-plates"')+
        list('entry-plates', data.vehicles.map(v=>[displayPlate(v.plate),nameOf(refs.student.get(v.student_id))])))+
      field('Available slot','<select name="slot" required></select>'),'Check in','entry'],
    exit:['Record vehicle exit','Record an exit and release the assigned slot.',
      field('Vehicle number',input('plate',required+' placeholder="Enter vehicle number" list="active-plates"')+
        list('active-plates',[...refs.active.values()].map(r=>[displayPlate(refs.vehicle.get(r.vehicle_id).plate),r.slot_id]))),'Check out','exit'],
    vehicle:['Register vehicle','Use an existing student ID or enter details for a new student.',
      pair(field('Vehicle number', input('plate',required+' placeholder="Registration number"')),
        field('Vehicle type','<select name="type" required>'+options(choicesOf(['Car','Two-wheeler']))+'</select>'))+
      field('Student ID',input('student',required+' list="students"')+list('students',studentOptions))+
      pair(field('First name (new student)',input('first','maxlength="50"')),field('Last name (new student)',input('last','maxlength="50"')))+
      field('Department (new student)',input('department','maxlength="80"'))+
      pair(field('Brand',input('brand','maxlength="80"')),field('Model',input('model','maxlength="80"')))+
      field('Color',input('color','maxlength="80"')),'Register','vehicle'],
    pass:['Issue parking pass','Choose a registered student and the last day their pass will be valid.',
      field('Student ID',input('student',required+' list="students"')+list('students',studentOptions))+
      pair(field('Pass type','<select name="type" required>'+options(choicesOf(['Semester','Temporary']))+'</select>'),
        field('Expiry date',input('expires','required type="date" min="'+esc(today)+'"'))),'Issue pass','pass'],
    clear:['Clear sample records','This removes sample visits and unused sample registrations. The preset parking slots and your own entries stay available.',
      '','Clear sample records','clear-samples']
  };
  const [title,description,fields,submit,route]=configs[action];
  dialog.innerHTML='<div class="dialog-head"><h2 id="dialog-title">'+title+'</h2><button type="button" class="close" aria-label="Close dialog">×</button></div>'+
    '<form class="form"><p>'+description+'</p>'+fields+'<div class="message" role="alert" hidden></div><div class="dialog-actions"><button class="button close" type="button">Cancel</button><button class="button primary" type="submit">'+submit+'</button></div></form>';
  dialog.setAttribute('aria-labelledby','dialog-title');
  dialog.querySelectorAll('.close').forEach(button=>button.addEventListener('click',()=>dialog.close()));
  const form=dialog.querySelector('form');
  if(action==='entry'){
    const selector=form.elements.slot, plateInput=form.elements.plate;
    const updateSlots=()=>{
      const current=selector.value||element.dataset.slot;
      const v=data.vehicles.find(item=>item.plate===plateInput.value.toUpperCase().replace(/[\s-]/g,''));
      const valid=data.slots.filter(s=>!refs.active.has(s.id)&&(!v||s.type===v.type));
      selector.innerHTML=options([['',valid.length?'Choose a slot':'No available slots'],...valid.map(s=>[s.id,s.id+' · '+s.location+' · '+s.type])],current);
    };
    plateInput.addEventListener('input',updateSlots);
    updateSlots();
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const error=form.querySelector('.message'), button=form.querySelector('[type="submit"]');
    button.disabled=true;
    error.hidden=true;
    try {
      const response=await fetch('/api/'+route,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      const result=await response.json();
      if(!response.ok) throw new Error(result.error);
      dialog.close();
      await refresh(true);
      toast(result.message);
    } catch(err) {
      error.textContent=err.message;
      error.hidden=false;
    } finally {button.disabled=false;}
  });
  dialog.showModal();
  form.querySelector('input')?.focus();
}
document.addEventListener('click',event=>{
  const action=event.target.closest('[data-dialog]');
  if(action) popup(action.dataset.dialog,action);
  if(event.target.closest('#retry')) refresh(true);
});
function applyFilter(event){
  const input=event.target.closest('[data-filter]');
  if(!input) return;
  if(event.type==='input'&&input.type!=='search') return;
  filters[getView()][input.dataset.filter]=input.value;
  render(true);
}
document.addEventListener('input',applyFilter);
document.addEventListener('change',applyFilter);
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) refresh(); });
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
render();
refresh(true);
setInterval(refresh,10000);
