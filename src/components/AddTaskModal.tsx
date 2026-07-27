import React, { useState } from 'react';
import { useI18n } from '../i18n';
import './AddTaskModal.css';

interface Props {
  onClose: () => void;
  onSubmit: (task: {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    deadline: string;
    source: 'manual';
    sender: string;
  }) => void;
}

export function AddTaskModal({ onClose, onSubmit }: Props) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [deadline, setDeadline] = useState('');
  const [sender, setSender] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      deadline: deadline || '',
      source: 'manual' as const,
      sender: sender.trim() || t.addTask.defaultSender,
    });
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="atm-overlay" onClick={handleOverlayClick}>
      <div className="atm-modal">
        <div className="atm-header">
          <h2>{t.addTask.title}</h2>
          <button className="atm-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="atm-field">
            <label>{t.addTask.taskTitle} <span className="atm-required">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t.addTask.titlePlaceholder}
              autoFocus
              required
            />
          </div>
          <div className="atm-field">
            <label>{t.addTask.description}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t.addTask.descPlaceholder}
              rows={3}
            />
          </div>
          <div className="atm-row">
            <div className="atm-field atm-flex-1">
              <label>{t.addTask.priority}</label>
              <select value={priority} onChange={e => setPriority(e.target.value as any)}>
                <option value="high">{t.common.priorityHigh}</option>
                <option value="medium">{t.common.priorityMedium}</option>
                <option value="low">{t.common.priorityLow}</option>
              </select>
            </div>
            <div className="atm-field atm-flex-1">
              <label>{t.addTask.deadline}</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="atm-field">
            <label>{t.addTask.sender}</label>
            <input
              type="text"
              value={sender}
              onChange={e => setSender(e.target.value)}
              placeholder={t.addTask.senderPlaceholder}
            />
          </div>
          <div className="atm-actions">
            <button type="button" className="atm-btn-cancel" onClick={onClose}>{t.addTask.cancel}</button>
            <button type="submit" className="atm-btn-submit" disabled={!title.trim()}>{t.addTask.submit}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
