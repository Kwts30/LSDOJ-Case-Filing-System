(function () {
  const iconMap = {
    account_circle: 'user',
    dashboard: 'grid',
    logout: 'log-out',
    login: 'log-in',
    folder_open: 'folder',
    description: 'file-text',
    group: 'users',
    history: 'clock',
    check_circle: 'check-circle',
    schedule: 'clock',
    preview: 'eye',
    image_not_supported: 'image',
    arrow_forward: 'arrow-right',
    person: 'user',
    refresh: 'refresh-cw',
    info: 'info',
    error_outline: 'alert-triangle',
    home: 'home',
    arrow_back: 'arrow-left',
    gavel: 'shield',
    error: 'alert-circle',
    shield_admin: 'shield',
    add_circle: 'user-plus',
    favorite: 'heart',
    article: 'file-text',
    business: 'briefcase'
  };

  function toPx(value, fallback) {
    return value && value !== '0px' ? value : fallback;
  }

  function replaceIcons() {
    if (!window.feather || !window.feather.icons) return;

    document.querySelectorAll('.material-icons').forEach((el) => {
      const token = (el.textContent || '').trim();
      const featherName = iconMap[token];
      if (!featherName || !window.feather.icons[featherName]) return;

      const styles = window.getComputedStyle(el);
      const size = toPx(styles.fontSize, '24px');
      const color = styles.color || 'currentColor';

      const svg = window.feather.icons[featherName].toSvg({
        width: size,
        height: size,
        stroke: color,
        'stroke-width': 2,
        class: 'icon-svg'
      });

      el.innerHTML = svg;
      el.classList.add('icon-replaced');
      el.style.fontSize = '0';
      el.style.lineHeight = '0';
      el.setAttribute('aria-hidden', 'true');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', replaceIcons);
  } else {
    replaceIcons();
  }
})();
