// "Reportar" journey, shown under the feedback of an answered question: the
// player picks a reason, may add a comment and sends. DOM-only (no markup-
// injection APIs), same rule as DialogueOverlay.
import './report.css';
import { MAX_REPORT_COMMENT, REASON_NEEDS_COMMENT, REPORT_REASONS } from '../../state/reports';
import type { ReportReasonId } from '../../state/reports';

/** What the player filled in. The caller adds the question context and sends it. */
export interface ReportDraft {
  reason: ReportReasonId;
  comment: string;
}

/** Resolves when the report was handed over ('saved' or 'queued'), rejects when it could not be. */
export type ReportSubmit = (draft: ReportDraft) => Promise<'saved' | 'queued'>;

export class ReportPanel {
  private panel: HTMLElement | null = null;
  readonly toggle: HTMLButtonElement;
  private sent = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly submit: ReportSubmit,
  ) {
    this.toggle = document.createElement('button');
    this.toggle.type = 'button';
    this.toggle.dataset.testid = 'btn-report';
    this.toggle.className = 'btn-report';
    this.toggle.textContent = 'Reportar um problema';
    this.toggle.addEventListener('click', () => (this.isOpen() ? this.close() : this.open()));
  }

  /** While the form is open the overlay must leave the keyboard alone (typing, Space, Enter). */
  isOpen(): boolean {
    return this.panel !== null;
  }

  close(): void {
    this.panel?.remove();
    this.panel = null;
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.focus({ preventScroll: true });
  }

  private open(): void {
    if (this.sent) return;
    const panel = document.createElement('div');
    panel.className = 'report-panel';
    panel.dataset.testid = 'report-panel';

    const title = document.createElement('p');
    title.className = 'report-title';
    title.textContent = 'O que está errado nesta questão?';
    panel.appendChild(title);

    const list = document.createElement('div');
    list.className = 'report-reasons';
    list.setAttribute('role', 'radiogroup');
    let chosen: ReportReasonId | null = null;
    const reasonButtons: HTMLButtonElement[] = [];
    for (const reason of REPORT_REASONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'report-reason';
      button.dataset.testid = 'report-reason';
      button.dataset.reasonId = reason.id;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', 'false');
      button.textContent = reason.label;
      button.addEventListener('click', () => {
        chosen = reason.id;
        for (const other of reasonButtons) {
          const on = other === button;
          other.classList.toggle('is-selected', on);
          other.setAttribute('aria-checked', String(on));
        }
        refresh();
        comment.focus();
      });
      reasonButtons.push(button);
      list.appendChild(button);
    }
    panel.appendChild(list);

    const comment = document.createElement('textarea');
    comment.className = 'report-comment';
    comment.dataset.testid = 'report-comment';
    comment.maxLength = MAX_REPORT_COMMENT;
    comment.rows = 3;
    comment.placeholder = 'Conte, se quiser, o que deveria ser diferente (opcional)';
    comment.setAttribute('aria-label', 'Comentário do reporte');
    comment.addEventListener('input', () => refresh());
    panel.appendChild(comment);

    const status = document.createElement('p');
    status.className = 'report-status';
    status.dataset.testid = 'report-status';
    status.setAttribute('role', 'status');
    panel.appendChild(status);

    const actions = document.createElement('div');
    actions.className = 'report-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'report-cancel';
    cancel.dataset.testid = 'report-cancel';
    cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', () => this.close());
    const send = document.createElement('button');
    send.type = 'button';
    send.className = 'report-send';
    send.dataset.testid = 'report-send';
    send.textContent = 'Enviar reporte';
    send.disabled = true;
    actions.append(cancel, send);
    panel.appendChild(actions);

    const refresh = (): void => {
      const needsComment = chosen !== null && REASON_NEEDS_COMMENT.includes(chosen);
      send.disabled = chosen === null || (needsComment && comment.value.trim().length < 3);
      status.textContent = needsComment && send.disabled ? 'Explique em poucas palavras o motivo.' : '';
    };

    send.addEventListener('click', () => {
      if (chosen === null || send.disabled) return;
      send.disabled = true;
      cancel.disabled = true;
      status.textContent = 'Enviando…';
      this.submit({ reason: chosen, comment: comment.value.trim() }).then(
        (result) => {
          this.sent = true;
          this.panel?.remove();
          this.panel = null;
          this.toggle.disabled = true;
          this.toggle.textContent =
            result === 'saved' ? 'Reporte enviado. Obrigado!' : 'Reporte guardado. Será enviado quando houver conexão.';
          this.toggle.setAttribute('aria-expanded', 'false');
        },
        () => {
          send.disabled = false;
          cancel.disabled = false;
          status.textContent = 'Não foi possível enviar agora. Tente de novo.';
        },
      );
    });

    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
    });

    this.host.appendChild(panel);
    this.panel = panel;
    this.toggle.setAttribute('aria-expanded', 'true');
    reasonButtons[0]?.focus({ preventScroll: true });
    panel.scrollIntoView?.({ block: 'nearest' });
  }
}
