/* --- DATA --- */
const RAW_DATA_A = [
  { k: "cat", p: 0, c: "bg-p0" }, { k: "cat", p: 0, c: "bg-p0" },
  { k: "dog", p: 1, c: "bg-p1" }, { k: "dog", p: 1, c: "bg-p1" },
  { k: "ant", p: 2, c: "bg-p2" }, { k: "ant", p: 2, c: "bg-p2" },
  { k: "car", p: 0, c: "bg-p0" }, { k: "day", p: 1, c: "bg-p1" },
  { k: "cat", p: 0, c: "bg-p0" }, { k: "dog", p: 1, c: "bg-p1" }
];

const RAW_DATA_B = [
  { k: "cup", p: 0, c: "bg-p0" }, { k: "dot", p: 1, c: "bg-p1" }, 
  { k: "dot", p: 1, c: "bg-p1" }, { k: "arm", p: 2, c: "bg-p2" }, 
  { k: "cup", p: 0, c: "bg-p0" }, { k: "arm", p: 2, c: "bg-p2" },
  { k: "dog", p: 1, c: "bg-p1" }, { k: "cat", p: 0, c: "bg-p0" } 
];

const CONFIG = { BUFFER_CAPACITY: 6, SPILL_THRESHOLD: 0.75 };
let state = {
  running: false,
  mappers: [
    { id: 0, buffer: [], spills: [], final: [], data: [...RAW_DATA_A] },
    { id: 1, buffer: [], spills: [], final: [], data: [...RAW_DATA_B] }
  ]
};

/* --- HELPERS --- */
const el = (id) => document.getElementById(id);
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg, type="SYS") {
  const div = document.createElement('div');
  let styleClass = "log-sys";
  if(type==="MAP") styleClass = "log-map";
  if(type==="DISK") styleClass = "log-disk";
  if(type==="NET") styleClass = "log-net";
  if(type==="RED") styleClass = "log-red";
  
  div.className = `log-entry ${styleClass}`;
  
  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  div.innerHTML = `<span style="opacity:0.5; font-size:9px; margin-right:6px;">[${time}]</span> ${msg}`;
  
  const consoleEl = el('consoleLog');
  if(consoleEl) {
    consoleEl.prepend(div);
    if(consoleEl.children.length > 30) consoleEl.lastChild.remove();
  }
}

function createRecord(data, count=1) {
  const d = document.createElement('div');
  d.className = `kv-record ${data.c}`; 
  d.textContent = `${data.k}:${count}`;
  return d;
}

function turnActiveToGhosts(container) {
  if (el('teachingMode').checked && container) {
    Array.from(container.querySelectorAll('.kv-record:not(.ghost):not(.persistent)')).forEach(r => {
      r.classList.add('ghost'); r.classList.remove('show');
    });
  }
}

function turnActiveToPersistent(container) {
  if (el('teachingMode').checked && container) {
     Array.from(container.querySelectorAll('.kv-record:not(.ghost):not(.persistent)')).forEach(r => {
       r.classList.add('persistent'); r.classList.remove('show');
     });
  }
}

function clearRamBuffer(container) {
  if (!el('teachingMode').checked && container) {
    Array.from(container.querySelectorAll('.kv-record')).forEach(r => r.remove());
  }
}

function highlightNodes(nodeIds, phaseName) {
  document.querySelectorAll('.node-container').forEach(n => n.classList.remove('active-node'));
  document.querySelectorAll('.box-content').forEach(b => b.classList.remove('active'));
  if(nodeIds) {
    nodeIds.forEach(id => {
      const n = el(id);
      if(n) n.classList.add('active-node');
    });
  }
  const phaseEl = el('mPhase');
  if(phaseEl) phaseEl.textContent = phaseName;
}

function highlightBox(boxIds) {
  document.querySelectorAll('.box-content').forEach(b => b.classList.remove('active'));
  if(boxIds) {
    boxIds.forEach(id => {
      const b = el(id);
      if(b) b.classList.add('active');
    });
  }
}

