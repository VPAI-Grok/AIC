import React, { useState } from 'react';
import { AICInput } from '@aicorg/sdk-react';

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
        className="new-todo"
        placeholder="What needs to be done?"
        autoFocus
        value={title}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        agentId="new-todo-input"
        agentAction="input"
        agentDescription="Input field to add a new todo. Type your todo and hit enter."
      />
    </header>
  );
};
