import React from 'react';
import { AICButton } from '@aicorg/sdk-react';
import type { FilterType } from '../types';

interface Props {
  completedCount: number;
  activeCount: number;
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  clearCompleted: () => void;
}

export const Footer: React.FC<Props> = ({
  completedCount,
  activeCount,
  filter,
  setFilter,
  clearCompleted,
}) => {
  const itemWord = activeCount === 1 ? 'item' : 'items';

  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{activeCount}</strong> {itemWord} left
      </span>
      <ul className="filters">
        <li>
          <AICButton
            as="a"
            href="#/"
            className={filter === 'all' ? 'selected' : ''}
            onClick={(e: React.MouseEvent) => { e.preventDefault(); setFilter('all'); }}
            agentId="filter-all"
            agentAction="click"
            agentDescription="Show all todo items"
          >
            All
          </AICButton>
        </li>
        <li>
          <AICButton
            as="a"
            href="#/active"
            className={filter === 'active' ? 'selected' : ''}
            onClick={(e: React.MouseEvent) => { e.preventDefault(); setFilter('active'); }}
            agentId="filter-active"
            agentAction="click"
            agentDescription="Show only active (uncompleted) todo items"
          >
            Active
          </AICButton>
        </li>
        <li>
          <AICButton
            as="a"
            href="#/completed"
            className={filter === 'completed' ? 'selected' : ''}
            onClick={(e: React.MouseEvent) => { e.preventDefault(); setFilter('completed'); }}
            agentId="filter-completed"
            agentAction="click"
            agentDescription="Show only completed todo items"
          >
            Completed
          </AICButton>
        </li>
      </ul>
      {completedCount > 0 && (
        <AICButton
          className="clear-completed"
          onClick={clearCompleted}
          agentId="clear-completed"
          agentAction="click"
          agentDescription="Clear all completed todo items"
        >
          Clear completed
        </AICButton>
      )}
    </footer>
  );
};
