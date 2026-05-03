
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import FeedSheet from './components/FeedSheet';
import Reports from './components/Reports';
import Settings from './components/Settings';
import AnimalMovementPage from './components/AnimalMovement';
import LotDatabase from './components/LotDatabase';
import Nutrition from './components/Nutrition';
import { AppProvider } from './context';

const App: React.FC = () => {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="feed" element={<FeedSheet />} />
            <Route path="database" element={<LotDatabase />} />
            <Route path="nutrition" element={<Nutrition />} />
            <Route path="movements" element={<AnimalMovementPage />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
};

export default App;
