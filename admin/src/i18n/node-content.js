// Plain-language help content for the 8 node kinds, shown in tooltips, the
// palette, the inspector, and the help-panel legend. This is NEW display content
// (not engine-coupled): the English KIND label still comes from node-kinds.js;
// here we add a Korean label override, a one-line description (en+ko), per-field
// help (en+ko), and a color accent so non-technical users can tell blocks apart.
// Pure data (no React, no engine import) keyed by the same kind strings.

import { NODE_KIND_LIST, NODE_KINDS } from '../lib/node-kinds.js';

/**
 * @typedef {Object} FieldContent
 * @property {{ ko?: string }} [label]  Korean label override (English from node-kinds).
 * @property {{ en: string, ko: string }} help  Plain-language field help.
 */
/**
 * @typedef {Object} NodeContent
 * @property {string} accent  Hex color used as the block's left accent.
 * @property {{ ko: string }} label  Korean label override (English from node-kinds).
 * @property {{ en: string, ko: string }} desc  One-line "what this block does".
 * @property {Record<string, FieldContent>} fields  Per-field help keyed by field.key.
 */

/** @type {Readonly<Record<string, NodeContent>>} */
export const NODE_CONTENT = Object.freeze({
  start: {
    accent: '#10b981',
    label: { ko: '시작' },
    desc: {
      en: 'Where every conversation begins. Connect its arrow to the first block. You need exactly one.',
      ko: '모든 대화가 시작되는 지점. 화살표를 첫 블록에 연결하세요. 정확히 하나만 둡니다.',
    },
    fields: {},
  },
  message: {
    accent: '#3b82f6',
    label: { ko: '메시지' },
    desc: {
      en: 'The assistant says something to the caller, then moves on. Use it for greetings, info, and instructions.',
      ko: '어시스턴트가 발신자에게 말한 뒤 다음으로 넘어갑니다. 인사·안내·설명에 사용하세요.',
    },
    fields: {
      text: {
        label: { ko: '메시지 문구 (영어)' },
        help: {
          en: 'What the assistant says, in English. This is the default wording.',
          ko: '어시스턴트가 말할 내용(영어). 기본 문구입니다.',
        },
      },
      'i18n.ko.text': {
        label: { ko: '메시지 문구 (한국어)' },
        help: {
          en: 'Optional Korean version. Shown when the caller is using Korean.',
          ko: '선택적 한국어 버전. 발신자가 한국어를 쓸 때 표시됩니다.',
        },
      },
    },
  },
  'intent-branch': {
    accent: '#8b5cf6',
    label: { ko: '의도 분기' },
    desc: {
      en: 'Splits the conversation by what the caller wants. Draw one arrow per intent out of this block.',
      ko: '발신자가 원하는 바에 따라 대화를 나눕니다. 의도마다 화살표를 하나씩 그려 내보내세요.',
    },
    fields: {
      fallback: {
        label: { ko: '대체 문구 (인식 실패 시)' },
        help: {
          en: 'What the assistant says when it cannot match the caller to any intent. Ask them to rephrase.',
          ko: '어떤 의도와도 맞추지 못했을 때 하는 말. 다시 말해 달라고 요청하세요.',
        },
      },
    },
  },
  'slot-fill': {
    accent: '#f59e0b',
    label: { ko: '정보 수집' },
    desc: {
      en: 'Collects and remembers one piece of info from the caller (a "slot"), e.g. an account number or date.',
      ko: '발신자에게서 정보 한 가지("슬롯")를 받아 기억합니다. 예: 계좌번호, 날짜.',
    },
    fields: {
      slot: {
        label: { ko: '슬롯 이름' },
        help: {
          en: 'A short name for the value you are collecting, e.g. "account_number". Used later in conditions.',
          ko: '수집하는 값의 짧은 이름, 예: "account_number". 이후 조건에서 사용됩니다.',
        },
      },
      entity: {
        label: { ko: '엔티티 키 (기본값: 슬롯 이름)' },
        help: {
          en: 'Which detected entity fills this slot. Leave blank to use the slot name itself.',
          ko: '이 슬롯을 채울 감지 엔티티. 비우면 슬롯 이름을 그대로 사용합니다.',
        },
      },
    },
  },
  action: {
    accent: '#ef4444',
    label: { ko: '액션' },
    desc: {
      en: 'Runs a pre-registered safe action on your page, e.g. open a panel or fill a form. It cannot run arbitrary code.',
      ko: '페이지에 미리 등록된 안전한 동작을 실행합니다. 예: 패널 열기, 폼 채우기. 임의 코드는 실행하지 않습니다.',
    },
    fields: {
      actionId: {
        label: { ko: '액션 id' },
        help: {
          en: 'The id of an action your website registered, e.g. "open-billing". Must match exactly.',
          ko: '웹사이트가 등록한 액션의 id, 예: "open-billing". 정확히 일치해야 합니다.',
        },
      },
      label: {
        label: { ko: '액션 버튼 문구' },
        help: {
          en: 'The button text the caller sees for this action, e.g. "Open billing".',
          ko: '발신자가 보는 이 액션의 버튼 문구, 예: "결제 열기".',
        },
      },
    },
  },
  'ai-disclosure': {
    accent: '#0ea5e9',
    label: { ko: 'AI 고지' },
    desc: {
      en: 'Tells the caller they are talking to AI. Shown once at the start. Many regions require this.',
      ko: '발신자에게 AI와 대화 중임을 알립니다. 시작 시 한 번 표시됩니다. 많은 지역에서 필수입니다.',
    },
    fields: {},
  },
  handoff: {
    accent: '#ec4899',
    label: { ko: '상담원 연결' },
    desc: {
      en: 'Signals that a human should take over, and tells the caller so. Use for escalations.',
      ko: '사람이 이어받아야 함을 알리고 발신자에게 안내합니다. 상담원 연결 시 사용하세요.',
    },
    fields: {
      text: {
        label: { ko: '연결 안내 문구' },
        help: {
          en: 'What the assistant says while handing off to a person, e.g. "Connecting you to an agent…".',
          ko: '사람에게 연결하는 동안 하는 말, 예: "상담원에게 연결해 드릴게요…".',
        },
      },
    },
  },
  end: {
    accent: '#6b7280',
    label: { ko: '종료' },
    desc: {
      en: 'Marks the end of a path. The conversation stops here until the caller speaks again.',
      ko: '경로의 끝을 표시합니다. 발신자가 다시 말하기 전까지 대화가 여기서 멈춥니다.',
    },
    fields: {},
  },
});

