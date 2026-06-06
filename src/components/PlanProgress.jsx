import React from 'react';

const STEP_ICONS = {
  pending: '○',
  running: '▶',
  completed: '✅',
  error: '❌',
};

const STEP_LABELS = {
  get_db_schema: '🗄️ DB 구조 확인',
  execute_sql: '🔎 데이터 분석',
  render_ui: '🎨 UI 생성',
  add_property_tag: '🏷️ 태그 추가',
  remove_property_tag: '🏷️ 태그 제거',
  update_booking_status: '🔄 상태 변경',
};

function getStepLabel(step) {
  if (!step) return '';
  // If already a friendly label (starts with emoji or contains 한글), use as-is
  if (/^[🌀📋🗄️🔎🎨🏷️🔄📊📈📐📅📋🧪✅▶️○💰]/.test(step) || /[가-힣]/.test(step)) {
    return step;
  }
  // Raw tool name like "execute_sql()" or "get_db_schema()"
  const name = step.split('(')[0];
  return STEP_LABELS[name] || `🔧 ${name}`;
}

export default function PlanProgress({ plan, currentStep, completedSteps }) {
  if (!plan || plan.length === 0) return null;

  const steps = plan.map((step, i) => {
    let status = 'pending';
    if (completedSteps) {
      if (completedSteps instanceof Set && completedSteps.has(i)) status = 'completed';
      else if (Array.isArray(completedSteps) && completedSteps.includes(i)) status = 'completed';
    }
    if (currentStep === i) status = 'running';
    return { index: i, text: step, status };
  });

  const allDone = steps.every(s => s.status === 'completed');

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius)',
      padding: '10px 14px',
      marginBottom: 8,
      fontSize: 11,
      border: '1px solid var(--border-light)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: steps.length > 1 ? 8 : 0,
        color: 'var(--text-secondary)',
        fontWeight: 500,
        fontSize: 11,
      }}>
        {allDone ? '✅ AI 실행 완료' : '📋 AI 실행 계획'}
      </div>
      {steps.map((step) => (
        <div
          key={step.index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 0',
            opacity: step.status === 'pending' ? 0.5 : 1,
            color: step.status === 'error' ? 'var(--danger)' :
                   step.status === 'running' ? 'var(--accent)' :
                   'var(--text-primary)',
          }}
        >
          <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>
            {STEP_ICONS[step.status]}
          </span>
          <span style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: step.status === 'running' ? 600 : 400,
          }}>
            {getStepLabel(step.text)}
          </span>
          {step.status === 'running' && (
            <span className="typing-indicator" style={{ fontSize: 10, marginLeft: 4 }}>
              <span>.</span><span>.</span><span>.</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