async function flyRecord(sourceId, targetId, recordData, duration) {
  const src = el(sourceId);
  const tgt = el(targetId);
  if (!src || !tgt) return;

  const r1 = src.getBoundingClientRect();
  const r2 = tgt.getBoundingClientRect();
  const flyer = createRecord(recordData, recordData.count||1);
  flyer.classList.add('flying-record', 'show');
  document.body.appendChild(flyer);

  flyer.style.left = (r1.left + r1.width/2 + window.scrollX - 15) + 'px';
  flyer.style.top = (r1.top + r1.height/2 + window.scrollY - 8) + 'px';
  
  flyer.getBoundingClientRect(); 
  flyer.style.left = (r2.left + r2.width/2 + window.scrollX - 15) + 'px';
  flyer.style.top = (r2.top + r2.height/2 + window.scrollY - 8) + 'px';
  flyer.style.transition = `top ${duration}ms ease-in-out, left ${duration}ms ease-in-out`;

  await wait(duration);
  flyer.remove();
}

/* --- ENGINE --- */

async function runSimulation() {
  if (state.running) return;
  state.running = true;
  el('startBtn').disabled = true;
  resetUI();

  const speed = parseFloat(el('speedSlider').value);
  const tick = 1000 / speed;
  const isTeaching = el('teachingMode').checked;

  // 1. INPUT
  highlightNodes(['node01', 'node02'], 'Map Phase');
  highlightBox(['boxInput0', 'boxInput1']);
  log("<strong>YARN ResourceManager:</strong> Job accepted. Allocated Containers on Node 01, Node 02.", "SYS");
  await wait(tick);

  // 2. MAP & BUFFER
  highlightNodes(['node01', 'node02'], 'Map Processing');
  highlightBox(['boxMap0', 'boxMap1']);
  log("<strong>Map Phase:</strong> Tasks started. Filling JVM Heap Buffers.", "MAP");
  
  const p1 = runMapper(0, tick, 'node01');
  const p2 = runMapper(1, tick * 1.1, 'node02'); 
  await Promise.all([p1, p2]);

  // 3. MERGE
  highlightNodes(['node01', 'node02'], 'Merge Sort');
  highlightBox(['boxMerge0', 'boxMerge1']);
  log("<strong>Merge Phase:</strong> Map tasks finished input. Merging spills...", "DISK");
  await runMerge(0, tick);
  await runMerge(1, tick);

  // 4. SHUFFLE (PARALLEL)
  highlightNodes(null, 'Network Shuffle');
  el('networkLayer').style.borderColor = "#3b82f6";
  el('netPulse').classList.add('active');
  log("<strong>Shuffle Phase:</strong> Nodes streaming partitions in parallel via HTTP.", "NET");
  
  await runNetworkShuffle(tick);
  
  el('netPulse').classList.remove('active');
  el('networkLayer').style.borderColor = "#475569";

  // 5. REDUCE
  highlightNodes(null, 'Reduce Phase');
  highlightBox(['boxReduce']);
  log("<strong>Reduce Phase:</strong> Sort/Group & Aggregation started.", "RED");
  await runReduce(tick);

  log("<strong>Job Complete.</strong> Output written to HDFS.", "SYS");
  el('mPhase').textContent = "FINISHED";
  el('startBtn').disabled = false;
  state.running = false;
  el('progressFill').style.width = "100%";
}

async function runMapper(id, delay, nodeId) {
  const mapper = state.mappers[id];
  const bufEl = el(`buf${id}`);
  const fillEl = el(`fill${id}`);
  const pctEl = el(`pct${id}`);
  const isTeaching = el('teachingMode').checked;
  
  if (!fillEl) return;

  for (let i=0; i<mapper.data.length; i++) {
    const rec = mapper.data[i];
    mapper.buffer.push(rec);
    const countEl = el('mRecords');
    if(countEl) countEl.innerText = parseInt(countEl.innerText) + 1;

    await flyRecord(`split${id}`, `buf${id}`, rec, delay * 0.4);

    const r = createRecord(rec);
    bufEl.appendChild(r);
    r.classList.add('show');

    const usage = mapper.buffer.length / CONFIG.BUFFER_CAPACITY;
    const pct = Math.min(100, Math.round(usage * 100));
    fillEl.style.height = pct + "%";
    pctEl.innerText = pct + "%";

    if (usage >= CONFIG.SPILL_THRESHOLD || i === mapper.data.length - 1) {
      fillEl.classList.add('limit');
      if(isTeaching) {
          log(`Node 0${id+1}: <strong>Buffer Full (${pct}%).</strong> Pausing input to Spill.`, "MAP");
      }
      
      const spillBox = el(`boxSpill${id}`);
      if(spillBox) spillBox.classList.add('active');
      await wait(delay); 
      if(isTeaching) log(`Node 0${id+1}: <strong>Combiner</strong> running... Writing Spill to Disk.`, "DISK");
      
      await spill(id, mapper.spills.length, delay);
      
      if(spillBox) spillBox.classList.remove('active');
      turnActiveToGhosts(bufEl);
      clearRamBuffer(bufEl);
      
      mapper.buffer = [];
      fillEl.style.height = "0%";
      fillEl.classList.remove('limit');
      pctEl.innerText = "0%";
    }
    await wait(delay * 0.2);
  }
}

