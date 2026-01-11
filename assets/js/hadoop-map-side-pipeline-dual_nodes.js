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
  ],
  reducers: {0: [], 1: [], 2: []}
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
  if (container) {
    Array.from(container.querySelectorAll('.kv-record:not(.ghost):not(.persistent)')).forEach(r => {
      r.classList.add('ghost'); r.classList.remove('show');
    });
  }
}

function turnActiveToPersistent(container) {
  if (container) {
     Array.from(container.querySelectorAll('.kv-record:not(.ghost):not(.persistent)')).forEach(r => {
       r.classList.add('persistent'); r.classList.remove('show');
     });
  }
}

function clearRamBuffer(container) {
  // RAM buffers are truly transient, so we clear them always when flushed to disk
  if (container) {
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
  if(!state.running) return;
  highlightNodes(['node01', 'node02'], 'Map Phase');
  highlightBox(['boxInput0', 'boxInput1']);
  log("<strong>YARN ResourceManager:</strong> Job accepted. Allocated Containers on Node 01, Node 02.", "SYS");
  await wait(tick);
  if(!state.running) return;

  // 2. MAP & BUFFER
  highlightNodes(['node01', 'node02'], 'Map Processing');
  highlightBox(['boxMap0', 'boxMap1']);
  log("<strong>Map Phase:</strong> Tasks started. Filling JVM Heap Buffers.", "MAP");
  
  const p1 = runMapper(0, tick, 'node01');
  const p2 = runMapper(1, tick * 1.1, 'node02'); 
  await Promise.all([p1, p2]);
  if(!state.running) return;

  // 3. MERGE
  highlightNodes(['node01', 'node02'], 'Merge Sort');
  highlightBox(['boxMerge0', 'boxMerge1']);
  log("<strong>Merge Phase:</strong> Map tasks finished input. Merging spills...", "DISK");
  await runMerge(0, tick);
  await runMerge(1, tick);
  if(!state.running) return;

  // 4. SHUFFLE (PARALLEL)
  highlightNodes(null, 'Network Shuffle');
  el('networkLayer').style.borderColor = "#3b82f6";
  el('netPulse').classList.add('active');
  log("<strong>Shuffle Phase:</strong> Nodes streaming partitions in parallel via HTTP.", "NET");
  
  await runNetworkShuffle(tick);
  if(!state.running) return;
  
  el('netPulse').classList.remove('active');
  el('networkLayer').style.borderColor = "#475569";

  // 5. REDUCE
  highlightNodes(null, 'Reduce Phase');
  highlightBox(['boxReduce']);
  log("<strong>Reduce Phase:</strong> Sort/Group & Aggregation started.", "RED");
  await runReduce(tick);
  if(!state.running) return;

  log("<strong>Job Complete.</strong> Output written to HDFS.", "SYS");
  el('mPhase').textContent = "FINISHED";
  el('startBtn').disabled = false;
  state.running = false;
  el('progressFill').style.width = "100%";
}

async function runMapper(id, delay, nodeId) {
  if(!state.running) return;
  const mapper = state.mappers[id];
  const bufEl = el(`buf${id}`);
  const fillEl = el(`fill${id}`);
  const pctEl = el(`pct${id}`);
  const isTeaching = el('teachingMode').checked;
  
  if (!fillEl) return;

  for (let i=0; i<mapper.data.length; i++) {
    if(!state.running) return;
    const rec = mapper.data[i];
    mapper.buffer.push(rec);
    const countEl = el('mRecords');
    if(countEl) countEl.innerText = parseInt(countEl.innerText) + 1;

    // Visual effect: Fly COPY from persistent source to RAM
    // The source record stays in HDFS box (non-destructive read)
    await flyRecord(`src-${id}-${i}`, `buf${id}`, rec, delay * 0.4);
    
    if(!state.running) return;

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
      if(!state.running) return;

      if(isTeaching) log(`Node 0${id+1}: <strong>Combiner</strong> running... Writing Spill to Disk.`, "DISK");
      
      await spill(id, mapper.spills.length, delay);
      if(!state.running) return;
      
      if(spillBox) spillBox.classList.remove('active');
      turnActiveToGhosts(bufEl);
      // clearRamBuffer(bufEl); // Removed to keep ghosts in Mapper box
      
      mapper.buffer = [];
      fillEl.style.height = "0%";
      fillEl.classList.remove('limit');
      pctEl.innerText = "0%";
    }
    await wait(delay * 0.2);
  }
}

