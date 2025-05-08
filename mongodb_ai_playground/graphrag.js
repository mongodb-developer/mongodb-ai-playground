// graphrag.js – rewritten UI matching RAG widget layout
// ------------------------------------------------------
// Helpers ------------------------------------------------
function el(tag, opts = {}) {
    const e = document.createElement(tag);
    if (opts.id) e.id = opts.id;
    if (opts.className) e.className = opts.className;
    if (opts.innerHTML !== undefined) e.innerHTML = opts.innerHTML;
    if (opts.style) Object.assign(e.style, opts.style);
    if (opts.value !== undefined) e.value = opts.value;
    return e;
  }
  function btn(text, cls = "step-button") { return el("button", { innerHTML: text, className: cls }); }
  function slider({ label, min, max, value, onChange }) {
    const wrap = el("div", { className: "control-group" });
    const lab = el("label", { innerHTML: `${label} ` });
    const s = el("input", { type: "range", min, max, value });
    const span = el("span", { innerHTML: value });
    s.oninput = () => { span.innerHTML = s.value; onChange(+s.value); };
    wrap.append(lab, s, span);
    return wrap;
  }
  function selectCtrl({ label, options, value, onChange }) {
    const wrap = el("div", { className: "control-group" });
    wrap.append(el("label", { innerHTML: `${label} ` }));
    const sel = el("select");
    options.forEach(o => {
      const opt = el("option", { innerHTML: o, value: o });
      if (o === value) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = () => onChange(sel.value);
    wrap.appendChild(sel);
    return wrap;
  }
  
  // Main render -------------------------------------------
  function render({ model, el: root }) {
    root.innerHTML = "";
  
    // --- Navigation --------------------------------------
    const tabs = [
      { name: "Ingest & Graph →", val: 1 },
      { name: "Question Answering", val: 2 },
    ];
    const nav = el("div", { className: "steps-nav" });
    const navBtns = tabs.map(t => {
      const b = btn(t.name);
      if (model.get("current_step") === t.val) b.classList.add("active-step");
      b.onclick = () => { model.set("current_step", t.val); model.save_changes(); };
      nav.appendChild(b);
      return b;
    });
    root.appendChild(nav);
  
    // --- Containers --------------------------------------
    const ingestWrap = el("div");
    const qaWrap = el("div");
    root.append(ingestWrap, qaWrap);
  
    // --- Ingest & Graph ----------------------------------
    // Controls
    const controls = el("div", { className: "controls" });
    controls.append(
      slider({
        label: "Chunk size",
        min: 1,
        max: 2000,
        value: model.get("chunk_size"),
        onChange: v => { model.set("chunk_size", v); model.save_changes(); }
      }),
      slider({
        label: "Overlap",
        min: 0,
        max: 500,
        value: model.get("overlap_size"),
        onChange: v => { model.set("overlap_size", v); model.save_changes(); }
      }),
      selectCtrl({
        label: "Split strategy",
        options: ["Fixed", "Recursive", "Markdown"],
        value: model.get("split_strategy"),
        onChange: v => { model.set("split_strategy", v); model.save_changes(); }
      })
    );
  
    // Preview + graph side‑by‑side
    const preview = el("div", {
      innerHTML: model.get("document_preview") || "No preview",
      style: { flex: "1", border: "1px solid #ccc", padding: ".5rem", maxHeight: "350px", overflow: "auto" }
    });
    const graphDiv = el("div", { style: { flex: "1" } });
    const split = el("div", { style: { display: "flex", gap: "2rem", marginTop: "1rem" } });
    split.append(preview, graphDiv);
  
    // Pagination + build button
    const pag = el("div", { style: { marginTop: ".5rem" } });
    const prev = btn("◀ Prev");
    const next = btn("Next ▶");
    prev.onclick = () => { const i = (model.get("current_doc_index")||0)-1; if(i>=0){ model.set("current_doc_index", i); model.save_changes(); } };
    next.onclick = () => { model.set("current_doc_index", (model.get("current_doc_index")||0)+1); model.save_changes(); };
    pag.append(prev, next);
    const ingestBtn = btn("Build Knowledge Graph");
    ingestBtn.onclick = () => { model.set("command", "ingest_graph"); model.save_changes(); };
  
    ingestWrap.append(controls, split, pag, ingestBtn);
  
    // --- QA ----------------------------------------------
    const qArea = el("textarea", { rows: 3, style: { width: "100%" } });
    qArea.oninput = () => { model.set("rag_query", qArea.value); model.save_changes(); };
    const askBtn = btn("Ask");
    const ansDiv = el("pre", { style: { whiteSpace: "pre-wrap" } });
    askBtn.onclick = () => { ansDiv.textContent = ""; model.set("command", "graph_ask"); model.save_changes(); };
    qaWrap.append(qArea, askBtn, ansDiv);
  
    // --- Show correct tab -------------------------------
    function show() {
      const step = model.get("current_step");
      ingestWrap.style.display = step === 1 ? "block" : "none";
      qaWrap.style.display = step === 2 ? "block" : "none";
      navBtns.forEach((b,i)=>{ b.classList.toggle("active-step", step===tabs[i].val); });
    }
    show();
  
    // --- Observers --------------------------------------
    model.on("change:current_step", show);
    model.on("change:document_preview", () => { preview.innerHTML = model.get("document_preview") || "No preview"; });
    model.on("change:graph_html", () => {
      graphDiv.innerHTML = "";
      const html = model.get("graph_html");
      if (html) {
        const iframe = document.createElement("iframe");
        Object.assign(iframe.style, { width: "100%", height: "620px", border: "none" });
        iframe.srcdoc = html;
        graphDiv.appendChild(iframe);
      }
    });
    model.on("change:rag_answer", () => { ansDiv.textContent = model.get("rag_answer") || ""; });
    model.on("change:chunk_size",   v=>{ controls.querySelectorAll("input[type=range]")[0].value = model.get("chunk_size"); });
    model.on("change:overlap_size", v=>{ controls.querySelectorAll("input[type=range]")[1].value = model.get("overlap_size"); });
    model.on("change:split_strategy", v=>{ controls.querySelector("select").value = model.get("split_strategy"); });
  }
  
  export default { render };
  