async function spill(mapperId, spillIdx, delay) {
  const mapper = state.mappers[mapperId];
  const sorted = [...mapper.buffer].sort((a,b) => (a.p - b.p) || a.k.localeCompare(b.k));
  const combined = combine(sorted);
  mapper.spills.push(combined);
  const spillEl = el('mSpills');
  if(spillEl) spillEl.innerText = parseInt(spillEl.innerText) + 1;

  const slotId = `spill${mapperId==0?'A':'B'}${spillIdx}`;
  const slot = el(slotId);
  if (slot) {
    sorted.forEach(rec => {
        const r = createRecord(rec, 1);
        slot.appendChild(r);
        setTimeout(() => r.classList.add('show'), 20);
    });
    await wait(delay * 1.2);
    turnActiveToGhosts(slot);
    if(!el('teachingMode').checked) Array.from(slot.querySelectorAll('.kv-record')).forEach(r => r.remove());
    
    combined.forEach(rec => {
      const r = createRecord(rec, rec.count);
      r.style.zIndex = 100; slot.appendChild(r);
      setTimeout(() => r.classList.add('show'), 20);
    });
  }
}

async function runMerge(mapperId, tick) {
  const mapper = state.mappers[mapperId];
  const target = el(`final${mapperId==0?'A':'B'}`);
  let all = [];
  mapper.spills.forEach(s => all.push(...s));
  
  all.forEach(rec => {
    const r = createRecord(rec, rec.count);
    target.appendChild(r);
    setTimeout(()=>r.classList.add('show'), 10);
  });
  await wait(tick);
  
  turnActiveToGhosts(target);
  if(!el('teachingMode').checked) Array.from(target.querySelectorAll('.kv-record')).forEach(r => r.remove());
  
  const labelA = mapperId===0 ? 'A' : 'B';
  for(let i=0; i<mapper.spills.length; i++) {
      const s = el(`spill${labelA}${i}`);
      if(s) turnActiveToPersistent(s);
  }

  const merged = combine(all.sort((a,b) => (a.p - b.p) || a.k.localeCompare(b.k)));
  mapper.final = merged;

  merged.forEach(rec => {
    const r = createRecord(rec, rec.count);
    r.style.zIndex = 100;
    target.appendChild(r);
    setTimeout(()=>r.classList.add('show'), 10);
  });
}

async function runNetworkShuffle(tick) {
  const m0 = state.mappers[0].final;
  const m1 = state.mappers[1].final;
  const isTeaching = el('teachingMode').checked;

  const transmitNodeData = async (records, sourceId, nodeName) => {
    const localQueue = [...records].sort((a,b) => a.p - b.p);
    const nodePromises = [];
    const nicSpeed = tick / 4;
    let currentP = -1;

    for (const rec of localQueue) {
        if(isTeaching && rec.p !== currentP) {
            currentP = rec.p;
            await wait(Math.random() * 100);
            log(`${nodeName}: Streaming batch for <strong>Partition ${currentP}</strong>...`, "NET");
        }

        const packetJourney = async () => {
            await flyRecord(sourceId, 'netHub', rec, tick * 0.5);
            
            const netEl = el('mNet');
            if(netEl) netEl.innerText = parseInt(netEl.innerText) + 1;

            await wait((tick * 0.1) + Math.random() * 80); 

            const targetId = `red${rec.p}`;
            await flyRecord('netHub', targetId, rec, tick * 0.5);
            
            const targetBox = el(targetId);
            const r = createRecord(rec, rec.count);
            targetBox.appendChild(r);
            setTimeout(()=>r.classList.add('show'), 10);
        };

        nodePromises.push(packetJourney());
        await wait(nicSpeed);
    }
    await Promise.all(nodePromises);
  };

  await Promise.all([
    transmitNodeData(m0, 'finalA', 'Node 01'),
    transmitNodeData(m1, 'finalB', 'Node 02')
  ]);

  turnActiveToPersistent(el('finalA')); 
  turnActiveToPersistent(el('finalB')); 
}

