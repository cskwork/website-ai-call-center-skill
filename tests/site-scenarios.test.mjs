import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  CALL_SCENARIOS,
  getScenarioReply,
  getScenarioReplyForIntent,
  localizedScenario,
  matchCallScenario,
} from '../site/scenarios.js';

const root = new URL('../', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');

test('landing scenario catalog has visible management fields', () => {
  assert.equal(CALL_SCENARIOS.length, 4);
  assert.equal(CALL_SCENARIOS[0].id, 'audio');

  for (const scenario of CALL_SCENARIOS) {
    assert.match(scenario.id, /^[a-z-]+$/);
    assert.ok(scenario.title);
    assert.ok(scenario.scenario_intent);
    assert.ok(scenario.summary);
    assert.ok(scenario.phrase);
    assert.ok(scenario.replyText);
    assert.ok(scenario.workflow.issue_type);
    assert.ok(scenario.terms.length >= 3);
    assert.ok(scenario.actions.length >= 1);

    for (const action of scenario.actions) {
      assert.ok(action.id);
      assert.ok(action.label);
    }
  }
});

test('landing scenario catalog drives matching and replies', () => {
  const scenario = matchCallScenario('I cannot hear audio during a support call');
  assert.equal(scenario.id, 'audio');

  const reply = getScenarioReply('I cannot hear audio during a support call');
  assert.equal(reply.scenarioId, 'audio');
  assert.equal(reply.scenario_intent, 'audio_issue');
  assert.equal(reply.workflow.issue_type, 'technical_support');
  assert.match(reply.text, /audio setup/i);
  assert.deepEqual(reply.actions.map((action) => action.id), ['show-audio', 'run-checks']);
});

test('landing scenario catalog can be resolved by detected intent', () => {
  const reply = getScenarioReplyForIntent('audio_issue');
  assert.equal(reply.scenarioId, 'audio');
  assert.equal(reply.scenario_intent, 'audio_issue');
  assert.deepEqual(reply.actions.map((action) => action.id), ['show-audio', 'run-checks']);
});

test('scenario catalog carries a localized en/ko view with ko labels', () => {
  for (const scenario of CALL_SCENARIOS) {
    assert.ok(scenario.localized, `${scenario.id} must expose a localized map`);
    for (const locale of ['en', 'ko']) {
      const view = scenario.localized[locale];
      assert.ok(view.title, `${scenario.id}.${locale} title`);
      assert.ok(view.buttonLabel, `${scenario.id}.${locale} buttonLabel`);
      assert.ok(view.summary, `${scenario.id}.${locale} summary`);
      assert.ok(view.replyText, `${scenario.id}.${locale} replyText`);
      assert.deepEqual(
        view.actions.map((action) => action.id),
        scenario.actions.map((action) => action.id),
        `${scenario.id}.${locale} action ids must match EN ids`,
      );
      for (const action of view.actions) assert.ok(action.label);
    }
  }

  const audio = CALL_SCENARIOS.find((scenario) => scenario.id === 'audio');
  assert.equal(audio.localized.ko.title, '오디오 설정');
  assert.equal(audio.localized.ko.actions[0].label, '오디오 설정 보기');
  assert.notEqual(audio.localized.ko.title, audio.localized.en.title);
});

test('terms are the union of en and ko keywords for locale-agnostic matching', () => {
  const audio = CALL_SCENARIOS.find((scenario) => scenario.id === 'audio');
  assert.ok(audio.terms.includes('audio'));
  assert.ok(audio.terms.includes('오디오'));
  assert.equal(new Set(audio.terms).size, audio.terms.length, 'terms must be deduped');
});

test('korean input matches scenarios via union terms', () => {
  assert.equal(matchCallScenario('소리가 안 나와요').id, 'audio');
  assert.equal(matchCallScenario('계정 설정을 못 찾겠어요').id, 'account');
});

test('getScenarioReply returns localized ko text and labels with en fallback', () => {
  const en = getScenarioReply('I cannot hear audio during a support call');
  assert.equal(en.scenarioId, 'audio');
  assert.match(en.text, /audio setup/i);
  assert.equal(en.actions[0].label, 'Show audio setup');

  const ko = getScenarioReply('I cannot hear audio during a support call', 'ko');
  assert.equal(ko.scenarioId, 'audio');
  assert.equal(ko.text, '오디오 설정을 안내해 드릴게요. 헤드셋 패널부터 확인하고, 그래도 음성이 안 되면 브라우저 점검을 실행하세요.');
  assert.deepEqual(ko.actions.map((action) => action.label), ['오디오 설정 보기', '브라우저 점검 실행']);
  assert.deepEqual(ko.actions.map((action) => action.id), ['show-audio', 'run-checks']);
});

test('getScenarioReplyForIntent localizes by intent', () => {
  const ko = getScenarioReplyForIntent('audio_issue', 'ko');
  assert.equal(ko.scenarioId, 'audio');
  assert.equal(ko.text, '오디오 설정을 안내해 드릴게요. 헤드셋 패널부터 확인하고, 그래도 음성이 안 되면 브라우저 점검을 실행하세요.');
});

test('unmatched ko input falls back to the localized default scenario', () => {
  const ko = getScenarioReply('완전히 관련 없는 문장입니다', 'ko');
  assert.equal(ko.scenarioId, 'default');
  assert.equal(ko.text, '이 정적 페이지를 안내해 드릴게요. 오디오 설정, 계정 설정, 진단, 티켓 작성 중에서 시도해 보세요.');
  assert.deepEqual(ko.actions.map((action) => action.label), ['오디오 설정 보기', '브라우저 점검 실행']);
});

test('localizedScenario returns a per-locale view with en fallback', () => {
  const audio = CALL_SCENARIOS.find((scenario) => scenario.id === 'audio');
  const ko = localizedScenario(audio, 'ko');
  assert.equal(ko.title, '오디오 설정');
  assert.equal(ko.buttonLabel, '소리가 안 나와요');
  assert.equal(ko.phrase, '상담 중에 소리가 안 들려요');
  assert.equal(ko.actions[0].label, '오디오 설정 보기');
  assert.ok(ko.terms.includes('오디오'));

  const en = localizedScenario(audio);
  assert.equal(en.title, 'Audio setup');
  assert.equal(en.actions[0].label, 'Show audio setup');
});

test('landing page exposes the scenario catalog instead of hiding it in code', () => {
  assert.match(read('site/index.html'), /id="scenario-catalog"/);
  assert.match(read('site/index.html'), /Call scenario catalog/);
  assert.match(read('site/landing.js'), /from '\.\/scenarios\.js'/);
});

test('scenario action ids are registered by the landing page', () => {
  const registered = new Set(
    [...read('site/landing.js').matchAll(/register\(\{\s*id: '([^']+)'/g)].map((match) => match[1]),
  );
  const scenarioActionIds = CALL_SCENARIOS.flatMap((scenario) => scenario.actions.map((action) => action.id));

  for (const actionId of scenarioActionIds) {
    assert.ok(registered.has(actionId), `${actionId} must be registered in site/landing.js`);
  }
});
