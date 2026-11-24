import { escapeHtml } from "../domain/html.js?v=d659db8d68e4";
import { COMMENT_MAX_LENGTH } from "../application/commentService.js?v=b5df407bd34e";
import { getBoardNickname } from "../domain/author-identity.js?v=c565b2e79da0";

class BoardComments extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = { comments: [], user: null, status: "loading", submitting: false, replyingTo: null };
    this.handlers = {};
  }

  configure({ user, onSubmit, onDelete, onLogin }) {
    this.state.user = user;
    this.handlers = { onSubmit, onDelete, onLogin };
    this.render();
  }

  setComments(comments) {
    this.state.comments = Array.isArray(comments) ? comments : [];
    this.state.status = "ready";
    this.state.replyingTo = null;
    this.render();
  }

  updateUser(user) {
    this.state.user = user;
    this.state.replyingTo = null;
    this.render();
  }

  setError() {
    this.state.status = "error";
    this.render();
  }

  formatDate(value) {
    const millis = value?.toMillis?.() ?? (value?.seconds ? value.seconds * 1000 : 0);
    return millis ? new Date(millis).toLocaleString() : "방금 전";
  }

  renderComposer({ parentId = "", compact = false } = {}) {
    return `<form class="composer ${compact ? "reply-composer" : ""}" data-parent-id="${escapeHtml(parentId)}">
      <textarea maxlength="${COMMENT_MAX_LENGTH}" placeholder="${compact ? "답글을 입력하세요." : "댓글을 입력하세요."}" aria-label="${compact ? "답글 내용" : "댓글 내용"}" required></textarea>
      <div class="form-footer"><span>최대 ${COMMENT_MAX_LENGTH}자</span><div>${compact ? '<button class="cancel" type="button">취소</button>' : ""}<button class="submit" type="submit" ${this.state.submitting ? "disabled" : ""}>${this.state.submitting ? "등록 중…" : "등록"}</button></div></div>
    </form>`;
  }

  renderComment(comment, replies = []) {
    const { user, replyingTo } = this.state;
    const canDelete = !comment.deleted && user && (user.role === "admin" || user.uid === comment.authorUid);
    const canReply = !comment.deleted && !comment.parentId && getBoardNickname(user);
    const body = comment.deleted ? '<p class="deleted">삭제된 댓글입니다.</p>' : `<p>${escapeHtml(comment.content).replace(/\n/g, "<br>")}</p>`;
    const replyForm = canReply && replyingTo === comment.id ? this.renderComposer({ parentId: comment.id, compact: true }) : "";
    return `<article class="comment ${comment.parentId ? "reply" : ""}">
      <div class="comment-head"><strong>${comment.deleted ? "알 수 없음" : escapeHtml(comment.authorName || "익명")}</strong><span>${escapeHtml(this.formatDate(comment.createdAt))}</span></div>
      ${body}
      <div class="actions">${canReply ? `<button class="reply-button" data-comment-id="${escapeHtml(comment.id)}" type="button">답글</button>` : ""}${canDelete ? `<button class="delete" data-comment-id="${escapeHtml(comment.id)}" type="button">삭제</button>` : ""}</div>
      ${replyForm}
      ${replies.length ? `<div class="replies">${replies.map((reply) => this.renderComment(reply)).join("")}</div>` : ""}
    </article>`;
  }

  renderItems() {
    const { comments, status } = this.state;
    if (status === "loading") return '<p class="state">댓글을 불러오는 중입니다.</p>';
    if (status === "error") return '<p class="state error">댓글을 불러오지 못했습니다.</p>';
    if (!comments.length) return '<p class="state">첫 댓글을 남겨보세요.</p>';

    const repliesByParent = new Map();
    comments.filter((comment) => comment.parentId).forEach((reply) => {
      const replies = repliesByParent.get(reply.parentId) || [];
      replies.push(reply);
      repliesByParent.set(reply.parentId, replies);
    });
    const knownIds = new Set(comments.map((comment) => comment.id));
    const roots = comments.filter((comment) => {
      if (comment.parentId && knownIds.has(comment.parentId)) return false;
      return !comment.deleted || (repliesByParent.get(comment.id) || []).length > 0;
    });
    return roots.map((comment) => this.renderComment(comment, repliesByParent.get(comment.id) || [])).join("");
  }

  render() {
    const { comments, user } = this.state;
    const activeCount = comments.filter((comment) => !comment.deleted).length;
    const composer = user
      ? (getBoardNickname(user) ? this.renderComposer()
        : '<div class="login-prompt">댓글을 작성하려면 사이트 회원 닉네임을 설정해 주세요.<a class="login" href="/account/">닉네임 설정하기</a></div>')
      : '<div class="login-prompt">댓글을 작성하려면 로그인이 필요합니다.<button class="login" type="button">로그인</button></div>';

    this.shadowRoot.innerHTML = `<style>
      @import url("/style.css");
      :host{display:block;width:100%;max-width:900px;margin:24px auto 0}.wrap{background:var(--surface-card,#fff);border:1px solid oklch(92% .02 260);border-radius:24px;padding:32px;box-shadow:0 10px 40px rgba(2,6,23,.05)}
      h2{margin:0 0 22px;color:var(--text-main);font-size:1.35rem}.count{color:var(--link-color,var(--p-blue))}.composer{margin-bottom:28px}.reply-composer{margin:16px 0 2px}textarea{box-sizing:border-box;width:100%;min-height:110px;padding:15px;border:1px solid oklch(86% .02 260);border-radius:12px;background:transparent;color:var(--text-main);font:inherit;resize:vertical}.reply-composer textarea{min-height:82px}.form-footer{display:flex;justify-content:space-between;align-items:center;margin-top:10px;color:var(--text-sub);font-size:.85rem}
      button{border:0;border-radius:10px;padding:8px 13px;font-weight:800;cursor:pointer}.submit,.login{background:var(--p-blue);color:#fff}.submit:disabled{opacity:.55;cursor:wait}.cancel{margin-right:7px;background:var(--surface-muted,#f3f6fb);color:var(--text-main)}.comment{position:relative;padding:18px 4px;border-top:1px solid oklch(94% .01 260)}.comment.reply{margin-left:28px;padding-left:18px;border-left:3px solid var(--p-blue-soft)}.comment-head{display:flex;gap:10px;align-items:center}.comment-head strong{color:var(--text-main)}.comment-head span{color:var(--text-sub);font-size:.8rem}.comment p{margin:10px 0;color:var(--text-main);line-height:1.6;overflow-wrap:anywhere}.comment .deleted{color:var(--text-sub);font-style:italic}.actions{display:flex;justify-content:flex-end;gap:4px}.reply-button,.delete{background:transparent;color:var(--text-sub)}.delete{color:var(--text-danger,#b91c1c)}.replies{margin-top:6px}.replies .comment:first-child{border-top:0}.state,.login-prompt{color:var(--text-sub);text-align:center;padding:22px}.login{margin-left:12px}
      :host-context(body.dark-mode) .wrap{background:#0f172a;border-color:rgba(148,163,184,.22)}:host-context(body.dark-mode) .comment{border-color:rgba(148,163,184,.18)}:host-context(body.dark-mode) textarea{border-color:rgba(148,163,184,.35)}:host-context(body.dark-mode) .cancel{background:rgba(148,163,184,.14);color:#f8fbff}
      @media(max-width:768px){.wrap{padding:22px}.comment.reply{margin-left:12px;padding-left:12px}}
    </style><section class="wrap"><h2>댓글 <span class="count">${activeCount}</span></h2>${composer}<div>${this.renderItems()}</div></section>`;

    this.shadowRoot.querySelectorAll("form").forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (this.state.submitting) return;
      const content = event.currentTarget.querySelector("textarea").value;
      const parentId = event.currentTarget.dataset.parentId;
      const parentComment = parentId ? comments.find((comment) => comment.id === parentId) : null;
      this.state.submitting = true;
      this.render();
      try {
        await this.handlers.onSubmit?.(content, parentComment);
      } finally {
        this.state.submitting = false;
        this.render();
      }
    }));
    this.shadowRoot.querySelector("button.login")?.addEventListener("click", () => this.handlers.onLogin?.());
    this.shadowRoot.querySelectorAll(".reply-button").forEach((button) => button.addEventListener("click", () => {
      this.state.replyingTo = button.dataset.commentId;
      this.render();
      this.shadowRoot.querySelector(".reply-composer textarea")?.focus();
    }));
    this.shadowRoot.querySelectorAll(".cancel").forEach((button) => button.addEventListener("click", () => {
      this.state.replyingTo = null;
      this.render();
    }));
    this.shadowRoot.querySelectorAll(".delete").forEach((button) => button.addEventListener("click", () => {
      const comment = comments.find((item) => item.id === button.dataset.commentId);
      if (comment) this.handlers.onDelete?.(comment);
    }));
  }
}

if (!customElements.get("board-comments")) customElements.define("board-comments", BoardComments);
