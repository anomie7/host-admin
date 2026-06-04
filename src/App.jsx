import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PropertyList from './components/PropertyList';
import PropertyForm from './components/PropertyForm';
import CalendarView from './components/CalendarView';
import CanvasPage from './components/CanvasPage';
import SidePanel from './components/SidePanel';
import { ToastProvider } from './components/Toast';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={
          <Layout title="대시보드">
            <Dashboard />
          </Layout>
        } />
        <Route path="/properties" element={
          <Layout title="숙소 목록">
            <PropertyList />
          </Layout>
        } />
        <Route path="/properties/new" element={
          <Layout title="새 숙소">
            <PropertyForm />
          </Layout>
        } />
        <Route path="/properties/:id" element={
          <Layout title="숙소 수정">
            <PropertyForm />
          </Layout>
        } />
        <Route path="/calendar" element={
          <Layout title="캘린더">
            <CalendarView />
          </Layout>
        } />
        <Route path="/canvas" element={
          <Layout title="캔버스">
            <CanvasPage />
          </Layout>
        } />
      </Routes>
      <SidePanel />
    </ToastProvider>
  );
}