async function spill(mapperId, spillIdx, delay) {
  if(!state.running) return;
  const mapper = state.mappers[mapperId];
  const bufId = `buf${mapperId}`; // Source buffer ID
  const slotId = `spill${mapperId==0?'A':'B'}${spillIdx}`; // Target slot ID
  
  // Animation: Fly records SEQUENTIALLY from Buffer to Spill Slot
  for (const rec of mapper.buffer) {
      if(!state.running) return;
      // Fly and wait a bit for stream effect
      flyRecord(bufId, slotId, rec, delay * 0.5); 
      await wait(delay * 0.15); // Stagger the launches
  }
  
  // Wait for all flights to land roughly
  await wait(delay * 0.5);
  
  if(!state.running) return;

  const sorted = [...mapper.buffer].sort((a,b) => (a.p - b.p) || a.k.localeCompare(b.k));
  const combined = combine(sorted);
  mapper.spills.push(combined);
  const spillEl = el('mSpills');
  if(spillEl) spillEl.innerText = parseInt(spillEl.innerText) + 1;

  // slotId is already defined above
  const slot = el(slotId);
  if (slot) {
    sorted.forEach(rec => {
        const r = createRecord(rec, 1);
        slot.appendChild(r);
        setTimeout(() => r.classList.add('show'), 20);
    });
    await wait(delay * 1.2);
    if(!state.running) return;

    turnActiveToGhosts(slot);
    // Explicit removal removed to support CSS-only toggling
    
    combined.forEach(rec => {
      const r = createRecord(rec, rec.count);
      r.style.zIndex = 100; slot.appendChild(r);
      setTimeout(() => r.classList.add('show'), 20);
    });
  }
}

async function runMerge(mapperId, tick) {
  if(!state.running) return;
  const mapper = state.mappers[mapperId];
  const targetId = `final${mapperId==0?'A':'B'}`;
  const target = el(targetId);
  const labelA = mapperId===0 ? 'A' : 'B';
  
  let all = [];
  
  // Animation: Fly from all spills to target
  const mergeFlights = [];
  
  mapper.spills.forEach((spillData, spillIdx) => {
      const sourceId = `spill${labelA}${spillIdx}`;
      spillData.forEach(rec => {
          all.push(rec);
          // Fly with slight stagger for effect
          const p = async () => {
              await wait(Math.random() * tick * 0.5);
              await flyRecord(sourceId, targetId, rec, tick * 0.6);
          };
          mergeFlights.push(p());
      });
  });
  
  await Promise.all(mergeFlights);
  if(!state.running) return;
  
  // Show merged result (transient step before final sort/combine)
  all.forEach(rec => {
    const r = createRecord(rec, rec.count);
    target.appendChild(r);
    setTimeout(()=>r.classList.add('show'), 10);
  });
  await wait(tick);
  if(!state.running) return;
  
  turnActiveToGhosts(target);
  // Explicit removal removed to support CSS-only toggling
  
  // labelA is already defined at the top
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
  if(!state.running) return;
  const m0 = state.mappers[0].final;
  const m1 = state.mappers[1].final;
  const isTeaching = el('teachingMode').checked;

  const transmitNodeData = async (records, sourceId, nodeName) => {
    const localQueue = [...records].sort((a,b) => a.p - b.p);
    const nodePromises = [];
    const nicSpeed = tick / 4;
    let currentP = -1;

    for (const rec of localQueue) {
        if(!state.running) break;
        if(isTeaching && rec.p !== currentP) {
            currentP = rec.p;
            await wait(Math.random() * 100);
            log(`${nodeName}: Streaming batch for <strong>Partition ${currentP}</strong>...`, "NET");
        }

        const packetJourney = async () => {
            if(!state.running) return;
            await flyRecord(sourceId, 'netHub', rec, tick * 0.5);
            
            const netEl = el('mNet');
            if(netEl) netEl.innerText = parseInt(netEl.innerText) + 1;

            await wait((tick * 0.1) + Math.random() * 80); 
            if(!state.running) return;

            const targetId = `red${rec.p}`;
            // Update state
            if(state.reducers[rec.p]) state.reducers[rec.p].push(rec);

            await flyRecord('netHub', targetId, rec, tick * 0.5);
            
            const targetBox = el(targetId);
            const r = createRecord(rec, rec.count);
            targetBox.appendChild(r);
            setTimeout(()=>r.classList.add('show'), 10);
        };

        // We don't await the packet journey fully here to allow pipelining,
        // but we push it to promises list
        nodePromises.push(packetJourney());
        await wait(nicSpeed);
    }
    await Promise.all(nodePromises);
  };

  await Promise.all([
    transmitNodeData(m0, 'finalA', 'Node 01'),
    transmitNodeData(m1, 'finalB', 'Node 02')
  ]);
  
  if(!state.running) return;

  turnActiveToPersistent(el('finalA')); 
  turnActiveToPersistent(el('finalB')); 
}

