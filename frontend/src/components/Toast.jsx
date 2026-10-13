import React from 'react';

export default function Toast({ toasts }) {
  return (
    <div className="toast-container" id="toast-box" aria-live="assertive">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.isError ? 'error' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
