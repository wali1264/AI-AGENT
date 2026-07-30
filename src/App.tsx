import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, TabType } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ModelManagementView } from './components/ModelManagementView';
import { RouterSettingsView } from './components/RouterSettingsView';
import { AgentManagementView } from './components/AgentManagementView';
import { LogsView } from './components/LogsView';
import { PlaygroundView } from './components/PlaygroundView';
import { DocsView } from './components/DocsView';
import { TradingAgentView } from './components/TradingAgentView';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AuthGateway, UserAuthStatus } from './components/AuthGateway';
import { supabase } from './lib/supabaseClient';
import { AgentProfile, ModelConfig, RouterSettings, ServerState } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [state, setState] = useState<ServerState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Supabase Auth State
  const [userStatus, setUserStatus] = useState<UserAuthStatus>({
    session: null,
    profile: null,
    isLoading: true,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserStatus({ session: null, profile: null, isLoading: false });
  };

  const fetchState = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/state');
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error('Failed to fetch server state:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 10000); // Poll state every 10s
    return () => clearInterval(interval);
  }, [fetchState]);

  const handleSaveModels = async (models: ModelConfig[]) => {
    const res = await fetch('/api/admin/models', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
      body: JSON.stringify({ models }),
    });

    if (!res.ok) {
      throw new Error('خطا در ذخیره مدل‌ها');
    }

    await fetchState();
  };

  const handleSaveSettings = async (settings: RouterSettings) => {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
      body: JSON.stringify({ settings }),
    });

    if (!res.ok) {
      throw new Error('خطا در ذخیره تنظیمات روتر');
    }

    await fetchState();
  };

  const handleSaveAgents = async (agents: AgentProfile[]) => {
    const res = await fetch('/api/admin/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
      body: JSON.stringify({ agents }),
    });

    if (!res.ok) {
      throw new Error('خطا در ذخیره ایجنت‌ها');
    }

    await fetchState();
  };

  const handleClearLogs = async () => {
    const res = await fetch('/api/admin/logs', {
      method: 'DELETE',
      headers: {
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
    });

    if (res.ok) {
      await fetchState();
    }
  };

  return (
    <AuthGateway
      userStatus={userStatus}
      onAuthChange={setUserStatus}
      onLogout={handleLogout}
    >
      <div dir="rtl" className="min-h-screen bg-[#f8f9fa] font-sans text-[#1a1a1a] flex flex-col selection:bg-blue-600 selection:text-white">
        <Navbar
          state={state}
          onRefresh={fetchState}
          isLoading={isLoading}
          userProfile={userStatus.profile}
          onLogout={handleLogout}
        />

        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            logsCount={state?.logs.length || 0}
          />

          <main className="flex-1 overflow-y-auto bg-[#f8f9fa] p-3 sm:p-8">
            <div className="max-w-7xl mx-auto">
              {activeTab === 'dashboard' && (
                <DashboardView
                  state={state}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'trading' && (
                <TradingAgentView adminToken={adminToken} />
              )}

              {activeTab === 'models' && (
                <ModelManagementView
                  state={state}
                  onSaveModels={handleSaveModels}
                />
              )}

              {activeTab === 'router' && (
                <RouterSettingsView
                  state={state}
                  onSaveSettings={handleSaveSettings}
                  onRefresh={fetchState}
                />
              )}

              {activeTab === 'agents' && (
                <AgentManagementView
                  state={state}
                  onSaveAgents={handleSaveAgents}
                />
              )}

              {activeTab === 'logs' && (
                <LogsView
                  state={state}
                  onClearLogs={handleClearLogs}
                />
              )}

              {activeTab === 'playground' && (
                <PlaygroundView
                  state={state}
                  onRefreshState={fetchState}
                />
              )}

              {activeTab === 'docs' && <DocsView />}
            </div>
          </main>
        </div>

        <AdminLoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onLoginSuccess={(token) => setAdminToken(token)}
        />
      </div>
    </AuthGateway>
  );
}
