const starterTimers = [
  {
    heading: "Focus",
    task: "Focus on one thing.",
    minutes: 25,
    break: 5,
    direction: "down",
    rotation: 3,
  },
  {
    heading: "Deep work",
    task: "Make room for deep work.",
    minutes: 50,
    break: 10,
    direction: "down",
    rotation: 3,
  },
  {
    heading: "Quick start",
    task: "Take the first small step.",
    minutes: 15,
    break: 3,
    direction: "down",
    rotation: 3,
  },
];
let presets = [],
  session = null,
  deviceTimer = false,
  launching = false;
let form = {
  heading: "Next task",
  task: "",
  minutes: 25,
  break: 5,
  direction: "down",
  rotation: 3,
};
let saveTimeout;
function current() {
  return {
    heading: $("#heading").value,
    task: $("#task").value,
    minutes: Number($("#minutes").value),
    break: Number($("#break").value),
    direction: $("#direction").value,
    rotation,
  };
}
function writeForm(f) {
  for (const key of ["heading", "task", "minutes", "break", "direction"])
    $("#" + key).value = f[key] ?? form[key];
  rotation = f.rotation ?? 3;
  $("#rotation").value = rotation;
  $("#durations").classList.toggle("hidden", $("#direction").value === "up");
}
function save() {
  form = current();
  const data = { form, presets, session, savedAt: Date.now() };
  localStorage.setItem("firepace", JSON.stringify(data));
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => api("save", data).catch(() => {}), 200);
}
function renderCards() {
  const parent = $("#timerCards");
  parent.replaceChildren();
  [...starterTimers, ...presets].forEach((f, i) => {
    const button = document.createElement("button");
    button.className = "timer-card";
    const time = document.createElement("strong");
    time.textContent = f.direction === "up" ? "↑" : f.minutes + " min";
    const name = document.createElement("span");
    name.className = "card-name";
    name.textContent =
      i < 3 ? ["Everyday focus", "Deep work", "Quick start"][i] : f.task;
    const detail = document.createElement("span");
    detail.textContent =
      f.direction === "up" ? "Open-ended" : f.break + " min break";
    button.append(time, name, detail);
    button.onclick = () => {
      writeForm({ ...f, rotation });
      start();
    };
    parent.append(button);
  });
}
function updatePresets() {
  renderCards();
  const p = $("#preset");
  p.replaceChildren(new Option("New timer", ""));
  presets.forEach((f, i) => p.add(new Option(f.task || f.heading, String(i))));
}
function timerValues() {
  const f = session?.form || current(),
    now = Date.now() / 1000;
  let elapsed = session
    ? session.paused
      ? session.elapsed
      : Math.max(0, Math.floor(now - session.started))
    : 0;
  const phase = session?.phase || "focus",
    base = Math.round(Number(phase === "break" ? f.break : f.minutes) * 60),
    value = f.direction === "up" ? elapsed : Math.max(0, base - elapsed);
  return {
    f,
    phase,
    elapsed,
    base,
    value,
    progress:
      f.direction === "up"
        ? (elapsed % 60) / 60
        : Math.max(0, 1 - elapsed / base),
  };
}
function drawStatic(phase) {
  setCanvas();
  const f = session?.form || current(),
    w = canvas.width,
    h = canvas.height;
  ctx.fillStyle = "#444";
  ctx.font = "bold 24px Helvetica,Arial,sans-serif";
  ctx.textBaseline = "top";
  ctx.letterSpacing = "4px";
  ctx.fillText(
    (phase === "break"
      ? "Take a break"
      : f.heading || "Next task"
    ).toUpperCase(),
    32,
    34,
    w - 64,
  );
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#777";
  ctx.fillRect(32, 91, w - 64, 2);
  ctx.fillStyle = "#000";
  const text =
    phase === "break" ? "A moment to recharge." : f.task || "Your next task.";
  let size = 126,
    lines = [];
  for (; size > 18; size--) {
    lines = wrap(
      text,
      "bold " + size + "px Helvetica,Arial,sans-serif",
      w - 64,
    );
    if (lines.length * size * 0.88 <= h - 282) break;
  }
  ctx.font = "bold " + size + "px Helvetica,Arial,sans-serif";
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) =>
    ctx.fillText(line, 32, 118 + size * 0.76 + i * size * 0.88),
  );
}
function render() {
  const a = timerValues();
  drawStatic(a.phase);
  const size = 76,
    dw = 45,
    top = canvas.height - 132,
    clock =
      String(Math.floor(a.value / 60)).padStart(2, "0") +
      ":" +
      String(a.value % 60).padStart(2, "0"),
    label = a.f.direction === "down" ? "left" : "",
    x = canvas.width - 32 - (label ? 48 : 0) - ((clock.length - 1) * dw + 23);
  ctx.font = "bold " + size + "px Helvetica,Arial,sans-serif";
  ctx.textBaseline = "alphabetic";
  let cx = x;
  [...clock].forEach((c) => {
    ctx.fillText(c, cx, top + 80);
    cx += c === ":" ? 23 : dw;
  });
  if (label) {
    ctx.font = "bold 20px Helvetica,Arial,sans-serif";
    ctx.fillText(label, x + ((clock.length - 1) * dw + 23) + 9, top + 80);
  }
  drawPie(ctx, x - 62, top + 40, Math.floor(a.progress * 20) / 20);
  if (session?.paused && !launching) {
    ctx.font = "bold 20px Helvetica,Arial,sans-serif";
    ctx.fillText("PAUSED", 32, top + 80);
  }
  $("#phaseLabel").textContent =
    (a.phase === "focus" ? "Focus" : "Break") +
    " · " +
    (!session ? "ready" : session.paused ? "paused" : "in progress");
  $("#stageTitle").textContent = session
    ? a.phase === "break"
      ? "Break time"
      : "Focus time"
    : "Choose a timer.";
  $("#deviceLabel").textContent = deviceTimer
    ? connected
      ? "Synced with Kindle"
      : "Running on Kindle"
    : "Preview";
  $("#stageNote").textContent = session
    ? deviceTimer
      ? "Your Kindle keeps time, even unplugged."
      : "Your timer is running in this browser."
    : "Start with a ready-made session, or set up your own.";
  $("#pause").textContent = session?.paused ? "Resume" : "Pause";
  for (const id of ["pause", "restart", "skip", "stop"])
    $("#" + id).disabled = !session || launching || (deviceTimer && !connected);
  $("#skip").disabled = !session || launching || (deviceTimer && !connected) || a.f.direction === "up";
  $("#skip").textContent =
    a.phase === "focus" ? "Take a break" : "Back to focus";
  $("#orientationToggle").disabled = launching || (deviceTimer && !connected);
  if (launching) { $("#phaseLabel").textContent = "Preparing Kindle…"; $("#stageNote").textContent = "Sending your task and timer to the screen."; }
  $("#sessionHint").textContent = deviceTimer && !connected ? "Your Kindle keeps running. Reconnect to change the session here." : "On Kindle: center pauses, Menu opens controls, Home exits. Synced presets stay on the device.";
  document.body.classList.toggle("running", !!session);
  $("#activeSummary").classList.toggle("hidden", !session);
  $("#formTitle").textContent = session ? "Your session" : "Make a timer";
  if (session) {
    $("#activeTask").textContent = a.f.task;
    $("#activeTiming").textContent =
      a.f.direction === "up"
        ? "Open-ended timer"
        : a.f.minutes + " min focus · " + a.f.break + " min break";
  }
}
function drawPie(x, left, top, p) {
  x.strokeStyle = "#111";
  x.lineWidth = 1.5;
  x.beginPath();
  x.arc(left + 24, top + 24, 22, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = "#111";
  x.beginPath();
  x.moveTo(left + 24, top + 24);
  x.arc(left + 24, top + 24, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
  x.closePath();
  x.fill();
}
function menuImage(labels, selection, title) {
  const offset = Math.min(
    Math.max(0, selection - 3),
    Math.max(0, labels.length - 7),
  );
  labels = labels.slice(offset, offset + 7);
  selection -= offset;
  setCanvas();
  canvas.width = 600;
  canvas.height = 600;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 600, 600);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, 576, 576);
  ctx.fillStyle = "#444";
  ctx.font = "bold 24px Helvetica,Arial,sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(title.toUpperCase(), 32, 34);
  ctx.fillRect(32, 91, canvas.width - 64, 2);
  labels.forEach((text, i) => {
    const y = 112 + i * 58;
    ctx.fillStyle = i === selection ? "#111" : "#fff";
    ctx.fillRect(32, y, canvas.width - 64, 50);
    ctx.fillStyle = i === selection ? "#fff" : "#111";
    ctx.font = "28px Helvetica,Arial,sans-serif";
    ctx.fillText(text, 48, y + 10, canvas.width - 100);
  });
  ctx.fillStyle = "#555";
  ctx.font = "18px Helvetica,Arial,sans-serif";
  ctx.fillText(
    "Up / down to choose · Center to select · Back to return",
    32,
    canvas.height - 40,
    canvas.width - 64,
  );
  return pbm(canvas);
}
function assets() {
  const result = {};
  for (let i = 0; i < 7; i++)
    result["menu" + i] = menuImage(
      [
        "Pause / resume",
        "Restart timer",
        "Switch focus / break",
        "Saved timers",
        "Orientation",
        "Back to timer",
        "Exit",
      ],
      i,
      "FirePace",
    );
  for (let i = 0; i < 4; i++)
    result["rotate" + i] = menuImage(
      [
        "Cable right · landscape",
        "Cable left · landscape",
        "Cable bottom · portrait",
        "Cable top · portrait",
      ],
      i,
      "Orientation",
    );
  const originalRotation = rotation;
  for (const rot of [3, 0]) {
    rotation = rot;
    for (const phase of ["focus", "break"]) {
      drawStatic(phase);
      result[phase + (rot === 3 ? "landscape" : "portrait")] = pbm(canvas);
    }
  }
  rotation = originalRotation;
  for (const c of "0123456789:")
    result["d" + (c === ":" ? "colon" : c)] = glyph(
      c === ":" ? 23 : 45,
      100,
      (x) => {
        x.font = "bold 76px Helvetica,Arial,sans-serif";
        x.fillText(c, 0, 80);
      },
    );
  result.paused = glyph(160, 100, (x) => {
    x.font = "bold 20px Helvetica,Arial,sans-serif";
    x.fillText("PAUSED", 0, 80);
  });
  result.left = glyph(48, 100, (x) => {
    x.font = "bold 20px Helvetica,Arial,sans-serif";
    x.fillText("left", 9, 80);
  });
  for (let n = 0; n <= 20; n++)
    result["p" + n] = glyph(48, 48, (x) => drawPie(x, 0, 0, n / 20));
  render();
  return result;
}
async function syncPresets() {
  if (!connected) {
    message("Connect your Kindle to sync saved timers.");
    return;
  }
  message("Syncing saved timers…");
  const original = session,
    originalForm = current();
  const timers = [...starterTimers, ...presets],
    items = [];
  try {
    for (let i = 0; i < timers.length; i++) {
      session = { form: timers[i] };
      rotation = timers[i].rotation ?? 3;
      const images = {};
      for (const rot of [3, 0]) {
        rotation = rot;
        for (const phase of ["focus", "break"]) {
          drawStatic(phase);
          images[phase + (rot === 3 ? "landscape" : "portrait")] = pbm(canvas);
        }
      }
      items.push({ form: timers[i], images });
    }
    session = original;
    rotation = originalForm.rotation;
    const labels = timers.map((p) => p.task.slice(0, 38));
    const menus = labels.map((_, i) => menuImage(labels, i, "Saved timers"));
    await api("presets", { items, menus });
    message("Saved timers are on your Kindle. Open Menu → Saved timers.");
  } catch (e) {
    message(e.message);
  } finally {
    session = original;
    rotation = originalForm.rotation;
    render();
  }
}
$("#syncPresets").onclick = syncPresets;
async function start() {
  unlockSound();
  const f = current();
  if (!f.task.trim()) {
    message("Give this session a task first.");
    $("#task").focus();
    return;
  }
  if (
    !Number.isFinite(f.minutes) ||
    !Number.isFinite(f.break) ||
    f.minutes < 0.1 ||
    f.minutes > 1440 ||
    f.break < 0.1 ||
    f.break > 1440
  ) {
    message("Choose a duration from 0.1 to 1,440 minutes.");
    return;
  }
  session = {
    form: f,
    phase: "focus",
    started: Date.now() / 1000,
    elapsed: 0,
    paused: false,
  };
  deviceTimer = false;
  message("");
  if (connected) {
    launching = true;
    session.paused = true;
    $("#start").disabled = true;
    message("Sending the session to your Kindle…");
    try {
      await api("timer", {
        action: "start",
        seconds: Math.round(f.minutes * 60),
        breakSeconds: Math.round(f.break * 60),
        rotation,
        width: canvas.width,
        height: canvas.height,
        digitWidth: 45,
        clockSize: 76,
        countUp: f.direction === "up",
        assets: assets(),
      });
      deviceTimer = true;
      session.device = true;
      session.started = Date.now() / 1000;
      message("On your Kindle. You can unplug now.");
    } catch (e) {
      message("Running here. Kindle: " + e.message);
    }
    launching = false;
    session.paused = false;
    session.started = Date.now() / 1000;
    $("#start").disabled = false;
  }
  save();
  render();
}
async function action(action) {
  if (!session) return;
  const a = timerValues(),
    now = Date.now() / 1000;
  if (deviceTimer) {
    try {
      await api("timer", { action });
      message("");
    } catch (e) {
      message("Reconnect to control the Kindle timer.");
      return;
    }
  }
  if (action === "pause") {
    session.elapsed = a.elapsed;
    session.paused = true;
  }
  if (action === "resume") {
    session.started = now - session.elapsed;
    session.paused = false;
  }
  if (action === "restart") {
    session.started = now;
    session.elapsed = 0;
  }
  if (action === "skip") {
    session.phase = a.phase === "focus" ? "break" : "focus";
    session.started = now;
    session.elapsed = 0;
  }
  if (action === "exit") {
    session = null;
    deviceTimer = false;
  }
  save();
  render();
}
$("#start").onclick = start;
$("#pause").onclick = () => action(session?.paused ? "resume" : "pause");
$("#restart").onclick = () => action("restart");
$("#skip").onclick = () => action("skip");
$("#stop").onclick = () => action("exit");
$("#refresh").onclick = () =>
  api("timer", { action: "refresh" }).catch((e) => message(e.message));
