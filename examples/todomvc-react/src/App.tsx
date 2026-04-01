import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AgentProvider } from '@aicorg/sdk-react';
import { Header } from './components/Header';
import { Main } from './components/Main';
import { Footer } from './components/Footer';
import type { Todo, FilterType } from './types';

const App = () => {
  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      const saved = localStorage.getItem('todomvc-react-todos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    localStorage.setItem('todomvc-react-todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = (title: string) => {
    setTodos([{ id: uuidv4(), title, completed: false }, ...todos]);
  };

  const toggleAll = (completed: boolean) => {
    setTodos(todos.map((t) => ({ ...t, completed })));
  };

  const toggle = (id: string) => {
    setTodos(todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const destroy = (id: string) => {
    setTodos(todos.filter((t) => t.id !== id));
  };

  const updateTitle = (id: string, title: string) => {
    setTodos(todos.map((t) => (t.id === id ? { ...t, title } : t)));
  };

  const clearCompleted = () => {
    setTodos(todos.filter((t) => !t.completed));
  };

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.length - activeCount;

  const filteredTodos = todos.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  return (
    <AgentProvider>
      <section className="todoapp">
        <Header addTodo={addTodo} />
        <Main
          todos={filteredTodos}
          toggleAll={toggleAll}
          toggle={toggle}
          destroy={destroy}
          updateTitle={updateTitle}
        />
        {todos.length > 0 && (
          <Footer
            activeCount={activeCount}
            completedCount={completedCount}
            filter={filter}
            setFilter={setFilter}
            clearCompleted={clearCompleted}
          />
        )}
      </section>
      <footer className="info">
        <p>Double-click to edit a todo</p>
        <p>Created with AIC to demonstrate AI operability</p>
      </footer>
    </AgentProvider>
  );
};

export default App;
