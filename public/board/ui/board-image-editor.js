import { BOARD_IMAGE_LIMIT, parseBoardImageToken, validateBoardImageFile } from '../infra/board-image-service.js?v=d006292ada93';
import { BOARD_RICH_TEXT_MARKER, createSafeBoardLink, sanitizeBoardRichText } from '../domain/rich-text.js?v=9c9745948fba';

function createItemId() {
  return globalThis.crypto?.randomUUID?.() || `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

class BoardImageEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.items = new Map();
    this.draggedFigure = null;
  }

  connectedCallback() {
    this.renderShell();
    this.setValue({ content: '', attachments: [] });
  }

  disconnectedCallback() { this.revokeObjectUrls(); }

  get editor() { return this.shadowRoot.querySelector('[data-editor]'); }

  setValue({ content = '', attachments = [] } = {}) {
    this.revokeObjectUrls();
    this.items.clear();
    if (!this.editor) return;
    this.editor.replaceChildren();

    const used = new Set();
    const lines = String(content || '').split('\n');
    const rich = lines[0] === BOARD_RICH_TEXT_MARKER;
    if (rich) lines.shift();
    lines.forEach((line) => {
      const index = parseBoardImageToken(line, attachments.length);
      const attachment = index !== null ? attachments[index] : null;
      if (attachment?.url || attachment?.file) {
        used.add(index);
        this.addExistingAttachment(attachment);
      } else {
        this.editor.appendChild(this.createTextBlock(line, rich));
      }
    });
    attachments.forEach((attachment, index) => {
      if (!used.has(index) && (attachment?.url || attachment?.file)) this.addExistingAttachment(attachment);
    });
    if (!this.editor.childNodes.length) this.editor.appendChild(this.createTextBlock(''));
  }

  addExistingAttachment(attachment) {
    const item = {
      ...attachment,
      id: createItemId(),
      previewUrl: attachment.file ? URL.createObjectURL(attachment.file) : undefined,
    };
    this.items.set(item.id, item);
    this.editor.appendChild(this.createImageFigure(item));
  }

  setAttachments(attachments = []) { this.setValue({ content: '', attachments }); }

  getValue() {
    const figures = [...this.editor.querySelectorAll('[data-image-id]')];
    const indexes = new Map(figures.map((figure, index) => [figure.dataset.imageId, index]));
    const attachments = figures.map((figure) => ({ ...this.items.get(figure.dataset.imageId) }));
    const lines = [...this.editor.childNodes].map((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.matches('[data-image-id]')) {
        return `[[board-image:${indexes.get(node.dataset.imageId)}]]`;
      }
      return node.outerHTML || node.textContent || '';
    });
    const hasMeaningfulContent = this.editor.textContent.trim() || attachments.length;
    const body = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return { content: hasMeaningfulContent ? `${BOARD_RICH_TEXT_MARKER}\n${body}` : '', attachments };
  }

  getItems() { return this.getValue().attachments; }
  getContent() { return this.getValue().content; }

  revokeObjectUrls() {
    this.items.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
  }

  createTextBlock(text, rich = false) {
    if (rich && /<[^>]+>/.test(text)) {
      const template = document.createElement('template');
      template.innerHTML = sanitizeBoardRichText(text);
      if (template.content.childNodes.length === 1 && template.content.firstElementChild) {
        return template.content.firstElementChild;
      }
    }
    const block = document.createElement('div');
    if (text) block.textContent = text;
    else block.appendChild(document.createElement('br'));
    return block;
  }

  createImageFigure(item) {
    const figure = document.createElement('figure');
    figure.className = `image-block ${item.align || 'center'}`;
    figure.dataset.imageId = item.id;
    figure.contentEditable = 'false';

    const frame = document.createElement('div');
    frame.className = 'image-frame';
    frame.style.width = `${Number(item.width) || 100}%`;

    const image = document.createElement('img');
    image.src = item.previewUrl || item.url;
    image.alt = '첨부 이미지 미리보기';
    image.draggable = true;
    image.title = '드래그하여 본문 위치 이동';

    const resizeHandle = document.createElement('button');
    resizeHandle.type = 'button';
    resizeHandle.className = 'resize-handle';
    resizeHandle.setAttribute('aria-label', '이미지 크기 조절');
    resizeHandle.title = '드래그하여 크기 조절';

    const tools = document.createElement('div');
    tools.className = 'image-tools';
    tools.innerHTML = `
      <button type="button" class="drag-handle" draggable="true" title="위아래로 드래그해 이동">↕ 이동</button>
      <span class="image-size">${Number(item.width) || 100}%</span>
      <select aria-label="이미지 정렬"><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select>
      <button type="button" class="remove-image">삭제</button>`;
    tools.querySelector('select').value = item.align || 'center';

    figure.addEventListener('click', (event) => {
      event.stopPropagation();
      this.selectFigure(figure);
    });
    tools.querySelector('select').addEventListener('change', (event) => {
      item.align = event.target.value;
      figure.className = `image-block ${item.align} selected`;
      this.emitChange();
    });
    tools.querySelector('.remove-image').addEventListener('click', () => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      this.items.delete(item.id);
      figure.remove();
      this.ensureEditableBlock();
      this.emitChange();
    });
    const beginDrag = (event) => {
      this.draggedFigure = figure;
      figure.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', item.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };
    const endDrag = () => this.finishDrag();
    image.addEventListener('dragstart', beginDrag);
    image.addEventListener('dragend', endDrag);
    const dragHandle = tools.querySelector('.drag-handle');
    dragHandle.addEventListener('dragstart', beginDrag);
    dragHandle.addEventListener('dragend', endDrag);
    resizeHandle.addEventListener('pointerdown', (event) => this.startResize(event, { item, figure, frame, tools }));

    frame.append(image, resizeHandle);
    figure.append(frame, tools);
    return figure;
  }

  startResize(event, { item, figure, frame, tools }) {
    event.preventDefault();
    event.stopPropagation();
    this.selectFigure(figure);
    const startX = event.clientX;
    const startWidth = frame.getBoundingClientRect().width;
    const editorWidth = this.editor.getBoundingClientRect().width;
    const direction = item.align === 'right' ? -1 : 1;
    const onMove = (moveEvent) => {
      const percent = ((startWidth + ((moveEvent.clientX - startX) * direction)) / editorWidth) * 100;
      item.width = Math.round(Math.max(25, Math.min(100, percent)));
      frame.style.width = `${item.width}%`;
      tools.querySelector('.image-size').textContent = `${item.width}%`;
    };
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      this.emitChange();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd, { once: true });
  }

  selectFigure(figure) {
    this.editor.querySelectorAll('.image-block.selected').forEach((element) => element.classList.remove('selected'));
    figure?.classList.add('selected');
  }

  insertFigureAtCursor(figure) {
    const selection = window.getSelection();
    let anchor = selection?.anchorNode || null;
    while (anchor && anchor.parentNode !== this.editor) anchor = anchor.parentNode;
    if (anchor?.parentNode === this.editor) anchor.after(figure, this.createTextBlock(''));
    else this.editor.append(figure, this.createTextBlock(''));
    this.selectFigure(figure);
  }

  ensureEditableBlock() {
    if (![...this.editor.childNodes].some((node) => !node.matches?.('[data-image-id]'))) {
      this.editor.appendChild(this.createTextBlock(''));
    }
  }

  emitChange() { this.dispatchEvent(new Event('change', { bubbles: true })); }

  renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border:1px solid #dbe3ef;border-bottom:0;border-radius:14px 14px 0 0;background:var(--surface-muted,#f8fafc)}.pick{padding:9px 13px;border:0;border-radius:9px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer}.hint{color:var(--text-sub,#64748b);font-size:.78rem}.editor{min-height:400px;padding:24px;border:2px solid #e2e8f0;border-radius:0 0 16px 16px;background:var(--bg-main,#fff);color:var(--text-main,#172033);font-size:1.05rem;line-height:1.65;outline:none}.editor:focus{border-color:var(--p-blue,#2563eb);box-shadow:0 0 0 4px rgba(37,99,235,.1)}.editor>div{min-height:1.65em}.editor>.drop-before{box-shadow:0 -3px 0 #22c55e}.editor>.drop-after{box-shadow:0 3px 0 #22c55e}.image-block{position:relative;margin:18px 0;padding:0;border:0;background:transparent}.image-block.dragging{opacity:.35}.image-block.left{text-align:left}.image-block.center{text-align:center}.image-block.right{text-align:right}.image-frame{position:relative;display:inline-block;max-width:100%;line-height:0}.image-frame img{display:block;width:100%;max-height:680px;object-fit:contain;cursor:grab}.image-frame img:active{cursor:grabbing}.selected .image-frame{outline:2px solid #22c55e;outline-offset:3px}.resize-handle{display:none;position:absolute;right:-7px;bottom:-7px;width:15px;height:15px;padding:0;border:2px solid #fff;border-radius:50%;background:#22c55e;box-shadow:0 1px 5px rgba(0,0,0,.35);cursor:nwse-resize}.selected .resize-handle{display:block}.image-tools{display:none;position:absolute;left:50%;bottom:10px;z-index:2;align-items:center;gap:6px;padding:6px;border:1px solid #cbd5e1;border-radius:10px;background:var(--surface-card,#fff);box-shadow:0 5px 18px rgba(15,23,42,.18);line-height:1;transform:translateX(-50%);white-space:nowrap}.selected .image-tools{display:flex}.image-tools button,.image-tools select{padding:7px 9px;border:1px solid #cbd5e1;border-radius:7px;background:var(--surface-card,#fff);color:var(--text-main,#172033);font-weight:700}.drag-handle{cursor:grab}.image-size{min-width:38px;color:var(--text-sub,#475569);font-size:.76rem}.remove-image{color:var(--text-danger,#b91c1c)!important;cursor:pointer}:host-context(body.dark-mode) .toolbar{border-color:#334155;background:#111a2b}:host-context(body.dark-mode) .editor{border-color:#334155;background:#0b1220;color:#f8fbff}:host-context(body.dark-mode) .hint{color:#cbd5e1}:host-context(body.dark-mode) .image-tools{border-color:#475569;background:rgba(15,23,42,.96)}:host-context(body.dark-mode) .image-tools button,:host-context(body.dark-mode) .image-tools select{border-color:#475569;background:#1e293b;color:#f8fafc}:host-context(body.dark-mode) .image-size{color:#cbd5e1}@media(max-width:620px){.toolbar{align-items:flex-start;flex-direction:column}.editor{min-height:320px;padding:14px}.image-tools{bottom:6px}.image-tools button,.image-tools select{padding:6px}.image-size{display:none}}
        .rich-toolbar{justify-content:flex-start;flex-wrap:wrap;gap:6px;border-bottom:1px solid #dbe3ef;border-radius:14px 14px 0 0}.rich-toolbar>button,.rich-toolbar>select,.tool-menu>button{display:inline-flex;min-height:36px;align-items:center;justify-content:center;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;background:var(--surface-card,#fff);color:var(--text-main,#172033);font:inherit;font-size:.82rem;cursor:pointer}.tool-menu{position:relative}.tool-menu-panel{display:none;position:absolute;top:calc(100% + 4px);left:0;z-index:20;gap:5px;padding:7px;border:1px solid #cbd5e1;border-radius:10px;background:var(--surface-card,#fff);box-shadow:0 8px 24px rgba(15,23,42,.18)}.tool-menu:hover .tool-menu-panel,.tool-menu:focus-within .tool-menu-panel{display:flex}.color-swatch{width:25px;height:25px;padding:0;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #cbd5e1;cursor:pointer}.list-panel{min-width:145px;flex-direction:column}.list-panel button{padding:8px 10px;border:0;border-radius:7px;background:transparent;color:var(--text-main,#172033);text-align:left;cursor:pointer}.list-panel button:hover,.list-panel button:focus{background:var(--surface-notice,#eff6ff)}.align-icon{display:flex;width:20px;flex-direction:column;gap:3px}.align-icon i{display:block;height:2px;border-radius:2px;background:currentColor}.align-icon.left i:nth-child(2){width:65%}.align-icon.center{align-items:center}.align-icon.center i:nth-child(2){width:65%}.align-icon.right{align-items:flex-end}.align-icon.right i:nth-child(2){width:65%}.editor-hint{padding:7px 13px;border-right:1px solid #dbe3ef;border-left:1px solid #dbe3ef;background:var(--surface-muted,#f8fafc);color:var(--text-sub,#64748b);font-size:.75rem}:host-context(body.dark-mode) .rich-toolbar>button,:host-context(body.dark-mode) .rich-toolbar>select,:host-context(body.dark-mode) .tool-menu>button{border-color:#475569;background:#1e293b;color:#f8fafc}:host-context(body.dark-mode) .tool-menu-panel{border-color:#475569;background:#1e293b}:host-context(body.dark-mode) .list-panel button{color:#f8fafc}:host-context(body.dark-mode) .list-panel button:hover,:host-context(body.dark-mode) .list-panel button:focus{background:#334155}:host-context(body.dark-mode) .editor-hint{border-color:#334155;background:#111a2b;color:#cbd5e1}@media(max-width:620px){.rich-toolbar{flex-direction:row;align-items:center}.rich-toolbar>button,.rich-toolbar>select,.tool-menu>button{min-height:34px;padding:6px 8px}.editor-hint{display:none}}
      </style>
      <div class="toolbar rich-toolbar" role="toolbar" aria-label="글 서식">
        <select data-font-size aria-label="글자 크기"><option value="2">10pt</option><option value="3" selected>12pt</option><option value="4">14pt</option><option value="5">18pt</option><option value="6">24pt</option><option value="7">32pt</option></select>
        <button type="button" data-command="bold" title="굵게"><b>B</b></button><button type="button" data-command="italic" title="기울임"><i>I</i></button><button type="button" data-command="underline" title="밑줄"><u>U</u></button><button type="button" data-command="strikeThrough" title="취소선"><s>S</s></button>
        <div class="tool-menu"><button type="button" aria-haspopup="true" title="글자색">A▾</button><div class="tool-menu-panel" aria-label="글자색 선택"><button class="color-swatch" type="button" data-color-value="#172033" style="background:#172033" aria-label="검정"></button><button class="color-swatch" type="button" data-color-value="#ffffff" style="background:#fff;border-color:#64748b" aria-label="흰색"></button><button class="color-swatch" type="button" data-color-value="#ef4444" style="background:#ef4444" aria-label="빨강"></button><button class="color-swatch" type="button" data-color-value="#f59e0b" style="background:#f59e0b" aria-label="주황"></button><button class="color-swatch" type="button" data-color-value="#22c55e" style="background:#22c55e" aria-label="초록"></button><button class="color-swatch" type="button" data-color-value="#2563eb" style="background:#2563eb" aria-label="파랑"></button><button class="color-swatch" type="button" data-color-value="#8b5cf6" style="background:#8b5cf6" aria-label="보라"></button></div></div>
        <button type="button" data-command="justifyLeft" title="왼쪽 정렬" aria-label="왼쪽 정렬"><span class="align-icon left"><i></i><i></i><i></i></span></button><button type="button" data-command="justifyCenter" title="가운데 정렬" aria-label="가운데 정렬"><span class="align-icon center"><i></i><i></i><i></i></span></button><button type="button" data-command="justifyRight" title="오른쪽 정렬" aria-label="오른쪽 정렬"><span class="align-icon right"><i></i><i></i><i></i></span></button>
        <div class="tool-menu"><button type="button" aria-haspopup="true" title="목록">목록 ▾</button><div class="tool-menu-panel list-panel"><button type="button" data-command="insertUnorderedList">• 글머리표 목록</button><button type="button" data-command="insertOrderedList">1. 번호 목록</button></div></div>
        <button type="button" data-link title="링크 삽입">🔗</button><button type="button" data-command="unlink" title="링크 해제">링크 해제</button>
        <button type="button" data-command="undo" title="실행 취소">↶</button><button type="button" data-command="redo" title="다시 실행">↷</button>
        <button class="pick" type="button" data-pick>＋ 이미지</button><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-input>
      </div>
      <div class="editor-hint">이미지는 본문에 삽입되며 직접 드래그해 이동할 수 있습니다. 최대 ${BOARD_IMAGE_LIMIT}장</div>
      <div class="editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="게시글 내용" data-editor></div>`;

    const input = this.shadowRoot.querySelector('[data-input]');
    this.shadowRoot.querySelector('[data-pick]').addEventListener('mousedown', (event) => event.preventDefault());
    this.shadowRoot.querySelector('[data-pick]').addEventListener('click', () => input.click());
    this.bindRichTextToolbar();
    input.addEventListener('change', () => this.addSelectedFiles(input));
    this.editor.addEventListener('input', () => this.emitChange());
    this.editor.addEventListener('click', (event) => {
      if (!event.target.closest('.image-block')) this.selectFigure(null);
    });
    this.editor.addEventListener('dragover', (event) => this.handleDragOver(event));
    this.editor.addEventListener('dragleave', (event) => {
      if (!this.editor.contains(event.relatedTarget)) this.clearDropMarkers();
    });
    this.editor.addEventListener('drop', (event) => this.handleDrop(event));
  }

  bindRichTextToolbar() {
    this.shadowRoot.querySelectorAll('[data-command]').forEach((button) => {
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => this.runCommand(button.dataset.command));
    });
    const fontSize = this.shadowRoot.querySelector('[data-font-size]');
    fontSize.addEventListener('mousedown', () => this.rememberSelection());
    fontSize.addEventListener('change', () => this.runCommand('fontSize', fontSize.value));
    this.shadowRoot.querySelectorAll('[data-color-value]').forEach((button) => {
      button.addEventListener('mousedown', (event) => { event.preventDefault(); this.rememberSelection(); });
      button.addEventListener('click', () => this.runCommand('foreColor', button.dataset.colorValue));
    });
    const link = this.shadowRoot.querySelector('[data-link]');
    link.addEventListener('mousedown', (event) => { event.preventDefault(); this.rememberSelection(); });
    link.addEventListener('click', () => {
      const href = createSafeBoardLink(prompt('연결할 주소를 입력하세요.'));
      if (href) this.runCommand('createLink', href);
    });
  }

  rememberSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && this.editor.contains(selection.anchorNode)) this.savedRange = selection.getRangeAt(0).cloneRange();
  }

  restoreSelection() {
    if (!this.savedRange) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(this.savedRange);
  }

  runCommand(command, value = null) {
    this.restoreSelection();
    this.editor.focus();
    document.execCommand(command, false, value);
    this.rememberSelection();
    this.emitChange();
  }

  addSelectedFiles(input) {
    const available = BOARD_IMAGE_LIMIT - this.items.size;
    const files = [...input.files].slice(0, available);
    try {
      files.forEach(validateBoardImageFile);
      files.forEach((file) => {
        const item = { id: createItemId(), file, previewUrl: URL.createObjectURL(file), width: 100, align: 'center' };
        this.items.set(item.id, item);
        this.insertFigureAtCursor(this.createImageFigure(item));
      });
      if (input.files.length > available) alert(`이미지는 최대 ${BOARD_IMAGE_LIMIT}장까지 첨부할 수 있습니다.`);
      this.emitChange();
    } catch (error) {
      alert(error.code === 'IMAGE_TOO_LARGE' ? '이미지는 장당 5MB 이하만 가능합니다.' : 'JPG, PNG, WebP 이미지만 첨부할 수 있습니다.');
    } finally {
      input.value = '';
    }
  }

  handleDrop(event) {
    event.preventDefault();
    if (!this.draggedFigure) return;
    let target = event.target;
    while (target && target.parentNode !== this.editor) target = target.parentNode;
    if (target?.parentNode === this.editor && target !== this.draggedFigure) {
      const after = target.classList.contains('drop-after');
      target[after ? 'after' : 'before'](this.draggedFigure);
    }
    else this.editor.appendChild(this.draggedFigure);
    this.selectFigure(this.draggedFigure);
    this.finishDrag();
    this.emitChange();
  }

  handleDragOver(event) {
    event.preventDefault();
    if (!this.draggedFigure) return;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    let target = event.target;
    while (target && target.parentNode !== this.editor) target = target.parentNode;
    this.clearDropMarkers();
    if (!target || target === this.draggedFigure || target.parentNode !== this.editor) return;
    const after = event.clientY > target.getBoundingClientRect().top + (target.getBoundingClientRect().height / 2);
    target.classList.add(after ? 'drop-after' : 'drop-before');
  }

  clearDropMarkers() {
    this.editor.querySelectorAll('.drop-before,.drop-after').forEach((element) => element.classList.remove('drop-before', 'drop-after'));
  }

  finishDrag() {
    this.draggedFigure?.classList.remove('dragging');
    this.clearDropMarkers();
    this.draggedFigure = null;
  }
}

if (!customElements.get('board-image-editor')) customElements.define('board-image-editor', BoardImageEditor);
