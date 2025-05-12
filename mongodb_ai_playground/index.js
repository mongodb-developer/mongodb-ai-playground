// index.js

// Global error management
let errorBox = null;

function showError(message) {
  if (!errorBox) return;
  if (message && message.length > 0) {
    errorBox.innerHTML = message;
    errorBox.style.display = "block";
  } else {
    errorBox.innerHTML = "";
    errorBox.style.display = "none";
  }
}

function createElement(tag, { id, className, innerHTML, style } = {}) {
  const el = document.createElement(tag);
  if (id) el.id = id;
  if (className) el.className = className;
  if (innerHTML !== undefined) el.innerHTML = innerHTML;
  if (style) Object.assign(el.style, style);
  return el;
}

function createButton(text, className = "step-button") {
  return createElement("button", { innerHTML: text, className });
}

function createNavBar(tabs, containerClass) {
  const nav = createElement("div", { className: containerClass });
  const buttons = tabs.map((tab) => {
    const btn = createButton(tab.name);
    nav.appendChild(btn);
    return btn;
  });
  return { nav, buttons };
}

function createSection(id, display = "none", innerHTML = "") {
  return createElement("div", { id, innerHTML, style: { display } });
}

function createSliderControl({ labelText, min, max, initialValue, onChange, debounceTime = 500 }) {
  const container = createElement("div");
  const label = createElement("label", { innerHTML: labelText });
  const slider = createElement("input");
  slider.type = "range";
  slider.min = min;
  slider.max = max;
  slider.value = initialValue;
  const valueSpan = createElement("span", { innerHTML: initialValue });
  container.append(label, slider, valueSpan);
  let timer = null;
  slider.addEventListener("input", () => {
    valueSpan.innerHTML = slider.value;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => onChange(parseInt(slider.value)), debounceTime);
  });
  return { container, slider, label, valueSpan };
}

function createSelectControl({ labelText, options, selectedValue, onChange }) {
  const container = createElement("div", { className: "control-group" });
  const label = createElement("label", { innerHTML: labelText });
  const select = createElement("select");
  options.forEach((opt) => {
    const option = createElement("option", { innerHTML: opt });
    option.value = opt;
    if (opt === selectedValue) option.selected = true;
    select.appendChild(option);
  });
  select.addEventListener("change", () => onChange(select.value));
  container.append(label, select);
  return { container, select, label };
}

