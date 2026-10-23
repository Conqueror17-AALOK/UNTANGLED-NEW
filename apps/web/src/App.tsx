import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/router';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
};

export default App;
