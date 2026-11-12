/* Shared classroom shell. All simulations retain their original engines. */
(() => {
  const paths = {
    server:
      '<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6"/>',
    database:
      '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3m6-3v3m-6 14v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
    flow: '<rect x="2" y="9" width="5" height="6" rx="1"/><rect x="17" y="2" width="5" height="6" rx="1"/><rect x="17" y="16" width="5" height="6" rx="1"/><path d="M7 12h5m0 0V5h5m-5 7v7h5"/>',
    network:
      '<rect x="2" y="3" width="6" height="5" rx="1"/><rect x="16" y="3" width="6" height="5" rx="1"/><rect x="9" y="17" width="6" height="5" rx="1"/><path d="M5 8v4h14V8m-7 4v5"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7Zm-10 10 10 5 10-5M2 17l10 5 10-5"/>',
    play: '<path d="m8 4 12 8-12 8Z"/>',
    monitor:
      '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    focus:
      '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
    arrow: '<path d="M3 12h18m-7-7 7 7-7 7"/>'
  };
  const icon = (name) =>
    `<svg class="engineering-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.server}</svg>`;
  const phases = {
    input: [
      'Input splits',
      'HDFS provides input splits. Each split is assigned to a mapper; the records retain their partition colour.',
      'database'
    ],
    map: [
      'Map buffer',
      'Each mapper emits key–value pairs into a bounded JVM memory buffer. The amber outline marks the component executing now.',
      'cpu'
    ],
    spill: [
      'Sorted spill files',
      'At the buffer threshold or the end of a split, records are sorted by partition and key and written to local disk.',
      'database'
    ],
    combine: [
      'Local combiner',
      'For word count, the combiner adds repeated values locally. Less intermediate data needs to cross the network.',
      'cpu'
    ],
    merge: [
      'Mapper merge',
      'Sorted spill files are merged into a partitioned map output. This is local disk I/O, before the network shuffle.',
      'layers'
    ],
    shuffle: [
      'Network shuffle',
      'Each reducer fetches its partition from both mappers. Records with the same key travel to the same reducer.',
      'network'
    ],
    reduce: [
      'Reduce & merge',
      'Reducer segments are merge-sorted by key. The reduce function then aggregates the values for each key.',
      'cpu'
    ],
    output: [
      'HDFS output',
      'Each reducer writes one part-r file. Together the files contain the final word counts.',
      'database'
    ]
  };
  const typePhase = {
    INPUT_INIT: 'input',
    MAP_BATCH: 'map',
    SPILL_SORT: 'spill',
    COMBINE: 'combine',
    MERGE: 'merge',
    SHUFFLE: 'shuffle',
    REDUCE_MERGE: 'reduce',
    REDUCE: 'reduce',
    OUTPUT: 'output',
    FINISH: 'output'
  };
  function init() {
    const root = document.documentElement;
    const page = root.dataset.page;
    document.querySelectorAll('[data-icon]').forEach((e) => {
      e.innerHTML = icon(e.dataset.icon);
    });
    const nav = document.querySelector('.site-nav');
    if (nav) {
      nav.innerHTML = `<a class="brand" href="./index.html">${icon('layers')}<strong>Hadoop<span>Sim</span></strong><span class="brand-divider"></span><span class="brand-context">Lecture lab</span></a><div class="nav-tools"><label class="sr-only" for="module-nav">Simulator</label><select id="module-nav"><option value="index.html">All walkthroughs</option><option value="hadoopsim-teaching.html">MapReduce · Teaching</option><option value="hdfs_interactive.html">HDFS · Replication</option><option value="yarn_interactive.html">YARN · Scheduling</option><option value="hadoop-map-side-pipeline-dual_nodes.html">Animated pipeline</option><option value="hadoop_full.html">Cluster lab</option></select><div class="format-switch" role="group" aria-label="Projection format"><button data-format="wide" aria-pressed="true" title="Widescreen layout">16:9</button><button data-format="standard" aria-pressed="false" title="Narrower layout for a 4:3 projector">4:3</button></div><button class="fullscreen-button" title="Toggle fullscreen" aria-label="Toggle fullscreen">${icon('monitor')}</button></div>`;
      const moduleNav = nav.querySelector('select');
      const route = location.pathname.split('/').pop();
      moduleNav.value = route
        ? route.endsWith('.html')
          ? route
          : route + '.html'
        : 'index.html';
      moduleNav.addEventListener('change', () => {
        location.href = './' + moduleNav.value;
      });
      nav.querySelectorAll('[data-format]').forEach((button) =>
        button.addEventListener('click', () => {
          root.dataset.format = button.dataset.format;
          nav
            .querySelectorAll('[data-format]')
            .forEach((b) =>
              b.setAttribute('aria-pressed', String(b === button))
            );
          try {
            sessionStorage.setItem('lecture.format', button.dataset.format);
          } catch {
            /* Optional preference. */
          }
          window.dispatchEvent(new Event('resize'));
        })
      );
      try {
        if (sessionStorage.getItem('lecture.format') === 'standard')
          nav.querySelector('[data-format="standard"]').click();
      } catch {
        /* Optional preference. */
      }
      nav
        .querySelector('.fullscreen-button')
        .addEventListener('click', async () => {
          try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await root.requestFullscreen();
          } catch {
            /* Browser may decline fullscreen. */
          }
        });
    }
    // Replace decorative emoji in static headings with a consistent local icon.
    document.querySelectorAll('.node-tag > span:first-child').forEach((e) => {
      if (/\p{Extended_Pictographic}/u.test(e.textContent))
        e.innerHTML = icon('server');
    });
    if (page === 'teaching') initTeaching();
    else if (page !== 'home') initClusterSelection();
  }
  function initTeaching() {
    const root = document.documentElement;
    const pipeline = document.querySelector('.pipeline-col');
    let activePhase = 'input';
    let selected = null;
    root.dataset.lessonView = 'phase';
    root.dataset.lessonPhase = activePhase;
    const overview = document.createElement('div');
    overview.className = 'lesson-overview';
    overview.innerHTML = `<div class="lesson-meta"><span class="eyebrow">MAPREDUCE / WORD COUNT</span><span>2 mappers <span aria-hidden="true">·</span> 3 reducers</span></div><div class="phase-strip" role="group" aria-label="Inspect a MapReduce phase">${Object.entries(
      phases
    )
      .map(
        ([key, p], i) =>
          `<button data-phase="${key}" aria-pressed="false"><span class="phase-number">0${i + 1}</span>${icon(p[2])}<span>${key === 'reduce' ? 'Reduce' : key[0].toUpperCase() + key.slice(1)}</span></button>`
      )
      .join(
        ''
      )}</div><div class="canvas-toolbar"><span class="canvas-label"><span class="activity-dot"></span><strong id="canvas-phase-title">Input splits</strong><span id="canvas-status">Ready to begin</span></span><label for="lesson-view">Canvas</label><select id="lesson-view"><option value="phase">Current phase</option><option value="full">Full pipeline</option></select></div>`;
    document.querySelector('.layout').before(overview);
    const inspector = document.createElement('div');
    inspector.className = 'inspector-panel';
    inspector.hidden = true;
    inspector.setAttribute('role', 'status');
    inspector.innerHTML = `<div class="inspector-eyebrow">${icon('focus')} Focus held · Animation paused</div><h3 id="inspect-title"></h3><p id="inspect-description"></p><button id="continueBtn">Continue <span aria-hidden="true">→</span></button>`;
    const rail = document.querySelector('.phase-callout-wrapper');
    const footer = document.createElement('div');
    footer.className = 'lesson-footer';
    footer.append(document.querySelector('.step-console'));
    document.querySelector('.layout').after(footer);
    rail.prepend(inspector);
    const guide = document.createElement('p');
    guide.className = 'lecture-hint';
    guide.innerHTML = `${icon('focus')} Select a component to pause and inspect. <kbd>Esc</kbd> returns to execution.`;
    pipeline.after(guide);
    function setPhase(phase) {
      root.dataset.lessonPhase = phase;
      document.getElementById('canvas-phase-title').textContent =
        phases[phase][0];
      overview.querySelectorAll('[data-phase]').forEach((b) => {
        b.classList.toggle('phase-current', b.dataset.phase === activePhase);
      });
    }
    function release() {
      selected?.classList.remove('lecture-selected');
      selected?.setAttribute('aria-pressed', 'false');
      selected = null;
      root.classList.remove('lecture-held');
      inspector.hidden = true;
      overview
        .querySelectorAll('[data-phase]')
        .forEach((b) => b.setAttribute('aria-pressed', 'false'));
      document.dispatchEvent(
        new CustomEvent('lecture-pause', { detail: false })
      );
      const busy = window.teachingSimulation?.isBusy();
      const info = window.teachingSimulation?.getCurrentStepInfo();
      const complete = info?.total > 0 && info.isComplete;
      document.getElementById('stepBtn').disabled =
        busy ||
        complete ||
        document.getElementById('playStepBtn').textContent === 'Pause';
      document.getElementById('playStepBtn').disabled = busy || complete;
      setPhase(activePhase);
      document.getElementById('canvas-status').textContent = complete
        ? 'Execution complete'
        : 'Following execution';
    }
    function inspect(element, phase, label) {
      selected?.classList.remove('lecture-selected');
      selected?.setAttribute('aria-pressed', 'false');
      selected = element;
      selected?.classList.add('lecture-selected');
      selected?.setAttribute('aria-pressed', 'true');
      root.classList.add('lecture-held');
      document.dispatchEvent(
        new CustomEvent('lecture-pause', { detail: true })
      );
      setPhase(phase);
      inspector.hidden = false;
      document.getElementById('inspect-title').textContent =
        label || phases[phase][0];
      document.getElementById('inspect-description').textContent =
        phases[phase][1];
      document.getElementById('canvas-status').textContent = 'Focus held';
      document.getElementById('stepBtn').disabled = true;
      document.getElementById('playStepBtn').disabled = true;
    }
    overview.querySelectorAll('[data-phase]').forEach((button) =>
      button.addEventListener('click', () => {
        if (button === selected) release();
        else inspect(button, button.dataset.phase);
      })
    );
    const rows = pipeline.querySelectorAll('.node-row, .network-layer');
    rows.forEach((row) => {
      const content = row.querySelector('.box-content');
      let phase =
        row.classList.contains('network-layer') ||
        row.querySelector('.final-output')
          ? 'shuffle'
          : row.classList.contains('mapper-merge-row')
            ? 'merge'
            : content?.classList.contains('box-hdfs')
              ? row.closest('.node-output')
                ? 'output'
                : 'input'
              : content?.classList.contains('box-ram')
                ? 'map'
                : content?.classList.contains('box-disk')
                  ? 'spill'
                  : content?.classList.contains('box-combine')
                    ? 'combine'
                    : row.classList.contains('mapper-merge-row')
                      ? 'merge'
                      : 'reduce';
      row.dataset.componentPhase = phase;
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      const node =
        row
          .closest('.node-container')
          ?.querySelector('.node-tag')
          ?.textContent.trim() || '';
      const label = `${phases[phase][0]}${node ? ' · ' + node : ''}`;
      row.setAttribute('aria-label', 'Inspect ' + label);
      row.setAttribute('aria-pressed', 'false');
      row.addEventListener('click', () => {
        if (selected === row) release();
        else inspect(row, phase, label);
      });
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          row.click();
        }
      });
    });
    document.getElementById('continueBtn').addEventListener('click', release);
    document.getElementById('resetStepBtn').addEventListener('click', () => {
      activePhase = 'input';
      release();
      document.getElementById('canvas-status').textContent = 'Ready to begin';
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && selected) {
        release();
        document.getElementById('stepBtn').focus();
      }
    });
    document.getElementById('lesson-view').addEventListener('change', (e) => {
      root.dataset.lessonView = e.target.value;
      window.dispatchEvent(new Event('resize'));
    });
    document.addEventListener('lecture-step', ({ detail }) => {
      activePhase = typePhase[detail] || 'input';
      document.getElementById('stepPhase').textContent = detail.replaceAll(
        '_',
        ' '
      );
      if (!selected) setPhase(activePhase);
      document.getElementById('canvas-status').textContent =
        detail === 'FINISH'
          ? 'Execution complete'
          : 'Executing · ' + phases[activePhase][0];
    });
    setPhase('input');
  }
  function initClusterSelection() {
    const selector = '.datanode,.node,.node-card,.node-container';
    const controls = document.querySelector('.sidebar .control-panel');
    if (controls) controls.parentElement.prepend(controls);

    const nodeLabel = (node) =>
      node
        .querySelector('.node-name,.node-title,h3,.node-tag')
        ?.textContent.trim() ||
      node.id ||
      'Cluster component';
    const note = document.createElement('div');
    note.className = 'cluster-selection-note';
    note.setAttribute('role', 'status');
    note.setAttribute('aria-live', 'polite');
    note.innerHTML = `${icon('focus')}<span>Select a node to highlight it during discussion.</span><button hidden>Clear selection</button>`;
    document.querySelector('.site-nav')?.after(note);
    let selectedLabel = '';
    const button = note.querySelector('button');
    function refreshNodes() {
      document.querySelectorAll(selector).forEach((node) => {
        const label = nodeLabel(node);
        node.tabIndex = 0;
        node.setAttribute('role', 'group');
        node.setAttribute('aria-label', label + '. Press Enter to highlight.');
        node.classList.toggle('lecture-selected', selectedLabel === label);
      });
      document.querySelectorAll('.panel-icon').forEach((e) => {
        if (!e.querySelector('svg')) e.innerHTML = icon('server');
      });
    }
    function clear() {
      selectedLabel = '';
      refreshNodes();
      note.querySelector('span').textContent =
        'Select a node to highlight it during discussion.';
      button.hidden = true;
    }
    function select(node) {
      const label = nodeLabel(node);
      if (selectedLabel === label) {
        clear();
        return;
      }
      selectedLabel = label;
      refreshNodes();
      note.querySelector('span').textContent = 'Selected: ' + selectedLabel;
      button.hidden = false;
    }
    button.addEventListener('click', clear);
    document.addEventListener('click', (e) => {
      if (e.target.closest('button,a,input,select')) {
        if (e.target.closest('button')?.textContent.includes('Reset')) clear();
        return;
      }
      const node = e.target.closest(selector);
      if (node) select(node);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') clear();
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches(selector)) {
        e.preventDefault();
        select(e.target);
      }
    });
    refreshNodes();
    new MutationObserver(refreshNodes).observe(document.body, {
      childList: true,
      subtree: true
    });
    const title = document.querySelector('.header h1');
    if (title)
      title.insertAdjacentHTML(
        'afterbegin',
        icon(
          document.documentElement.dataset.page === 'hdfs'
            ? 'database'
            : 'server'
        ) + ' '
      );
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else init();
})();
