import React, { useState } from 'react';
import { AICInput, AICButton } from '@aicorg/sdk-react';
import type { Todo } from '../types';

interface Props {
  todos: Todo[];
  toggleAll: (completed: boolean) => void;
  toggle: (id: string) => void;
  destroy: (id: string) => void;
  updateTitle: (id: string, title: string) => void;
}

export const Main: React.FC<Props> = ({ todos, toggleAll, toggle, destroy, updateTitle }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const activeTodoCount = todos.reduce((accum, todo) => (todo.completed ? accum : accum + 1), 0);

  if (todos.length === 0) {
    return null;
  }

  const handleEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.title);
  };

  const handleSubmit = () => {
    if (editingId) {
      const trimmed = editText.trim();
      if (trimmed) {
        updateTitle(editingId, trimmed);
      } else {
        destroy(editingId);
      }
      setEditingId(null);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <section className="main">
      <AICInput
        id="toggle-all"
        className="toggle-all"
        type="checkbox"
        checked={activeTodoCount === 0}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => toggleAll(e.target.checked)}
        agentId="toggle-all"
        agentAction="click"
        agentDescription="Toggle all items as completed or active"
      />
      <label htmlFor="toggle-all">Mark all as complete</label>
      <ul className="todo-list">
        {todos.map((todo) => {
          const isEditing = editingId === todo.id;
          const classes = [];
          if (todo.completed) classes.push('completed');
          if (isEditing) classes.push('editing');

          return (
            <li key={todo.id} className={classes.join(' ')}>
              <div className="view">
                <AICInput
                  className="toggle"
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggle(todo.id)}
                  agentId={`todo-toggle-${todo.id}`}
                  agentAction="click"
                  agentDescription={`Toggle completion status of "${todo.title}"`}
                  agentEntityId={todo.id}
                  agentEntityType="todo"
                  agentEntityLabel={todo.title}
                />
                <label onDoubleClick={() => handleEdit(todo)}>{todo.title}</label>
                <AICButton
                  className="destroy"
                  onClick={() => destroy(todo.id)}
                  agentId={`todo-destroy-${todo.id}`}
                  agentAction="click"
                  agentDescription={`Delete todo "${todo.title}"`}
                  agentEntityId={todo.id}
                  agentEntityType="todo"
                  agentEntityLabel={todo.title}
                />
              </div>
              {isEditing && (
                <AICInput
                  className="edit"
                  value={editText}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditText(e.target.value)}
                  onBlur={handleSubmit}
                  onKeyDown={handleEditKeyDown}
                  autoFocus
                  agentId={`todo-edit-${todo.id}`}
                  agentAction="input"
                  agentDescription={`Edit title for todo "${todo.title}"`}
                  agentEntityId={todo.id}
                  agentEntityType="todo"
                  agentEntityLabel={todo.title}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