async function runReduce(tick) {
  if(!state.running) return;
  const partitions = [0,1,2];
  const reducePromises = partitions.map(async (p) => {
      if(!state.running) return;
      const box = el(`red${p}`);
      
      // Use state instead of DOM parsing
      const rawRecs = state.reducers[p] || [];

      turnActiveToGhosts(box);
      // Explicit removal removed to support CSS-only toggling
      await wait(tick);
      if(!state.running) return;

      const map = new Map();
      rawRecs.forEach(x => {
          const prev = map.get(x.k) || 0;
          map.set(x.k, prev + (x.count || 1));
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
  state.reducers = {0: [], 1: [], 2: []};
  
  el('consoleLog').innerHTML = '<div class="log-entry log-sys">> Cluster Daemon Started. Waiting for job...</div>';
  ['mRecords','mSpills','mNet'].forEach(id => el(id).innerText = '0');
  el('progressFill').style.width = '0%';
  el('networkLayer').style.borderColor = "#475569";
  el('netPulse').classList.remove('active');
  
  if(el('pct0')) { el('pct0').innerText='0%'; el('fill0').style.height='0%'; }
  if(el('pct1')) { el('pct1').innerText='0%'; el('fill1').style.height='0%'; }

  // Populate Inputs with Persistent HDFS Records
  const input0 = el('boxInput0');
  const input1 = el('boxInput1');
  
  if(input0) {
    input0.innerHTML = ''; // Clear generic label
    // Create flex container for records
    const div = document.createElement('div');
    div.style.display = 'flex'; div.style.flexWrap = 'wrap'; div.style.justifyContent = 'center';
    input0.appendChild(div);
    
    state.mappers[0].data.forEach((rec, i) => {
        // HDFS Input: Show only the word (Key), no count
        const r = document.createElement('div');
        r.className = `kv-record ${rec.c} show persistent`;
        r.id = `src-0-${i}`;
        r.textContent = rec.k; // Just the word
        div.appendChild(r);
    });
  }

  if(input1) {
    input1.innerHTML = '';
    const div = document.createElement('div');
    div.style.display = 'flex'; div.style.flexWrap = 'wrap'; div.style.justifyContent = 'center';
    input1.appendChild(div);
    
    state.mappers[1].data.forEach((rec, i) => {
        const r = document.createElement('div');
        r.className = `kv-record ${rec.c} show persistent`;
        r.id = `src-1-${i}`;
        r.textContent = rec.k; // Just the word
        div.appendChild(r);
    });
  }

  const containers = [
    'buf0', 'buf1',
    'spillA0', 'spillA1', 'spillB0', 'spillB1',
    'finalA', 'finalB', 
    'red0', 'red1', 'red2'
  ];

  containers.forEach(id => {
    const c = el(id);
    if(c) {
       Array.from(c.querySelectorAll('.kv-record')).forEach(r => r.remove());
    }
  });
  
  // Clear any flying records
  document.querySelectorAll('.flying-record').forEach(r => r.remove());

  // Reset fills
  if(el('fill0')) el('fill0').classList.remove('limit');
  if(el('fill1')) el('fill1').classList.remove('limit');

  highlightNodes(null, 'IDLE');
}

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = el('startBtn');
  const resetBtn = el('resetBtn');
  const teachingCheck = el('teachingMode');
  const appContainer = document.querySelector('.app');

  // Init Teaching Mode State
  if(teachingCheck && appContainer) {
    if(teachingCheck.checked) appContainer.classList.add('teaching-mode-active');
    
    teachingCheck.addEventListener('change', (e) => {
      if(e.target.checked) appContainer.classList.add('teaching-mode-active');
      else appContainer.classList.remove('teaching-mode-active');
    });
  }

  if(startBtn && resetBtn) {
    startBtn.addEventListener('click', runSimulation);
    resetBtn.addEventListener('click', () => { 
      state.running=false; 
      resetUI(); 
      el('startBtn').disabled=false; 
    });
  }
  
  initHeightSync();
});

/* --- LAYOUT SYNC --- */
function initHeightSync() {
  const groups = [
    // Main Rows
    ['boxInput0', 'boxInput1'],
    ['boxMap0', 'boxMap1'],
    ['boxSpill0', 'boxSpill1'],
    ['boxMerge0', 'boxMerge1'],
    // Internal Cards
    ['spillA0', 'spillB0'],
    ['spillA1', 'spillB1'],
    ['finalA', 'finalB'],
    // Reducers (Sync all 3 together)
    ['red0', 'red1', 'red2']
  ];

  let isAdjusting = false;

  const ro = new ResizeObserver(() => {
    if (isAdjusting) return;
    
    window.requestAnimationFrame(() => {
      isAdjusting = true;
      
      groups.forEach(ids => {
        const elements = ids.map(id => el(id)).filter(e => e !== null);
        if (elements.length < 2) return;

        // 1. Reset
        elements.forEach(e => e.style.minHeight = '');

        // 2. Measure natural heights
        const heights = elements.map(e => e.scrollHeight);
        
        // 3. Find max
        const maxH = Math.max(...heights);

        // 4. Apply
        elements.forEach(e => e.style.minHeight = `${maxH}px`);
      });

      isAdjusting = false;
    });
  });

  // Start observing all synced elements
  groups.flat().forEach(id => {
    const e = el(id);
    if(e) ro.observe(e);
  });
}
