import { useId, useState } from 'react';

import { useI18n } from '../i18n/context.jsx';

/**
 * Small accessible info affordance: a "?" button that reveals help text on
 * hover, focus, or click (touch). Esc dismisses. The help text is linked via
 * aria-describedby so screen readers announce it. The trigger's accessible name
 * names its topic ("Help: Export") so it stays distinct from the control it
 * annotates. Content renders as React text children only (auto-escaped).
 *
 * @param {{ content: string, label?: string }} props
 *   content: the help text. label: the topic this help is about (used to build
 *   the trigger's accessible name).
 */
export function Tooltip({ content, label }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!content) return null;
  const ariaLabel = label ? t('tip.help').replace('{topic}', label) : t('tip.helpGeneric');
  return (
    <span className="tip">
      <button
        type="button"
        className="tip-trigger"
        aria-label={ariaLabel}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        ?
      </button>
      {open && (
        <span role="tooltip" id={id} className="tip-bubble">
          {content}
        </span>
      )}
    </span>
  );
}
