import React from 'react';

export default function Toast({ toasts }) {
  return (
    <div className="toast-box" id="toast-box" aria-live="assertive">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.isError ? 'terr' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