$("#savePreset").onclick = () => {
  const f = current();
  if (!f.task.trim()) {
    message("Add a task before saving.");
    return;
  }
  const match = presets.findIndex((p) => p.task === f.task);
  if (match >= 0) presets[match] = f;
  else presets.push(f);
  presets = presets.slice(-6);
  updatePresets();
  $("#preset").value = String(match >= 0 ? match : presets.length - 1);
  save();
  message("Timer saved on this computer.");
};
$("#preset").onchange = (e) => {
  if (e.target.value !== "") {
    writeForm(presets[Number(e.target.value)]);
    save();
    render();
  }
};
for (const id of ["heading", "task", "minutes", "break", "direction"])
  $("#" + id).addEventListener("input", () => {
    if (id === "direction")
      $("#durations").classList.toggle(
        "hidden",
        $("#direction").value === "up",
      );
    save();
    render();
  });
function onDeviceState(state) {
  if (!state.connected) { render(); return; }
  if (state.timer?.running && !session && state.timer.preset >= 0) {
    const preset = [...starterTimers, ...presets][state.timer.preset];
    if (preset) {
      session = {form: preset, phase: state.timer.phase, started: Date.now()/1000-state.timer.elapsed, elapsed: state.timer.elapsed, paused: !!state.timer.paused, device: true};
      deviceTimer = true;
      save();
    }
  }

  if (state.timer?.running === false && deviceTimer) {
    session = null;
    deviceTimer = false;
    save();
    render();
    return;
  }
  if (state.timer && deviceTimer && session) {
    if (state.timer.rotation !== undefined) {
      rotation = state.timer.rotation;
      $("#rotation").value = rotation;
      session.form.rotation = rotation;
    }
    if (
      state.timer.preset !== undefined &&
      state.timer.preset >= 0 &&
      [...starterTimers, ...presets][state.timer.preset]
    )
      session.form = [...starterTimers, ...presets][state.timer.preset];
    if (session.phase !== state.timer.phase) playChime();
    session.phase = state.timer.phase;
    session.elapsed = state.timer.elapsed;
    session.paused = !!state.timer.paused;
    session.started = Date.now() / 1000 - session.elapsed;
    render();
  }
}
setInterval(() => {
  if (session && !session.paused && !deviceTimer) {
    const a = timerValues();
    if (a.f.direction === "down" && a.elapsed >= a.base) {
      session.phase = a.phase === "focus" ? "break" : "focus";
      playChime();
      session.started = Date.now() / 1000;
      session.elapsed = 0;
      save();
    }
  }
  render();
}, 1000);
(async () => {
  let data = {};
  try {
    const local = JSON.parse(localStorage.getItem("firepace")) || {},
      remote = await api("data");
    data = (local.savedAt || 0) > (remote.savedAt || 0) ? local : remote;
  } catch {
    data = JSON.parse(localStorage.getItem("firepace")) || {};
  }
  presets = data.presets || [];
  session = data.session || null;
  deviceTimer = !!session?.device;
  writeForm(data.form || form);
  updatePresets();
  render();
})();

$("#rotation").onchange = async (e) => {
  rotation = Number(e.target.value);
  if (session) session.form.rotation = rotation;
  render();
  save();
  if (deviceTimer) {
    try {
      await api("timer", { action: "rotate" + rotation });
    } catch (e) {
      message("Reconnect to rotate the Kindle.");
    }
  }
};

let audioContext = null;
function unlockSound() {
  if (!$("#sound").checked) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
  } catch {
    message("Sound is unavailable in this browser.");
  }
}
function playChime() {
  if (!$("#sound").checked || !audioContext) return;
  [660, 880].forEach((frequency, i) => {
    const o = audioContext.createOscillator(),
      g = audioContext.createGain(),
      t = audioContext.currentTime + i * 0.18;
    o.type = "sine";
    o.frequency.value = frequency;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(audioContext.destination);
    o.start(t);
    o.stop(t + 0.32);
  });
}
$("#sound").checked = localStorage.getItem("firepace-sound") !== "off";
$("#sound").onchange = () => {
  localStorage.setItem("firepace-sound", $("#sound").checked ? "on" : "off");
  unlockSound();
};
$("#testSound").onclick = () => {
  unlockSound();
  setTimeout(playChime, 60);
};