/**
 * Localized display label for a node kind. English comes from node-kinds.js
 * (the engine-coupled source); Korean from the override above.
 * @param {string} kind
 * @param {'en'|'ko'} locale
 * @returns {string}
 */
export function nodeLabel(kind, locale) {
  const fallback = NODE_KINDS[kind]?.label ?? kind;
  if (locale === 'ko') return NODE_CONTENT[kind]?.label?.ko ?? fallback;
  return fallback;
}

/**
 * One-line plain-language description for a node kind ('' when unknown).
 * @param {string} kind
 * @param {'en'|'ko'} locale
 * @returns {string}
 */
export function nodeDescription(kind, locale) {
  const desc = NODE_CONTENT[kind]?.desc;
  if (!desc) return '';
  return locale === 'ko' ? desc.ko : desc.en;
}

/** Accent color for a node kind (neutral gray when unknown). @param {string} kind @returns {string} */
export function nodeAccent(kind) {
  return NODE_CONTENT[kind]?.accent ?? '#9aa5b1';
}

/**
 * Localized label for a node field. English from node-kinds.js; Korean override
 * from the content map when present.
 * @param {string} kind
 * @param {{ key: string, label: string }} field
 * @param {'en'|'ko'} locale
 * @returns {string}
 */
export function fieldLabel(kind, field, locale) {
  if (locale === 'ko') return NODE_CONTENT[kind]?.fields?.[field.key]?.label?.ko ?? field.label;
  return field.label;
}

/**
 * Plain-language help for a node field ('' when none defined).
 * @param {string} kind
 * @param {string} fieldKey
 * @param {'en'|'ko'} locale
 * @returns {string}
 */
export function fieldHelp(kind, fieldKey, locale) {
  const help = NODE_CONTENT[kind]?.fields?.[fieldKey]?.help;
  if (!help) return '';
  return locale === 'ko' ? help.ko : help.en;
}

/** All kinds, in palette order — re-exported so the legend stays in lock-step. */
export { NODE_KIND_LIST };
