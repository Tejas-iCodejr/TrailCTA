/* Live project preview: shows the kind of project the child builds in the free class,
   personalised with their name, age and interest. Each scene "runs" its code in a loop,
   highlighting the block or line that is executing. */

window.Preview = (() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STALE = Symbol('stale');
  const $ = (sel, root = document) => root.querySelector(sel);

  const els = {
    preview: $('#preview'),
    body: $('#pv-body'),
    code: $('#pv-code'),
    stage: $('#pv-stage'),
    file: $('#pv-file'),
    title: $('#pv-title'),
    meta: $('#pv-meta'),
    slot: $('#pv-slot'),
    caption: $('#pv-caption'),
  };

  const state = { name: '', age: '', interest: '', slot: '' };
  let sceneKey = null;
  let gen = 0;
  let visible = true;
  let restartTimer = null;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const poss = n => (/s$/i.test(n) ? `${n}'` : `${n}'s`);
  const young = () => !['11-13', '14-18'].includes(state.age);
  const shownName = () => state.name || 'Your name';

  function sleep(ms, g) {
    return new Promise((resolve, reject) => setTimeout(() => (g === gen ? resolve() : reject(STALE)), ms));
  }

  function nameSpan(possessive = false) {
    const text = state.name ? (possessive ? poss(state.name) : state.name) : (possessive ? "Your name's" : 'Your name');
    return `<span class="nm-x${state.name ? '' : ' blank'}" data-poss="${possessive ? 1 : 0}">${esc(text)}</span>`;
  }

  function refreshNames() {
    els.preview.querySelectorAll('.nm-x').forEach(el => {
      const p = el.dataset.poss === '1';
      el.textContent = state.name ? (p ? poss(state.name) : state.name) : (p ? "Your name's" : 'Your name');
      el.classList.toggle('blank', !state.name);
    });
  }

  /* ---------- Code renderers ---------- */

  const ICON = {
    flag: '<svg viewBox="0 0 24 24"><path d="M5 22V3M5 4h12l-2.5 4L17 12H5" fill="#2fbf4a" stroke="#1d7a30" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 20V5M6 10l6-6 6 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    talk: '<svg viewBox="0 0 24 24"><path d="M4 5h16v10H10l-5 4v-4H4z" fill="#fff"/></svg>',
    cw: '↻',
    ccw: '↺',
  };

  const block = (cls, i, inner) => `<div class="b ${cls}" data-i="${i}">${inner}</div>`;
  const val = v => `<span class="val">${v}</span>`;
  const pill = v => `<span class="pill">${v}</span>`;
  const whenFlag = i => block('ev hat', i, `when ${ICON.flag} clicked`);

  function textCode(lines) {
    return `<div class="tx">${lines.map((tokens, n) => `<div class="ln"><span class="no">${n + 1}</span><span class="cd">${renderTokens(tokens)}</span></div>`).join('')}</div>`;
  }

  function renderTokens(tokens, limit = Infinity) {
    let left = limit;
    let html = '';
    for (const [cls, text] of tokens) {
      if (left <= 0) break;
      const part = text.slice(0, left);
      left -= part.length;
      html += cls ? `<span class="${cls}">${esc(part)}</span>` : esc(part);
    }
    return html || '&#8203;';
  }

  const tokenLength = tokens => tokens.reduce((n, [, t]) => n + t.length, 0);

  /* ---------- Scenes ---------- */

  const SKYLINE = `<svg class="skyline" viewBox="0 0 300 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <g fill="#a8d4f5">
      <rect x="14" y="52" width="18" height="38" rx="2"/><rect x="36" y="62" width="14" height="28" rx="2"/>
      <path d="M58 90V44l12-8 12 8v46z"/><rect x="92" y="58" width="16" height="32" rx="2"/>
      <path d="M126 90c0-34 10-52 30-60v60z"/><rect x="164" y="54" width="20" height="36" rx="2"/>
      <path d="M200 90V58h4V42h4V26h3l1-22h2l1 22h3v16h4v16h4v32z"/>
      <rect x="240" y="50" width="20" height="40" rx="2"/><rect x="264" y="64" width="16" height="26" rx="2"/>
    </g>
  </svg>`;

  const scenes = {
    story: {
      file: slug => `${slug}robot_story.sjr`,
      meta: () => 'ScratchJr · ages 5–6',
      code: () => {
        const items = [['ev', ICON.flag, 'start'], ['mo', ICON.right, 'move 2'], ['mo', ICON.right, 'move 2'], ['mo', ICON.up, 'jump'], ['lo', ICON.talk, 'say hi']];
        return `<div class="sj-row">${items.map(([c, icon, label], i) => `<div class="sj sj-${c}" data-i="${i}"><span class="sj-face">${icon}</span><small>${label}</small></div>`).join('')}</div>`;
      },
      stage: () => `<div class="stg stg-story">${SKYLINE}<span class="sun"></span><span class="cloud c1"></span><span class="cloud c2"></span><div class="ground"></div>
        <div class="actor" style="--x:6%"><div class="say">Hi! I'm ${nameSpan()}!</div><svg class="bot"><use href="#bot"/></svg></div></div>`,
      async run(g, mark) {
        const actor = $('.actor', els.stage);
        const moveTo = x => actor.style.setProperty('--x', x);
        for (;;) {
          actor.classList.add('snap');
          moveTo('6%');
          actor.classList.remove('hop', 'talk');
          void actor.offsetWidth;
          actor.classList.remove('snap');
          mark(-1); await sleep(700, g);
          mark(0); await sleep(600, g);
          mark(1); moveTo('30%'); await sleep(900, g);
          mark(2); moveTo('54%'); await sleep(900, g);
          mark(3); actor.classList.add('hop'); await sleep(900, g); actor.classList.remove('hop');
          mark(4); actor.classList.add('talk'); await sleep(2800, g);
          mark(-1); await sleep(500, g);
        }
      },
      still(mark) {
        $('.actor', els.stage).style.setProperty('--x', '54%');
        $('.actor', els.stage).classList.add('talk');
        mark(4);
      },
    },

    game: {
      file: slug => `${slug}star_catcher.sb3`,
      meta: () => 'Scratch · ages 7–10',
      code: () => `<div class="sc">
        ${whenFlag(0)}
        ${block('va', 1, `set ${pill('score')} to ${val('0')}`)}
        <div class="b ct c" data-i="2"><span class="c-top">forever</span><div class="arm">
          ${block('mo', 3, `go to x: ${val('mouse x')}`)}
          <div class="b ct c" data-i="4"><span class="c-top">if <span class="hex">touching ${pill('Star')}?</span> then</span><div class="arm">
            ${block('va', 5, `change ${pill('score')} by ${val('1')}`)}
          </div><span class="c-foot"></span></div>
        </div><span class="c-foot"></span></div>
      </div>`,
      stage: () => `<div class="stg stg-game">
        <span class="tw" style="left:12%;top:20%"></span><span class="tw" style="left:72%;top:12%"></span><span class="tw" style="left:44%;top:34%"></span><span class="tw" style="left:86%;top:42%"></span>
        <div class="hud"><svg><use href="#i-star"/></svg>${nameSpan()}<b class="score">0</b></div>
        <svg class="fall" style="--x:16%;--d:0s"><use href="#i-star"/></svg>
        <svg class="fall" style="--x:42%;--d:-0.9s"><use href="#i-star"/></svg>
        <svg class="fall" style="--x:66%;--d:-1.7s"><use href="#i-star"/></svg>
        <svg class="fall" style="--x:84%;--d:-0.4s"><use href="#i-star"/></svg>
        <div class="catcher"><span class="plus">+1</span><svg class="bot"><use href="#bot"/></svg></div>
      </div>`,
      async run(g, mark) {
        const score = $('.score', els.stage);
        const plus = $('.plus', els.stage);
        for (;;) {
          let s = 0;
          score.textContent = s;
          mark(-1); await sleep(500, g);
          mark(0); await sleep(500, g);
          mark(1); await sleep(500, g);
          for (let k = 0; k < 6; k++) {
            mark(3); await sleep(380, g);
            mark(4); await sleep(380, g);
            mark(5);
            score.textContent = ++s;
            plus.classList.remove('pop'); void plus.offsetWidth; plus.classList.add('pop');
            await sleep(620, g);
          }
          mark(-1); await sleep(1400, g);
        }
      },
      still(mark) { $('.score', els.stage).textContent = '6'; mark(5); },
    },

    python: {
      wide: true,
      file: slug => `${slug}guess_game.py`,
      meta: () => 'Python · ages 11–18',
      lines: n => [
        [['kw', 'import'], ['', ' random']],
        [],
        [['', 'name = '], ['st', `"${n}"`]],
        [['', 'secret = random.'], ['fn', 'randint'], ['', '('], ['nu', '1'], ['', ', '], ['nu', '20'], ['', ')']],
        [['fn', 'print'], ['', '('], ['st', 'f"Hi {name}! Guess my number."'], ['', ')']],
        [],
        [['', 'guess = '], ['fn', 'int'], ['', '('], ['fn', 'input'], ['', '('], ['st', '"Your guess: "'], ['', '))']],
        [['kw', 'while'], ['', ' guess != secret:']],
        [['', '    hint = '], ['st', '"Higher"'], ['kw', ' if '], ['', 'guess < secret'], ['kw', ' else '], ['st', '"Lower"']],
        [['', '    guess = '], ['fn', 'int'], ['', '('], ['fn', 'input'], ['', '('], ['st', 'f"{hint}! Try again: "'], ['', '))']],
        [['fn', 'print'], ['', '('], ['st', 'f"You got it, {name}!"'], ['', ')']],
      ],
      output: n => [
        [[`Hi ${n}! Guess my number.`]],
        [['Your guess: '], ['12', 'in']],
        [['Higher! Try again: '], ['17', 'in']],
        [['Lower! Try again: '], ['15', 'in']],
        [[`You got it, ${n}!`, 'ok']],
      ],
      code() { return textCode(this.lines(shownName())); },
      stage: () => `<div class="stg stg-out"><p class="out-h"><span class="run">▶ Run</span><span>Output</span></p><div class="out"></div></div>`,
      async run(g) {
        const lines = this.lines(shownName());
        const output = this.output(shownName());
        const rows = [...els.code.querySelectorAll('.ln')];
        const cds = rows.map(r => $('.cd', r));
        const out = $('.out', els.stage);
        const run = $('.run', els.stage);
        for (;;) {
          cds.forEach(c => { c.innerHTML = '&#8203;'; });
          rows.forEach(r => r.classList.remove('on'));
          out.innerHTML = '';
          await sleep(500, g);
          for (let i = 0; i < lines.length; i++) {
            rows.forEach((r, k) => r.classList.toggle('on', k === i));
            const total = tokenLength(lines[i]);
            for (let c = 1; c <= total; c += 2) {
              cds[i].innerHTML = renderTokens(lines[i], c);
              await sleep(16, g);
            }
            cds[i].innerHTML = renderTokens(lines[i]);
            await sleep(total ? 120 : 60, g);
          }
          rows.forEach(r => r.classList.remove('on'));
          run.classList.add('go'); await sleep(600, g); run.classList.remove('go');
          for (const segs of output) {
            const p = document.createElement('p');
            out.appendChild(p);
            for (const [text, cls] of segs) {
              const span = document.createElement('span');
              if (cls) span.className = cls;
              span.textContent = text;
              if (cls === 'in') await sleep(380, g);
              p.appendChild(span);
            }
            await sleep(520, g);
          }
          await sleep(3600, g);
        }
      },
      still() {
        const out = $('.out', els.stage);
        out.innerHTML = this.output(shownName()).map(segs => `<p>${segs.map(([t, c]) => c ? `<span class="${c}">${esc(t)}</span>` : esc(t)).join('')}</p>`).join('');
      },
    },

    robot: {
      get wide() { return !young(); },
      file: slug => (young() ? `${slug}robot_mission.sb3` : `${slug}robot_mission.ino`),
      meta: () => (young() ? 'Robotics · block code' : 'Robotics · Arduino C++'),
      textLines: [
        [['kw', 'void'], ['', ' '], ['fn', 'loop'], ['', '() {']],
        [['', '  '], ['fn', 'forward'], ['', '('], ['nu', '2'], ['', ');']],
        [['', '  '], ['fn', 'turnRight'], ['', '();']],
        [['', '  '], ['fn', 'forward'], ['', '('], ['nu', '2'], ['', ');']],
        [['', '  '], ['fn', 'turnLeft'], ['', '();']],
        [['', '  '], ['fn', 'forward'], ['', '('], ['nu', '3'], ['', ');']],
        [['', '  '], ['fn', 'celebrate'], ['', '();']],
        [['', '}']],
      ],
      code() {
        if (!young()) return textCode(this.textLines);
        return `<div class="sc">
          ${whenFlag(0)}
          ${block('mo', 1, `move forward ${val('2')}`)}
          ${block('mo', 2, `turn ${ICON.cw} right`)}
          ${block('mo', 3, `move forward ${val('2')}`)}
          ${block('mo', 4, `turn ${ICON.ccw} left`)}
          ${block('mo', 5, `move forward ${val('3')}`)}
          ${block('lo', 6, `say ${pill('Made it!')}`)}
        </div>`;
      },
      stage: () => {
        const blocked = new Set(['3,0', '5,0', '4,1', '0,2', '1,3', '4,3']);
        let cells = '';
        for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) {
          cells += `<span class="cell${blocked.has(`${x},${y}`) ? ' ob' : ''}" data-c="${x},${y}"></span>`;
        }
        return `<div class="stg stg-robot"><div class="mat">${cells}</div>
          <span class="goal" style="--x:5;--y:2"><svg><use href="#i-flag"/></svg></span>
          <div class="rbt" style="--x:0;--y:0"><span class="rsay">${nameSpan(true)} robot made it!</span><svg class="bot"><use href="#bot"/></svg></div></div>`;
      },
      async run(g, mark) {
        const rbt = $('.rbt', els.stage);
        const cell = (x, y) => $(`[data-c="${x},${y}"]`, els.stage);
        const go = async (x, y) => {
          rbt.style.setProperty('--x', x);
          rbt.style.setProperty('--y', y);
          cell(x, y).classList.add('tr');
          await sleep(420, g);
        };
        for (;;) {
          rbt.classList.add('snap');
          rbt.style.setProperty('--x', 0); rbt.style.setProperty('--y', 0);
          rbt.classList.remove('done', 'turn');
          els.stage.querySelectorAll('.tr').forEach(c => c.classList.remove('tr'));
          void rbt.offsetWidth; rbt.classList.remove('snap');
          cell(0, 0).classList.add('tr');
          mark(-1); await sleep(600, g);
          mark(0); await sleep(500, g);
          mark(1); await go(1, 0); await go(2, 0);
          mark(2); rbt.classList.add('turn'); await sleep(520, g); rbt.classList.remove('turn');
          mark(3); await go(2, 1); await go(2, 2);
          mark(4); rbt.classList.add('turn'); await sleep(520, g); rbt.classList.remove('turn');
          mark(5); await go(3, 2); await go(4, 2); await go(5, 2);
          mark(6); rbt.classList.add('done'); await sleep(2600, g);
          mark(-1); await sleep(300, g);
        }
      },
      still(mark) {
        const rbt = $('.rbt', els.stage);
        rbt.style.setProperty('--x', 5); rbt.style.setProperty('--y', 2);
        rbt.classList.add('done');
        ['0,0', '1,0', '2,0', '2,1', '2,2', '3,2', '4,2', '5,2'].forEach(c => $(`[data-c="${c}"]`, els.stage).classList.add('tr'));
        mark(6);
      },
      lineFor: i => i, // block i maps to text line i
    },

    ai: {
      file: slug => (young() ? `${slug}ai_buddy.sb3` : `${slug}ai_buddy.py`),
      meta: () => (young() ? 'AI · block code' : 'AI · Python'),
      textLines: n => [
        [['kw', 'from'], ['', ' buddy '], ['kw', 'import'], ['', ' Chatbot']],
        [],
        [['', 'bot = '], ['fn', 'Chatbot'], ['', '(name='], ['st', `"${n}'s buddy"`], ['', ')']],
        [['', 'bot.style = '], ['st', '"friendly space expert"']],
        [],
        [['', 'question = '], ['fn', 'input'], ['', '('], ['st', '"Ask me anything: "'], ['', ')']],
        [['fn', 'print'], ['', '(bot.'], ['fn', 'reply'], ['', '(question))']],
      ],
      code() {
        if (!young()) return textCode(this.textLines(shownName()));
        return `<div class="sc">
          ${whenFlag(0)}
          ${block('se', 1, `ask ${pill('What shall we talk about?')} and wait`)}
          ${block('ai', 2, `set ${pill('reply')} to <span class="hex">AI answer to ${pill('answer')}</span>`)}
          ${block('lo', 3, `say ${pill('reply')}`)}
        </div>`;
      },
      stage: () => `<div class="stg stg-chat"><div class="chat-h"><svg class="bot"><use href="#bot"/></svg><span>${nameSpan(true)} AI buddy</span></div><div class="msgs"></div></div>`,
      chat: [
        ['me', 'Tell me a fun fact about space!'],
        ['ai', 'A day on Venus is longer than its whole year!'],
        ['me', 'Turn it into a riddle for my friends.'],
        ['ai', 'I spin so slowly, my day outlasts my year. Which planet am I?'],
      ],
      lineFor: i => [2, 5, 6, 6][i],
      async run(g, mark) {
        const box = $('.msgs', els.stage);
        const add = (who, text = '') => {
          const p = document.createElement('p');
          p.className = `msg ${who}`;
          p.textContent = text;
          box.appendChild(p);
          while (box.children.length > 4) box.firstChild.remove();
          return p;
        };
        for (;;) {
          box.innerHTML = '';
          mark(-1); await sleep(500, g);
          mark(0); await sleep(600, g);
          for (let i = 0; i < this.chat.length; i += 2) {
            mark(1); add('me', this.chat[i][1]); await sleep(900, g);
            mark(2);
            const typing = add('ai typing');
            typing.innerHTML = '<i></i><i></i><i></i>';
            await sleep(900, g);
            typing.className = 'msg ai';
            typing.textContent = '';
            const text = this.chat[i + 1][1];
            for (let c = 1; c <= text.length; c += 2) { typing.textContent = text.slice(0, c); await sleep(18, g); }
            typing.textContent = text;
            mark(3); await sleep(i === 0 ? 1500 : 3000, g);
          }
        }
      },
      still(mark) {
        $('.msgs', els.stage).innerHTML = this.chat.map(([who, t]) => `<p class="msg ${who}">${esc(t)}</p>`).join('');
        mark(3);
      },
    },
  };

  /* ---------- Engine ---------- */

  function sceneFor(age, interest) {
    if (interest === 'robotics') return 'robot';
    if (interest === 'ai') return 'ai';
    if (age === '5-6') return 'story';
    if (age === '11-13' || age === '14-18') return 'python';
    return 'game';
  }

  function makeMark(scene) {
    return i => {
      const blocks = els.code.querySelectorAll('[data-i]');
      if (blocks.length) {
        blocks.forEach(el => el.classList.toggle('on', +el.dataset.i === i));
        return;
      }
      const line = i < 0 ? -1 : (scene.lineFor ? scene.lineFor(i) : i);
      els.code.querySelectorAll('.ln').forEach((el, k) => el.classList.toggle('on', k === line));
    };
  }

  function slug() {
    const s = state.name.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
    return s ? `${s}_` : '';
  }

  function updateChrome() {
    const scene = scenes[sceneKey];
    const noun = window.ICJ.builds[sceneKey].noun;
    els.file.textContent = scene.file(slug());
    els.title.textContent = `${state.name ? poss(state.name) : "Your child's"} first ${noun}`;
    els.meta.textContent = scene.meta();
    els.caption.textContent = `Preview: ${els.title.textContent}, the kind of project built in the free class.`;
    const slotText = $('span', els.slot);
    els.slot.hidden = !state.slot;
    slotText.textContent = state.slot;
  }

  function mount() {
    const scene = scenes[sceneKey];
    els.body.classList.toggle('wide', !!scene.wide);
    els.body.dataset.scene = sceneKey;
    els.code.innerHTML = scene.code();
    els.stage.innerHTML = scene.stage();
    play();
  }

  function play() {
    if (!sceneKey) return;
    gen += 1;
    const g = gen;
    const scene = scenes[sceneKey];
    const mark = makeMark(scene);
    if (reduceMotion) {
      scene.still(mark);
      return;
    }
    if (!visible) return;
    scene.run(g, mark).catch(err => { if (err !== STALE) console.error(err); });
  }

  function update(next) {
    const prev = { ...state };
    Object.assign(state, next);
    const key = sceneFor(state.age, state.interest);
    const youngChanged = (['11-13', '14-18'].includes(prev.age)) !== (['11-13', '14-18'].includes(state.age));
    if (key !== sceneKey || (youngChanged && (key === 'robot' || key === 'ai'))) {
      sceneKey = key;
      updateChrome();
      mount();
      return;
    }
    updateChrome();
    if (prev.name !== state.name) {
      refreshNames();
      // Scenes that print the name inside their code restart so the code stays consistent.
      if (sceneKey === 'python' || (sceneKey === 'ai' && !young())) {
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => { els.code.innerHTML = scenes[sceneKey].code(); els.stage.innerHTML = scenes[sceneKey].stage(); play(); }, 450);
      }
    }
  }

  new IntersectionObserver(([entry]) => {
    const was = visible;
    visible = entry.isIntersecting;
    if (visible && !was) play();
    if (!visible) gen += 1;
  }, { threshold: 0.15 }).observe(els.preview);

  return { update, sceneFor, get scene() { return sceneKey; } };
})();
