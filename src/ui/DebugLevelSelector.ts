type Destination = { id: string; name: string };
export interface DebugSettings {
  infiniteDash: boolean;
}

/** Available in the deployed game only while the URL fragment is exactly #debug. */
export class DebugLevelSelector {
  private form?: HTMLFormElement;
  private select?: HTMLSelectElement;

  constructor(
    private readonly host: HTMLElement,
    private readonly levels: readonly Destination[],
    private currentLevel: Destination,
    private readonly onLoad: (level: Destination) => void,
    private readonly settings: DebugSettings,
  ) {
    window.addEventListener('hashchange', this.refresh);
    this.refresh();
  }

  setLevel(level: Destination) {
    this.currentLevel = level;
    if (this.select) this.select.value = level.id;
  }
  get infiniteDash() {
    return location.hash === '#debug' && this.settings.infiniteDash;
  }

  private refresh = () => {
    if (location.hash !== '#debug') {
      this.settings.infiniteDash = false;
      this.remove();
      return;
    }
    if (this.form) return;
    this.form = document.createElement('form');
    this.form.className = 'debug-level-selector';
    this.form.setAttribute('aria-label', 'Debug level selector');
    const label = document.createElement('label');
    label.textContent = 'DEBUG LEVEL';
    this.select = document.createElement('select');
    this.select.setAttribute('aria-label', 'Debug level');
    this.levels.forEach((level) => {
      this.select!.add(new Option(level.name, level.id));
    });
    this.select.value = this.currentLevel.id;
    label.append(this.select);
    const load = document.createElement('button');
    load.type = 'submit';
    load.textContent = 'Load';
    const infiniteLabel = document.createElement('label');
    infiniteLabel.className = 'debug-infinite-dash';
    const infinite = document.createElement('input');
    infinite.type = 'checkbox';
    infinite.checked = this.settings.infiniteDash;
    infinite.addEventListener('change', () => {
      this.settings.infiniteDash =
        location.hash === '#debug' && infinite.checked;
      infinite.blur();
    });
    infiniteLabel.append(infinite, 'Infinite dash');
    this.form.append(label, load, infiniteLabel);
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      const level = this.levels.find(
        (entry) => entry.id === this.select!.value,
      );
      if (location.hash !== '#debug' || !level) return;
      this.onLoad(level);
      (document.activeElement as HTMLElement)?.blur();
    });
    this.host.classList.add('debug-mode');
    this.host.querySelector('.chapter')!.after(this.form);
  };

  private remove() {
    this.form?.remove();
    this.form = undefined;
    this.select = undefined;
    this.host.classList.remove('debug-mode');
  }

  destroy() {
    window.removeEventListener('hashchange', this.refresh);
    this.remove();
  }
}
