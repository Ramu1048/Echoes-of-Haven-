import React, { useEffect } from 'react';

export default function HotspotModal({ hotspot, onClose }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!hotspot) return null;

  return (
    <div className="world-modal active" id="world-modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title" dangerouslySetInnerHTML={{ __html: hotspot.title }} />
        <div className="modal-body" dangerouslySetInnerHTML={{ __html: hotspot.desc }} />
        <button className="modal-close-btn" onClick={onClose}>
          Close [ESC]
        </button>
      </div>
    </div>
  );
}
