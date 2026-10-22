// Groups screen: your groups (pick the one the ranking uses), members, invite link,
// create a group, join with a code or link. createElement / textContent only. All data
// and actions come through the GroupsApi; the screen never talks to the server itself.
import './menu.css';
import './pixel.css';
import './groups.css';
import { GroupError, MAX_GROUP_NAME } from '../../state/GroupService';
import type { GroupInfo, GroupsApi } from '../../state/GroupService';

export interface GroupsHandlers {
  onBack(): void;
  /** Called after the active group changed, so the caller can refresh what depends on it. */
  onActiveChanged?(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  content?: string,
  testId?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  if (testId) node.dataset.testid = testId;
  return node;
}

function button(label: string, testId: string, onClick: () => void, secondary = true): HTMLButtonElement {
  const node = el('button', secondary ? 'menu-btn menu-btn--secondary grp-btn' : 'menu-btn grp-btn', label, testId);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

export class GroupsScreen {
  private screen: HTMLElement | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;
  private listBox: HTMLElement | null = null;
  private message: HTMLElement | null = null;

  constructor(private readonly root: HTMLElement) {}

  async show(api: GroupsApi, handlers: GroupsHandlers, notice?: string): Promise<void> {
    this.hide();
    const screen = el('section', 'menu-screen', undefined, 'groups-screen');
    const content = el('div', 'menu-content grp-content');
    screen.appendChild(content);

    content.appendChild(el('p', 'menu-kicker', 'Grupos'));
    content.appendChild(el('h1', 'menu-title', 'Seus grupos'));
    content.appendChild(
      el(
        'p',
        'menu-lead',
        'O ranking é por grupo: você compete com quem está no mesmo grupo. Você pode estar em vários e escolher qual aparece no ranking.',
      ),
    );

    const message = el('p', 'grp-message', notice ?? '', 'groups-message');
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    content.appendChild(message);
    this.message = message;

    const listBox = el('div', 'grp-list', undefined, 'groups-list');
    content.appendChild(listBox);
    this.listBox = listBox;

    content.appendChild(this.buildCreateForm(api, handlers));
    content.appendChild(this.buildJoinForm(api, handlers));

    const footer = el('div', 'menu-footer');
    footer.appendChild(button('Voltar ao ranking', 'groups-back', handlers.onBack));
    content.appendChild(footer);

    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handlers.onBack();
    };
    window.addEventListener('keydown', this.keyHandler);

    this.root.appendChild(screen);
    this.screen = screen;
    await this.refresh(api, handlers);
  }

  private say(text: string, ok = false): void {
    if (!this.message) return;
    this.message.textContent = text;
    this.message.classList.toggle('is-ok', ok);
  }

  /** Runs an action; a GroupError message is already meant for the player. */
  private async attempt(task: () => Promise<void>, okText?: string): Promise<boolean> {
    try {
      await task();
      if (okText) this.say(okText, true);
      return true;
    } catch (error) {
      this.say(error instanceof GroupError ? error.message : 'Não foi possível concluir agora. Tente de novo.');
      return false;
    }
  }

  private async refresh(api: GroupsApi, handlers: GroupsHandlers): Promise<void> {
    const box = this.listBox;
    if (!box) return;
    let groups: GroupInfo[] = [];
    const loaded = await this.attempt(async () => {
      groups = await api.list();
    });
    if (this.listBox !== box) return; // the screen was closed meanwhile
    box.replaceChildren();
    if (!loaded) return;
    if (groups.length === 0) {
      box.appendChild(
        el('p', 'rank-empty', 'Você ainda não está em nenhum grupo. Crie um ou entre com um convite.', 'groups-empty'),
      );
      return;
    }
    for (const group of groups) box.appendChild(this.buildGroup(group, api, handlers));
  }

  private buildGroup(group: GroupInfo, api: GroupsApi, handlers: GroupsHandlers): HTMLElement {
    const card = el('article', 'grp-card px-box', undefined, 'group-card');
    if (group.active) card.classList.add('grp-card--active');

    const head = el('div', 'grp-head');
    head.appendChild(el('h2', 'grp-name', group.name, 'group-name'));
    head.appendChild(el('span', 'grp-badge', group.role === 'owner' ? 'Dono' : 'Membro'));
    if (group.active) head.appendChild(el('span', 'grp-badge grp-badge--active', 'No ranking', 'group-active'));
    card.appendChild(head);

    const actions = el('div', 'grp-actions');
    const extra = el('div', 'grp-extra');

    if (!group.active) {
      actions.appendChild(
        button('Usar no ranking', 'group-use', () => {
          api.use(group.id);
          handlers.onActiveChanged?.();
          this.say(`Ranking agora mostra o grupo ${group.name}.`, true);
          void this.refresh(api, handlers);
        }, false),
      );
    }
    actions.appendChild(button('Membros', 'group-members', () => void this.toggleMembers(group, api, extra)));
    if (group.role === 'owner') {
      actions.appendChild(button('Gerar convite', 'group-invite', () => void this.showInvite(group, api, extra)));
    } else {
      let armed = false;
      const leave = button('Sair do grupo', 'group-leave', () => {
        if (!armed) {
          armed = true;
          leave.textContent = 'Confirmar saída';
          return;
        }
        void this.attempt(() => api.leave(group.id), `Você saiu de ${group.name}.`).then((done) => {
          if (done) {
            handlers.onActiveChanged?.();
            void this.refresh(api, handlers);
          } else {
            armed = false;
            leave.textContent = 'Sair do grupo';
          }
        });
      });
      actions.appendChild(leave);
    }
    card.appendChild(actions);
    card.appendChild(extra);
    return card;
  }

  private async showInvite(group: GroupInfo, api: GroupsApi, extra: HTMLElement): Promise<void> {
    let link = '';
    if (!(await this.attempt(async () => {
      link = await api.invite(group.id);
    }))) return;

    const box = el('div', 'grp-invite');
    box.appendChild(
      el('p', 'menu-hint', 'Compartilhe este link. Ele vale por 72 horas e serve para até 20 pessoas.'),
    );
    const row = el('div', 'rank-form-row');
    const input = el('input', 'rank-input', undefined, 'group-invite-link');
    input.type = 'text';
    input.readOnly = true;
    input.value = link;
    input.setAttribute('aria-label', 'Link de convite');
    input.addEventListener('focus', () => input.select());
    row.appendChild(input);
    row.appendChild(
      button('Copiar', 'group-invite-copy', () => {
        void navigator.clipboard
          ?.writeText(link)
          .then(() => this.say('Link copiado.', true))
          .catch(() => input.select());
        if (!navigator.clipboard) input.select();
      }, false),
    );
    box.appendChild(row);
    extra.replaceChildren(box);
  }

  private async toggleMembers(group: GroupInfo, api: GroupsApi, extra: HTMLElement): Promise<void> {
    if (extra.dataset.view === 'members') {
      extra.replaceChildren();
      delete extra.dataset.view;
      return;
    }
    let members: Awaited<ReturnType<GroupsApi['members']>> = [];
    if (!(await this.attempt(async () => {
        members = await api.members(group.id);
      }))) return;

    const list = el('ul', 'grp-members', undefined, 'group-member-list');
    for (const member of members) {
      const item = el('li', 'grp-member', undefined, 'group-member');
      const name = member.nickname ?? 'Sem apelido ainda';
      item.appendChild(el('span', 'grp-member-name', member.me ? `${name} (você)` : name));
      item.appendChild(el('span', 'grp-badge', member.role === 'owner' ? 'Dono' : 'Membro'));
      if (group.role === 'owner' && !member.me) {
        item.appendChild(
          button('Remover', 'group-remove', () => {
            void this.attempt(() => api.removeMember(group.id, member.userId), `${name} saiu do grupo.`).then((done) => {
              if (done) {
                delete extra.dataset.view;
                void this.toggleMembers(group, api, extra);
              }
            });
          }),
        );
      }
      list.appendChild(item);
    }
    extra.replaceChildren(list);
    extra.dataset.view = 'members';
  }

  private buildCreateForm(api: GroupsApi, handlers: GroupsHandlers): HTMLElement {
    const form = el('form', 'rank-form px-box', undefined, 'group-create-form');
    form.appendChild(el('label', 'rank-form-label', 'Criar um grupo'));
    const row = el('div', 'rank-form-row');
    const input = el('input', 'rank-input', undefined, 'group-create-input');
    input.type = 'text';
    input.maxLength = MAX_GROUP_NAME;
    input.autocomplete = 'off';
    input.placeholder = 'Nome do grupo (equipe, empresa, turma)';
    input.setAttribute('aria-label', 'Nome do grupo');
    row.appendChild(input);
    const submit = el('button', 'menu-btn', 'Criar', 'group-create-submit');
    submit.type = 'submit';
    row.appendChild(submit);
    form.appendChild(row);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submit.disabled = true;
      void this.attempt(() => api.create(input.value), 'Grupo criado. Gere um convite para chamar o pessoal.').then((done) => {
        submit.disabled = false;
        if (done) {
          input.value = '';
          handlers.onActiveChanged?.();
          void this.refresh(api, handlers);
        }
      });
    });
    return form;
  }

  private buildJoinForm(api: GroupsApi, handlers: GroupsHandlers): HTMLElement {
    const form = el('form', 'rank-form px-box', undefined, 'group-join-form');
    form.appendChild(el('label', 'rank-form-label', 'Entrar com um convite'));
    const row = el('div', 'rank-form-row');
    const input = el('input', 'rank-input', undefined, 'group-join-input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'Cole o link ou o código do convite';
    input.setAttribute('aria-label', 'Convite');
    row.appendChild(input);
    const submit = el('button', 'menu-btn', 'Entrar', 'group-join-submit');
    submit.type = 'submit';
    row.appendChild(submit);
    form.appendChild(row);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submit.disabled = true;
      void this.attempt(() => api.join(input.value), 'Pronto, você entrou no grupo.').then((done) => {
        submit.disabled = false;
        if (done) {
          input.value = '';
          handlers.onActiveChanged?.();
          void this.refresh(api, handlers);
        }
      });
    });
    return form;
  }

  hide(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    this.screen?.remove();
    this.screen = null;
    this.listBox = null;
    this.message = null;
  }
}