async function runReduce(tick) {
  const partitions = [0,1,2];
  const reducePromises = partitions.map(async (p) => {
      const box = el(`red${p}`);
      const rawRecs = Array.from(box.querySelectorAll('.kv-record:not(.persistent)')).map(el => {
         const parts = el.textContent.split(':');
         return { k: parts[0], count: parseInt(parts[1]) }; 
      });

      turnActiveToGhosts(box);
      if(!el('teachingMode').checked) Array.from(box.querySelectorAll('.kv-record:not(.persistent)')).forEach(r => r.remove());
      await wait(tick);

      const map = new Map();
      rawRecs.forEach(x => {
          const prev = map.get(x.k) || 0;
          map.set(x.k, prev + x.count);
      });
      
      Array.from(map.entries()).forEach(([k, v]) => {
         const colors = {'0':'bg-p0','1':'bg-p1','2':'bg-p2'};
         const r = createRecord({k, c: colors[p]}, v);
         r.style.border = "2px solid #1e293b";
         r.style.zIndex = 100; r.style.transform = "scale(1.1)";
         box.appendChild(r);
         setTimeout(()=>r.classList.add('show'), 10);
      });
  });
  await Promise.all(reducePromises);
}

function combine(list) {
  const m = new Map();
  list.forEach(x => {
    if(!m.has(x.k)) m.set(x.k, { ...x, count: 0 });
    m.get(x.k).count += (x.count || 1);
  });
  return Array.from(m.values());
}

function resetUI() {
  state.mappers = [
      { id: 0, buffer: [], spills: [], final: [], data: [...RAW_DATA_A] },
      { id: 1, buffer: [], spills: [], final: [], data: [...RAW_DATA_B] }
  ];
  
  el('consoleLog').innerHTML = '<div class="log-entry log-sys">> Cluster Daemon Started. Waiting for job...</div>';
  ['mRecords','mSpills','mNet'].forEach(id => el(id).innerText = '0');
  el('progressFill').style.width = '0%';
  el('networkLayer').style.borderColor = "#475569";
  el('netPulse').classList.remove('active');
  
  if(el('pct0')) { el('pct0').innerText='0%'; el('fill0').style.height='0%'; }
  if(el('pct1')) { el('pct1').innerText='0%'; el('fill1').style.height='0%'; }

  ['buf0', 'buf1'].forEach(id => {
    const c = el(id);
    if(c) Array.from(c.querySelectorAll('.kv-record')).forEach(r => r.remove());
  });

  const destructiveContainers = [
    el('spillA0'), el('spillA1'), el('spillB0'), el('spillB1'),
    el('finalA'), el('finalB'), el('red0'), el('red1'), el('red2')
  ];
  destructiveContainers.forEach(c => { if(c) c.innerHTML = ''; });
  
  el('spillA0').innerHTML = '<div class="mini-label">Spill 0</div>';
  el('spillA1').innerHTML = '<div class="mini-label">Spill 1</div>';
  el('spillB0').innerHTML = '<div class="mini-label">Spill 0</div>';
  el('spillB1').innerHTML = '<div class="mini-label">Spill 1</div>';
  el('finalA').innerHTML = '<div class="mini-label" style="color:#f97316">part-m-00000</div>';
  el('finalB').innerHTML = '<div class="mini-label" style="color:#f97316">part-m-00001</div>';
  el('red0').innerHTML = '<div class="mini-label" style="color:#8b5cf6; font-size:9px; top:2px;">R-0 (Part 0)</div>';
  el('red1').innerHTML = '<div class="mini-label" style="color:#ec4899; font-size:9px; top:2px;">R-1 (Part 1)</div>';
  el('red2').innerHTML = '<div class="mini-label" style="color:#f59e0b; font-size:9px; top:2px;">R-2 (Part 2)</div>';

  highlightNodes(null, 'IDLE');
}

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = el('startBtn');
  const resetBtn = el('resetBtn');
  if(startBtn && resetBtn) {
    startBtn.addEventListener('click', runSimulation);
    resetBtn.addEventListener('click', () => { 
      state.running=false; 
      resetUI(); 
      el('startBtn').disabled=false; 
    });
  }
});
