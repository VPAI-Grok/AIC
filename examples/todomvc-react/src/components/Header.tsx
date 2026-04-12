import React, { useState } from 'react';
import { AICInput } from '@aicorg/sdk-react';
import { NEW_TODO_INPUT_PROPS } from '../todo-contract.js';

interface Props {
  addTodo: (title: string) => void;
}

export const Header: React.FC<Props> = ({ addTodo }) => {
  const [title, setTitle] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = title.trim();
      if (trimmed.length > 0) {
        addTodo(trimmed);
        setTitle('');
      }
    }
  };

  return (
    <header className="header">
      <h1>todos</h1>
      <AICInput
        {...NEW_TODO_INPUT_PROPS}
        className="new-todo"
        placeholder="What needs to be done?"
        autoFocus
        value={title}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </header>
  );
};
