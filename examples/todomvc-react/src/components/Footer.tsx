import React from 'react';
import { AICButton } from '@aicorg/sdk-react';
import type { FilterType } from '../types';
import {
  createClearCompletedProps,
  FILTER_ACTIVE_PROPS,
  FILTER_ALL_PROPS,
  FILTER_COMPLETED_PROPS,
} from '../todo-contract.js';

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
            {...FILTER_ALL_PROPS}
            as="a"
            href="#/"
            className={filter === 'all' ? 'selected' : ''}
            onClick={(e: React.MouseEvent) => { e.preventDefault(); setFilter('all'); }}
          >
            All
          </AICButton>
        </li>
        <li>
          <AICButton
            {...FILTER_ACTIVE_PROPS}
            as="a"
            href="#/active"
            className={filter === 'active' ? 'selected' : ''}
            onClick={(e: React.MouseEvent) => { e.preventDefault(); setFilter('active'); }}
          >
            Active
          </AICButton>
        </li>
        <li>
          <AICButton
            {...FILTER_COMPLETED_PROPS}
            as="a"
            href="#/completed"
            className={filter === 'completed' ? 'selected' : ''}
            onClick={(e: React.MouseEvent) => { e.preventDefault(); setFilter('completed'); }}
          >
            Completed
          </AICButton>
        </li>
      </ul>
      {completedCount > 0 && (
        <AICButton
          {...createClearCompletedProps(completedCount)}
          className="clear-completed"
          onClick={clearCompleted}
        >
          Clear completed
        </AICButton>
      )}
    </footer>
  );
};