function render({ model, el }) {
  // Clear container
  el.id = "mongodb-ai-playground";
  el.innerHTML = "";

  // Create a wrapper for all content except error box
  const contentWrapper = createElement("div", { className: "content-wrapper" });
  el.appendChild(contentWrapper);

  //------------------------------------------------------------
  // Top-Level Tabs
  //------------------------------------------------------------
  const topTabs = [{ name: "RAG", value: 1 }];
  const { nav: topNav, buttons: topButtons } = createNavBar(topTabs, "steps-nav");
  contentWrapper.appendChild(topNav);

  // Error Alert Box will be appended as the last child (bottom of widget)

  //------------------------------------------------------------
  // Sub-Tabs
  //------------------------------------------------------------
  const ragTabs = [
    { name: "Chunking →", value: 1 },
    { name: "Embedding & Ingestion →", value: 2 },
    { name: "Question Answering", value: 3 },
  ];
  const { nav: ragSubNav, buttons: ragSubButtons } = createNavBar(ragTabs, "sub-tabs-nav");

  const graphRagTabs = [
    { name: "Knowledge Graph Creation →", value: 1 },
    { name: "Question Answering", value: 2 },
  ];
  const { nav: graphRAGSubNav, buttons: graphRagSubButtons } = createNavBar(graphRagTabs, "sub-tabs-nav");

  const textMqlTabs = [{ name: "test", value: 1 }];
  const { nav: textMqlSubNav, buttons: textMqlSubButtons } = createNavBar(textMqlTabs, "sub-tabs-nav");

  //------------------------------------------------------------
  // Error Alert Box - After Sub-Tabs
  //------------------------------------------------------------
  const errorContainer = createElement("div", {
    style: {
      width: "100%",
      marginTop: "10px",
      marginBottom: "10px"
    }
  });
  
  errorBox = createElement("div", { 
    id: "error-alert", 
    className: "alert alert-danger", 
    innerHTML: "",
    style: { 
      display: "none", 
      padding: "10px", 
      border: "1px solid #dc3545", 
      borderRadius: "8px",
      backgroundColor: "#f8d7da", 
      color: "#721c24",
      fontWeight: "bold",
      height: "60px",
      overflowY: "auto"
    } 
  });
  
  errorContainer.appendChild(errorBox);

  //------------------------------------------------------------
  // RAG Sections & Subsections
  //------------------------------------------------------------
  const ragContainer = createElement("div");

  // Chunking Section
  const chunkingSection = createSection("chunking-section", "none");
  ragContainer.appendChild(chunkingSection);

  // Settings
  const settingsDiv = createSection("settings-section", "block");

  // Split Strategy Select
  const splitStrategy = model.get("split_strategy");
  const splitSelectControl = createSelectControl({
    labelText: "Split Strategy:",
    options: ["Fixed", "Recursive", "Markdown"],
    selectedValue: splitStrategy,
    onChange: (val) => {
      model.set("split_strategy", val);
      model.save_changes();
      toggleOverlapUI();
    },
  });
  settingsDiv.appendChild(splitSelectControl.container);

  // Chunk Size Slider
  const chunkSize = model.get("chunk_size");
  const { container: chunkSliderContainer, slider: chunkSlider, valueSpan: chunkValSpan } =
    createSliderControl({
      labelText: "Chunk Size (1 - 2000): ",
      min: "1",
      max: "2000",
      initialValue: chunkSize,
      onChange: (val) => {
        model.set("chunk_size", val);
        model.save_changes();
      },
    });
  settingsDiv.appendChild(chunkSliderContainer);

  // Overlap Size Slider
  const overlapSize = model.get("overlap_size");
  const { container: overlapSliderContainer, slider: overlapSlider, label: overlapLabel, valueSpan: overlapValSpan } =
    createSliderControl({
      labelText: "Overlap Size (0 - 500): ",
      min: "0",
      max: "500",
      initialValue: overlapSize,
      onChange: (val) => {
        model.set("overlap_size", val);
        model.save_changes();
      },
    });
  settingsDiv.appendChild(overlapSliderContainer);
  chunkingSection.appendChild(settingsDiv);

  // Document Preview + Chunks Table (Two Columns)
  const docDiv = createElement("div", {
    id: "document-view",
    innerHTML: model.get("document_preview") || "Loading document preview...",
    style: { flex: "1" },
  });
  const chunkTableDiv = createElement("div", { id: "chunks-table-container", style: { flex: "1" } });
  const previewContainer = createElement("div", { style: { display: "flex", gap: "2rem" } });
  previewContainer.append(docDiv, chunkTableDiv);
  chunkingSection.appendChild(previewContainer);

  // Pagination Controls
  const paginationDiv = createElement("div", { id: "pagination-controls" });
  const prevBtn = createButton("Previous Page", "action-button");
  prevBtn.addEventListener("click", () => {
    const currentIdx = model.get("current_doc_index") || 0;
    if (currentIdx > 0) {
      model.set("current_doc_index", currentIdx - 1);
      model.save_changes();
    }
  });
  const nextBtn = createButton("Next Page", "action-button");
  nextBtn.addEventListener("click", () => {
    const currentIdx = model.get("current_doc_index") || 0;
    model.set("current_doc_index", currentIdx + 1);
    model.save_changes();
  });
  paginationDiv.append(prevBtn, nextBtn);
  chunkingSection.appendChild(paginationDiv);

  // Embedding & Ingestion Section (Updated)
  const embeddingSection = createSection("embedding-section", "none");
  ragContainer.appendChild(embeddingSection);
  const embeddingContainer = createElement("div", { style: { display: "flex", gap: "2rem" } });
  const chunkListDiv = createElement("div", { style: { flex: "1" }, innerHTML: "<h4 class='section-titles'>Chunks</h4>" });
  embeddingContainer.appendChild(chunkListDiv);
  // Pagination controls for embedding tab
  const embeddingPaginationDiv = createElement("div", { id: "embedding-pagination-controls" });
  const embeddingPrevBtn = createButton("Previous Page", "action-button");
  embeddingPrevBtn.addEventListener("click", () => {
    const currentIdx = model.get("current_doc_index") || 0;
    if (currentIdx > 0) {
      model.set("current_doc_index", currentIdx - 1);
      model.save_changes();
    }
  });
  const embeddingNextBtn = createButton("Next Page", "action-button");
  embeddingNextBtn.addEventListener("click", () => {
    const currentIdx = model.get("current_doc_index") || 0;
    model.set("current_doc_index", currentIdx + 1);
    model.save_changes();
  });
  embeddingPaginationDiv.append(embeddingPrevBtn, embeddingNextBtn);
  chunkListDiv.appendChild(embeddingPaginationDiv);
  // Ensure the chunk list updates with page changes
  model.on("change:current_doc_index", renderChunkListForEmbedding);
  // Initial render
  renderChunkListForEmbedding();

  // Create a header container for "Documents in MongoDB" and the Load button side by side
  const docListColumn = createElement("div", { style: { flex: "1" } });
  const docHeaderContainer = createElement("div", {
    style: { display: "flex", alignItems: "center", justifyContent: "space-between" }
  });
  const docsHeader = createElement("h4", { innerHTML: "Documents in MongoDB" });
  const loadButton = createButton("Load into MongoDB", "action-button");
  loadButton.id = "loadButton";
  loadButton.addEventListener("click", () => {
    model.set("command", "load_into_mongo");
    model.save_changes();
    // Poll until mongo_docs_table is populated, then render using the latest container reference
    const checkDocsLoaded = setInterval(() => {
      const docs = model.get("mongo_docs_table");
      if (docs && docs.length > 0) {
        clearInterval(checkDocsLoaded);
        renderMongoDocsList();
      }
    }, 500);
  });
  docHeaderContainer.append(docsHeader, loadButton);
  docListColumn.appendChild(docHeaderContainer);

  // Container for MongoDB documents list
  const docListDiv = createElement("div", { id: "doc-list-container" });
  docListColumn.appendChild(docListDiv);
  embeddingContainer.appendChild(docListColumn);
  embeddingSection.appendChild(embeddingContainer);

  // Question Answering Section
  const qaSection = createSection("rag-section", "none");
  ragContainer.appendChild(qaSection);
  // create the flex container and force its children to align at the top
  const ragMainContainer = createElement("div", {
    style: { display: "flex", alignItems: "flex-start", gap: "2rem"},
  });

  const leftCol = createElement("div", {
    style: { flex: "1 1 0%", display: "flex", flexDirection: "column", minWidth: "0" },
  });
  // move the QA heading inside the left column so it sits level with the right column's header
  const ragTitle = createElement("h4", { innerHTML: "Question" });
  leftCol.appendChild(ragTitle);
  const rightCol = createElement("div", {
    style: { flex: "1 1 0%", minWidth: "0" },
  });
  // Question Input & Send Button
  const questionContainer = createElement("div");
  const ragQueryArea = createElement("textarea", {
    placeholder: "Ask your question here...",
    rows: "4",
    style: { width: "100%" },
  });
  ragQueryArea.addEventListener("input", () => {
    model.set("rag_query", ragQueryArea.value);
    model.save_changes();
  });
  questionContainer.appendChild(ragQueryArea);
  const ragSendBtn = createButton("Send", "action-button");
  questionContainer.appendChild(ragSendBtn);

  // Answer Display
  const answerContainer = createElement("div");
  const answerDiv = createElement("div", { id: "rag-answer" });
  answerContainer.appendChild(answerDiv);

  // Prompt Template Editor
  const promptTemplateContainer = createElement("div");
  const promptTemplateLabel = createElement("h4", { innerHTML: "Prompt Template" });
  promptTemplateContainer.appendChild(promptTemplateLabel);
  const promptEditor = createElement("textarea", {
    placeholder: "Modify your RAG prompt template here...",
    rows: "5",
    style: { width: "100%", whiteSpace: "pre-wrap", overflowWrap: "break-word" },
  });
  promptEditor.value = model.get("rag_prompt_template") || "";
  promptEditor.addEventListener("keydown", (event) => event.stopPropagation());
  promptEditor.addEventListener("input", () => {
    model.set("rag_prompt_template", promptEditor.value);
    model.save_changes();
  });
  promptTemplateContainer.appendChild(promptEditor);

  // Final Prompt Display (container only)
  const finalPromptContainer = createElement("div", {
    id: "final-prompt-container",
    style: { flex: "1 1 auto", maxHeight: "300px", overflowY: "auto" },
  });
  const promptDiv = createElement("div", { id: "rag-prompt" });
  finalPromptContainer.appendChild(promptDiv);

  rightCol.appendChild(createElement("div", { id: "rag-results" }));
  const finalPromptHeader = createElement("h4", { innerHTML: "Final Prompt Used" });
  leftCol.append(questionContainer, answerContainer, promptTemplateContainer, finalPromptHeader, finalPromptContainer);
  ragMainContainer.append(leftCol, rightCol);
  qaSection.appendChild(ragMainContainer);

  ragSendBtn.addEventListener("click", () => {
    answerDiv.innerHTML = "";
    document.getElementById("rag-results").innerHTML = "";
    model.set("command", "rag_ask");
    model.save_changes();
  });

  //------------------------------------------------------------
  // GraphRAG & text-to-MQL Sections
  //------------------------------------------------------------
  const graphRagContainer = createElement("div");
  const knowledgeGraphSection = createElement("div", {
    innerHTML: "<h3>Knowledge Graph Creation</h3><p>TODO: Add content here.</p>",
    style: { display: "none" },
  });
  const graphRagQaSection = createElement("div", {
    innerHTML: "<h3>GraphRAG Question Answering</h3><p>TODO: Add content here.</p>",
    style: { display: "none" },
  });
  graphRagContainer.append(knowledgeGraphSection, graphRagQaSection);

  const textMqlContainer = createElement("div");
  const textMqlTestSection = createElement("div", {
    innerHTML: "<h3>text-to-mql: test</h3><p>Placeholder content here.</p>",
    style: { display: "none" },
  });
  textMqlContainer.appendChild(textMqlTestSection);

  //------------------------------------------------------------
  // Helper: Set Active Tabs & Toggle Overlap UI
  //------------------------------------------------------------
  function setActiveTabButtons(buttons, currentValue, tabDefs, modelKey) {
    buttons.forEach((btn, idx) => {
      btn.classList.remove("active-step");
      if (tabDefs[idx].value === currentValue) btn.classList.add("active-step");
      btn.onclick = () => {
        model.set(modelKey, tabDefs[idx].value);
        model.save_changes();
      };
    });
  }

  function toggleOverlapUI() {
    overlapSlider.disabled = false;
    overlapLabel.style.color = "";
    overlapValSpan.style.color = "";
  }

  //------------------------------------------------------------
  // Render Functions
  //------------------------------------------------------------
  function renderChunksTable() {
    const allChunks = model.get("chunks_table") || [];
    const currentPageIndex = model.get("current_doc_index");
    const filteredChunks = allChunks.filter((row) => row.page_index === currentPageIndex);
    if (!filteredChunks.length) {
      chunkTableDiv.innerHTML = "<p>No chunk data for this page.</p>";
      return;
    }
    let html = '<div class="chunk-card-container">';
    filteredChunks.forEach((row) => {
      html += `
        <div class="chunk-card">
          <span class="chunk-tag">Page ${row.page_index}, Chunk ${row.chunk_index}</span>
          <div class="chunk-text">${row.chunk_text}</div>
        </div>
      `;
    });
    html += "</div>";
    chunkTableDiv.innerHTML = html;
  }

  function renderChunkListForEmbedding() {
    let allChunks = model.get("embeddings_table") || model.get("chunks_table") || [];
    const currentPageIndex = model.get("current_doc_index");
    const filteredChunks = allChunks.filter((row) => row.page_index === currentPageIndex);
    if (!filteredChunks.length) {
      chunkListDiv.innerHTML = "<h4>Chunks</h4><p>No chunks to display for this page.</p>";
      return;
    }
    let html = "<h4>Chunks</h4><div class='chunk-card-container'>";
    filteredChunks.forEach((row) => {
      html += `
        <div class="chunk-card">
          <span class="chunk-tag">Page ${row.page_index}, Chunk ${row.chunk_index}</span>
          <div class="chunk-text">${row.chunk_text}</div>
        </div>
      `;
    });
    html += "</div>";
    chunkListDiv.innerHTML = html;
  }

  // Update renderMongoDocsList to remove the header (since it’s now static above)
  function renderMongoDocsList() {
    const docListDiv = document.getElementById("doc-list-container");
    if (!docListDiv) return;
    const mongoDocs = model.get("mongo_docs_table") || [];
    if (!mongoDocs.length) {
      docListDiv.innerHTML = "<p>No documents loaded yet.</p>";
      return;
    }
    let html = "<div class='doc-card-container'>";
    mongoDocs.forEach((doc) => {
      const embedding = Array.isArray(doc.embedding) ? doc.embedding.join(", ") : "N/A";
      html += `
          <div class="doc-card">
            <div><span class="doc-key">_id:</span> <span class="doc-value doc-value-id">${doc._id}</span></div>
            <div><span class="doc-key">text:</span> <span class="doc-value doc-value-text">${doc.text}</span></div>
            <div><span class="doc-key">embedding:</span> <span class="doc-value doc-value-embedding">[${embedding}]</span></div>
          </div>
        `;
    });
    html += "</div>";
    docListDiv.innerHTML = html;
  }

  function renderRAGResults() {
    const results = model.get("rag_results") || [];
    const ragResultsDivLocal = document.getElementById("rag-results");
    if (!ragResultsDivLocal) return;
    if (!results.length) {
      ragResultsDivLocal.innerHTML = "<p>No retrieved documents yet.</p>";
      return;
    }
    let html = "<h4>Retrieved documents from Atlas Vector Search</h4><div class='doc-card-container'>";
    results.forEach((r, idx) => {
      const docId = r.metadata && r.metadata._id ? r.metadata._id : `Doc ${idx + 1}`;
      const docEmbedding =
        r.metadata && r.metadata.embedding
          ? JSON.stringify(r.metadata.embedding).slice(0, 100)
          : "N/A";
      html += `
        <div class="doc-card" style="position:relative;">
          <span class="doc-tag" style="position:absolute; top:0.5rem; right:0.5rem;">
            Similarity: ${r.score.toFixed(4)}
          </span>
          <div>
            <span class="doc-key">_id:</span>
            <span class="doc-value doc-value-id">${docId}</span>
          </div>
          <div>
            <span class="doc-key">content:</span>
            <span class="doc-value doc-value-text">${r.content}</span>
          </div>
          <div>
            <span class="doc-key">embedding:</span>
            <span class="doc-value doc-value-embedding">${docEmbedding}</span>
          </div>
        </div>
      `;
    });
    html += "</div>";
    ragResultsDivLocal.innerHTML = html;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderRAGPrompt() {
    const template =
      model.get("rag_prompt_template") ||
      "You are a helpful AI. Given the following context, answer the question.\nContext: {context}\nQuestion: {question}";
    const question = model.get("rag_query") || "";
    const results = model.get("rag_results") || [];
    const contextStr = results.map((r) => r.content).join("\n\n");
    let finalPrompt = template.replace("{context}", contextStr).replace("{question}", question);
    if (contextStr.trim()) {
      finalPrompt = finalPrompt.replace(contextStr, `${contextStr}`);
    }
    // find the container
    const promptDivLocal = document.getElementById("rag-prompt");
    if (promptDivLocal) {
      // clear any previous HTML
      promptDivLocal.innerHTML = "";
      // create heading
      const heading = document.createElement("h4");

      // create <pre> and set textContent so tags show literally
      const pre = document.createElement("pre");
      pre.textContent = finalPrompt;
      // append to container
      promptDivLocal.appendChild(heading);
      promptDivLocal.appendChild(pre);
    }
    model.set("rag_prompt", finalPrompt);
    model.save_changes();
  }

  function renderRAGAnswer() {
    const answer = model.get("rag_answer") || "";
    let html = "<h4>Answer</h4>";
    html += `<pre style="white-space:pre-wrap;">${answer}</pre>`;
    const answerDivLocal = document.getElementById("rag-answer");
    if (answerDivLocal) answerDivLocal.innerHTML = html;
  }

  //------------------------------------------------------------
  // Show Active Sections Based on Tabs
  //------------------------------------------------------------
  function showActiveSections() {
    [ragSubNav, graphRAGSubNav, textMqlSubNav, ragContainer, graphRagContainer, textMqlContainer].forEach(
      (elem) => {
        if (elem.parentNode) elem.parentNode.removeChild(elem);
      }
    );

    const mainTab = model.get("main_tab") || 1;
    setActiveTabButtons(topButtons, mainTab, topTabs, "main_tab");

    if (mainTab === 1) {
      contentWrapper.appendChild(ragSubNav);
      contentWrapper.appendChild(ragContainer);
      const ragSub = model.get("rag_sub_tab") || 1;
      setActiveTabButtons(ragSubButtons, ragSub, ragTabs, "rag_sub_tab");

      chunkingSection.style.display = ragSub === 1 ? "block" : "none";
      embeddingSection.style.display = ragSub === 2 ? "block" : "none";
      qaSection.style.display = ragSub === 3 ? "block" : "none";

      if (ragSub === 1) renderChunksTable();
      else if (ragSub === 2) {
        renderChunkListForEmbedding();
        renderMongoDocsList();
      } else if (ragSub === 3) {
        renderRAGResults();
        renderRAGPrompt();
        renderRAGAnswer();
      }
    } else if (mainTab === 2) {
      contentWrapper.appendChild(graphRAGSubNav);
      contentWrapper.appendChild(graphRagContainer);
      const gSub = model.get("graph_rag_sub_tab") || 1;
      setActiveTabButtons(graphRagSubButtons, gSub, graphRagTabs, "graph_rag_sub_tab");
      knowledgeGraphSection.style.display = gSub === 1 ? "block" : "none";
      graphRagQaSection.style.display = gSub === 2 ? "block" : "none";
    } else {
      contentWrapper.appendChild(textMqlSubNav);
      contentWrapper.appendChild(textMqlContainer);
      const tSub = model.get("text_mql_sub_tab") || 1;
      setActiveTabButtons(textMqlSubButtons, tSub, textMqlTabs, "text_mql_sub_tab");
      textMqlTestSection.style.display = tSub === 1 ? "block" : "none";
    }

    // ensure error box shows at the bottom of the widget
    if (!document.getElementById("error-alert")) {
      el.appendChild(errorContainer);
    }
  }

  //------------------------------------------------------------
  // Model Observers
  //------------------------------------------------------------
  model.on("change:main_tab", showActiveSections);
  model.on("change:rag_sub_tab", showActiveSections);
  model.on("change:graph_rag_sub_tab", showActiveSections);
  model.on("change:text_mql_sub_tab", showActiveSections);

  model.on("change:document_preview", () => {
    const docDivLocal = document.getElementById("document-view");
    if (docDivLocal) docDivLocal.innerHTML = model.get("document_preview") || "";
  });
  model.on("change:chunks_table", renderChunksTable);
  model.on("change:current_doc_index", renderChunksTable);
  model.on("change:split_strategy", () => {
    splitSelectControl.select.value = model.get("split_strategy");
    toggleOverlapUI();
    renderChunksTable();
  });
  model.on("change:chunk_size", () => {
    chunkSlider.value = model.get("chunk_size");
    chunkValSpan.innerText = model.get("chunk_size");
    renderChunksTable();
  });
  model.on("change:overlap_size", () => {
    overlapSlider.value = model.get("overlap_size");
    overlapValSpan.innerText = model.get("overlap_size");
    renderChunksTable();
  });
  model.on("change:embeddings_table", () => {
    if (model.get("main_tab") === 1 && model.get("rag_sub_tab") === 2) renderChunkListForEmbedding();
  });
  model.on("change:mongo_docs_table", () => {
    if (model.get("main_tab") === 1 && model.get("rag_sub_tab") === 2) renderMongoDocsList();
  });
  model.on("change:rag_results", () => {
    renderRAGResults();
    renderRAGPrompt();
  });
  model.on("change:rag_query", renderRAGPrompt);
  model.on("change:rag_prompt_template", () => {
    promptEditor.value = model.get("rag_prompt_template") || "";
    renderRAGPrompt();
  });
  model.on("change:rag_prompt", renderRAGPrompt);
  model.on("change:rag_answer", renderRAGAnswer);

  // Listen for changes to the error traitlet
  // Listen for error changes from the model
  model.on("change:error", () => {
    const error = model.get("error");
    showError(error);
  });
  
  // Also check for custom messages
  model.on("msg:custom", (event) => {
    if (event.type === "update_error") {
      showError(event.error);
    }
  });

  //------------------------------------------------------------
  // Error Alert Box will be added after the tabs

  //------------------------------------------------------------
  // Initial Setup
  //------------------------------------------------------------
  showActiveSections();
  renderChunksTable();
  if (model.get("main_tab") === 1 && model.get("rag_sub_tab") === 2) {
    renderChunkListForEmbedding();
    renderMongoDocsList();
  }
  if (model.get("main_tab") === 1 && model.get("rag_sub_tab") === 3) {
    renderRAGResults();
    renderRAGPrompt();
    renderRAGAnswer();
  }

}

export default { render };
