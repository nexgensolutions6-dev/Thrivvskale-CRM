import { useState, type DragEvent } from 'react';
import { STAGES, firstName, followUp } from '../lib/format';
import type { Lead, Stage } from '../types';
import { QualifiedBadge, SourceChip, TemperatureBadge } from './Badges';

interface Props {
  leads: Lead[];
  onOpen: (id: number) => void;
  onMove: (lead: Lead, stage: Stage) => void;
}

const DRAG_TYPE = 'text/plain';

function Card({ lead, onOpen }: { lead: Lead; onOpen: Props['onOpen'] }) {
  const due = followUp(lead);
  const startDrag = (event: DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, String(lead.id));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <li>
      <button className="kanban-card" draggable onDragStart={startDrag} onClick={() => onOpen(lead.id)}>
        <span className="kanban-card-head">
          <strong>{lead.name}</strong>
          <TemperatureBadge value={lead.temperature} />
        </span>
        <small className="lead-company">{lead.company ?? lead.phone ?? '—'}</small>
        <span className="kanban-card-tags">
          <SourceChip value={lead.source} />
          <QualifiedBadge value={lead.qualified} />
        </span>
        <span className="kanban-card-foot">
          <span>{firstName(lead.assigned_to_name)}</span>
          <span className={`due due-${due.tone}`} title={due.title}>{due.label}</span>
        </span>
      </button>
    </li>
  );
}

export function KanbanBoard({ leads, onOpen, onMove }: Props) {
  const [target, setTarget] = useState<Stage | null>(null);

  const drop = (event: DragEvent, stage: Stage) => {
    event.preventDefault();
    setTarget(null);
    const lead = leads.find((item) => item.id === Number(event.dataTransfer.getData(DRAG_TYPE)));
    if (lead && lead.stage !== stage) onMove(lead, stage);
  };

  return (
    <div className="kanban">
      {STAGES.map((stage) => {
        const items = leads.filter((lead) => lead.stage === stage.key);
        return (
          <section
            key={stage.key}
            className={`kanban-column ${target === stage.key ? 'drop-target' : ''}`}
            aria-label={`${stage.label}, ${items.length} leads`}
            onDragOver={(e) => { e.preventDefault(); setTarget(stage.key); }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setTarget(null);
            }}
            onDrop={(e) => drop(e, stage.key)}
          >
            <header>
              <h3>{stage.label}</h3>
              <span className="kanban-count">{items.length}</span>
            </header>
            <ul>
              {items.map((lead) => <Card key={lead.id} lead={lead} onOpen={onOpen} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
