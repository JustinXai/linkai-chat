import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { useAuthContext } from '~/hooks';
import { useToastContext } from '@librechat/client';
import { SystemRoles } from 'librechat-data-provider';
import store from '~/store';

interface User {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
  role: string;
  status: string;
  linkai?: {
    plan: string;
    credits: number;
    creditsTotal: number;
    expiresAt: string | null;
    dailyUsage: {
      autoSearchCount: number;
      deepSearchCount: number;
      lastResetDate: string;
    };
    totalUsage: {
      chatCount: number;
      searchCount: number;
      deepSearchCount: number;
    };
  };
}

interface Stats {
  users: { total: number; active: number; banned: number; admins: number };
  credits: { totalCredits: number; avgCredits: number; maxCredits: number };
  planDistribution: Record<string, number>;
  recentActions: number;
}

const PLAN_LABELS: Record<string, string> = {
  free: '免费体验',
  trial: '试用版',
  weekly: '周卡',
  monthly_lite: '月卡 Lite',
  monthly: '月卡',
  monthly_pro: '月卡 Pro',
  pro: '专业版',
  heavy: '重度用户',
};

const PRESET_PACKAGES = [
  { plan: 'free', label: '免费体验', credits: 100, days: 7 },
  { plan: 'trial', label: '试用版', credits: 300, days: 3 },
  { plan: 'weekly', label: '周卡', credits: 1200, days: 7 },
  { plan: 'monthly_lite', label: '月卡 Lite', credits: 3000, days: 30 },
  { plan: 'monthly', label: '月卡', credits: 3000, days: 30 },
  { plan: 'monthly_pro', label: '月卡 Pro', credits: 9000, days: 30 },
  { plan: 'pro', label: '专业版', credits: 9000, days: 30 },
  { plan: 'heavy', label: '重度用户', credits: 25000, days: 30 },
];

interface RankingUser {
  rank: number;
  userId: string;
  userEmail: string;
  totalRequests: number;
  totalCredits: number;
  successfulRequests: number;
  searchRequests: number;
  deepSearchRequests: number;
}

interface RequestLog {
  _id: string;
  userId: string;
  userEmail: string;
  model: string;
  searchMode: string;
  deductedCredits: number;
  success: boolean;
  error: string | null;
  searchPerformed: boolean;
  searchResultCount: number;
  createdAt: string;
  responseTimeMs: number | null;
}

interface AdminLog {
  _id: string;
  adminUserId: string;
  adminEmail: string;
  action: string;
  targetUserId?: string;
  targetEmail?: string;
  reason: string;
  createdAt: string;
}

interface TodayOverview {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDeductedCredits: number;
  autoSearchCount: number;
  deepSearchCount: number;
  newUsers: number;
  totalUsers: number;
  topUsers: Array<{ userId: string; email: string; totalCredits: number }>;
  topModels: Array<{ model: string; requestCount: number; totalCredits: number }>;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPlan, setFilterPlan] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'logs' | 'ranking'>('overview');
  const [logsSubTab, setLogsSubTab] = useState<'request' | 'admin'>('request');
  const [ranking, setRanking] = useState<RankingUser[]>([]);
  const [rankingPeriod, setRankingPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [todayOverview, setTodayOverview] = useState<TodayOverview | null>(null);

  const isAdmin = user?.role === SystemRoles.ADMIN;

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (searchEmail) params.append('search', searchEmail);
      if (filterStatus) params.append('status', filterStatus);
      if (filterPlan) params.append('plan', filterPlan);

      const response = await fetch(`/api/admin/users?${params}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.data.users);
        setTotalPages(data.data.pagination.pages);
      }
    } catch (error) {
      showToast({ message: '获取用户列表失败', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, searchEmail, filterStatus, filterPlan, showToast]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchStats();
    }
  }, [isAdmin, fetchUsers, fetchStats]);

  const fetchRanking = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/ranking?period=${rankingPeriod}&limit=20`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setRanking(data.data.ranking || []);
      }
    } catch (error) {
      console.error('Failed to fetch ranking:', error);
    }
  }, [rankingPeriod]);

  const fetchRequestLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: logsPage.toString(),
        limit: '20',
      });
      const response = await fetch(`/api/admin/request-logs?${params}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setRequestLogs(data.data.logs || []);
        setLogsTotalPages(data.data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch request logs:', error);
    }
  }, [logsPage]);

  const fetchAdminLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: logsPage.toString(),
        limit: '20',
      });
      const response = await fetch(`/api/admin/logs?${params}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setAdminLogs(data.data.logs || []);
        setLogsTotalPages(data.data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch admin logs:', error);
    }
  }, [logsPage]);

  const fetchTodayOverview = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/today-overview', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setTodayOverview(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch today overview:', error);
    }
  }, []);

  useEffect(() => {
    if (isAdmin && activeTab === 'ranking') {
      fetchRanking();
    }
  }, [isAdmin, activeTab, fetchRanking]);

  useEffect(() => {
    if (isAdmin && activeTab === 'logs' && logsSubTab === 'request') {
      fetchRequestLogs();
    }
  }, [isAdmin, activeTab, logsSubTab, fetchRequestLogs]);

  useEffect(() => {
    if (isAdmin && activeTab === 'logs' && logsSubTab === 'admin') {
      fetchAdminLogs();
    }
  }, [isAdmin, activeTab, logsSubTab, fetchAdminLogs]);

  useEffect(() => {
    if (isAdmin && activeTab === 'overview') {
      fetchTodayOverview();
    }
  }, [isAdmin, activeTab, fetchTodayOverview]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleUserAction = async (action: string, userId: string, payload?: Record<string, unknown>) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload || {}),
      });
      const data = await response.json();
      if (data.success) {
        showToast({ message: '操作成功', severity: 'success' });
        fetchUsers();
        fetchStats();
        if (selectedUser && selectedUser._id === userId) {
          setSelectedUser({ ...selectedUser, ...data.data });
        }
      } else {
        showToast({ message: data.error || '操作失败', severity: 'error' });
      }
    } catch (error) {
      showToast({ message: '操作失败', severity: 'error' });
    }
  };

  const handleSetPlan = (userId: string, plan: string) => {
    handleUserAction('plan', userId, { plan, reason: `设置为 ${PLAN_LABELS[plan]}` });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '永不过期';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-medium bg-white px-4 py-3">
        <h1 className="text-xl font-semibold text-text-primary">管理后台</h1>
        <p className="text-sm text-text-secondary">管理 Link-AI Chat 用户和订阅</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-border-medium bg-white px-4">
        <button
          onClick={() => setActiveTab('overview')}
          className={`border-b-2 px-4 py-3 text-sm font-medium ${
            activeTab === 'overview'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          今日概览
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`border-b-2 px-4 py-3 text-sm font-medium ${
            activeTab === 'users'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          用户管理
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`border-b-2 px-4 py-3 text-sm font-medium ${
            activeTab === 'logs'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          日志管理
        </button>
        <button
          onClick={() => setActiveTab('ranking')}
          className={`border-b-2 px-4 py-3 text-sm font-medium ${
            activeTab === 'ranking'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          消耗排行
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-text-primary">今日数据概览</h2>

            {/* Request Stats Cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border-medium bg-white p-4">
                <div className="text-sm text-text-secondary">今日请求数</div>
                <div className="text-3xl font-bold text-text-primary">{todayOverview?.totalRequests ?? '-'}</div>
              </div>
              <div className="rounded-lg border border-border-medium bg-white p-4">
                <div className="text-sm text-text-secondary">今日成功请求</div>
                <div className="text-3xl font-bold text-green-600">{todayOverview?.successfulRequests ?? '-'}</div>
              </div>
              <div className="rounded-lg border border-border-medium bg-white p-4">
                <div className="text-sm text-text-secondary">今日失败请求</div>
                <div className="text-3xl font-bold text-red-600">{todayOverview?.failedRequests ?? '-'}</div>
              </div>
              <div className="rounded-lg border border-border-medium bg-white p-4">
                <div className="text-sm text-text-secondary">今日扣点总数</div>
                <div className="text-3xl font-bold text-orange-600">{todayOverview?.totalDeductedCredits?.toLocaleString() ?? '-'}</div>
              </div>
            </div>

            {/* Search Stats Cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border-medium bg-white p-4">
                <div className="text-sm text-text-secondary">今日自动搜索次数</div>
                <div className="text-3xl font-bold text-blue-600">{todayOverview?.autoSearchCount ?? '-'}</div>
              </div>
              <div className="rounded-lg border border-border-medium bg-white p-4">
                <div className="text-sm text-text-secondary">今日深度搜索次数</div>
                <div className="text-3xl font-bold text-purple-600">{todayOverview?.deepSearchCount ?? '-'}</div>
              </div>
              <div className="rounded-lg border border-border-medium bg-white p-4">
                <div className="text-sm text-text-secondary">今日新增用户</div>
                <div className="text-3xl font-bold text-teal-600">{todayOverview?.newUsers ?? '-'}</div>
              </div>
              <div className="rounded-lg border border-border-medium bg-white p-4">
                <div className="text-sm text-text-secondary">当前总用户</div>
                <div className="text-3xl font-bold text-text-primary">{todayOverview?.totalUsers ?? '-'}</div>
              </div>
            </div>

            {/* Top Users and Models */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Top 10 High Usage Users */}
              <div className="rounded-lg border border-border-medium bg-white">
                <div className="border-b border-border-medium px-4 py-3">
                  <h3 className="font-medium text-text-primary">Top 10 高消耗用户</h3>
                </div>
                <div className="divide-y divide-border-medium">
                  {!todayOverview?.topUsers || todayOverview.topUsers.length === 0 ? (
                    <div className="px-4 py-8 text-center text-text-secondary">暂无数据</div>
                  ) : (
                    todayOverview.topUsers.map((u, index) => (
                      <div key={u.userId} className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-sm text-text-primary">{u.email || u.userId}</span>
                        </div>
                        <span className="text-sm font-medium text-text-primary">{u.totalCredits.toLocaleString()} 点</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top 10 High Usage Models */}
              <div className="rounded-lg border border-border-medium bg-white">
                <div className="border-b border-border-medium px-4 py-3">
                  <h3 className="font-medium text-text-primary">Top 10 高消耗模型</h3>
                </div>
                <div className="divide-y divide-border-medium">
                  {!todayOverview?.topModels || todayOverview.topModels.length === 0 ? (
                    <div className="px-4 py-8 text-center text-text-secondary">暂无数据</div>
                  ) : (
                    todayOverview.topModels.map((m, index) => (
                      <div key={m.model} className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-sm text-text-primary">{m.model}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-text-primary">{m.totalCredits.toLocaleString()} 点</span>
                          <span className="ml-2 text-xs text-text-secondary">({m.requestCount}次)</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <>
            {stats && (
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-border-medium bg-white p-4">
                  <div className="text-sm text-text-secondary">总用户数</div>
                  <div className="text-2xl font-bold text-text-primary">{stats.users.total}</div>
                </div>
                <div className="rounded-lg border border-border-medium bg-white p-4">
                  <div className="text-sm text-text-secondary">活跃用户</div>
                  <div className="text-2xl font-bold text-green-600">{stats.users.active}</div>
                </div>
                <div className="rounded-lg border border-border-medium bg-white p-4">
                  <div className="text-sm text-text-secondary">已封禁</div>
                  <div className="text-2xl font-bold text-red-600">{stats.users.banned}</div>
                </div>
                <div className="rounded-lg border border-border-medium bg-white p-4">
                  <div className="text-sm text-text-secondary">总点数</div>
                  <div className="text-2xl font-bold text-text-primary">{stats.credits.totalCredits.toLocaleString()}</div>
                </div>
              </div>
            )}
          <>
        <div className="mb-4 flex flex-wrap gap-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="搜索邮箱或名称..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="rounded-md border border-border-medium px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              搜索
            </button>
          </form>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="rounded-md border border-border-medium px-3 py-2 text-sm"
          >
            <option value="">全部状态</option>
            <option value="active">正常</option>
            <option value="banned">已封禁</option>
          </select>
          <select
            value={filterPlan}
            onChange={(e) => { setFilterPlan(e.target.value); setPage(1); }}
            className="rounded-md border border-border-medium px-3 py-2 text-sm"
          >
            <option value="">全部套餐</option>
            <option value="free">免费体验</option>
            <option value="weekly">周卡</option>
            <option value="monthly">月卡 Lite</option>
            <option value="pro">月卡 Pro</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border-medium bg-white">
          <table className="min-w-full divide-y divide-border-medium">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">用户</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">套餐</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">点数</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">到期时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                    加载中...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                    没有找到用户
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className={u.status === 'banned' ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-text-primary">{u.email}</div>
                      <div className="text-xs text-text-secondary">{u.name || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        u.linkai?.plan === 'pro' ? 'bg-purple-100 text-purple-800' :
                        u.linkai?.plan === 'monthly' ? 'bg-blue-100 text-blue-800' :
                        u.linkai?.plan === 'weekly' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {PLAN_LABELS[u.linkai?.plan || 'free']}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {u.linkai?.credits?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {formatDate(u.linkai?.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        u.status === 'banned' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {u.status === 'banned' ? '已封禁' : '正常'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="text-sm text-green-600 hover:text-green-800"
                      >
                        管理
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-border-medium px-3 py-1 text-sm disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-3 py-1 text-sm text-text-secondary">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-border-medium px-3 py-1 text-sm disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        )}
          </>
        )}

        {/* Ranking Tab */}
        {activeTab === 'ranking' && (
          <div>
            <div className="mb-4 flex gap-2">
              <select
                value={rankingPeriod}
                onChange={(e) => setRankingPeriod(e.target.value as typeof rankingPeriod)}
                className="rounded-md border border-border-medium px-3 py-2 text-sm"
              >
                <option value="all">全部时间</option>
                <option value="today">今日</option>
                <option value="week">近7天</option>
                <option value="month">近30天</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border-medium bg-white">
              <table className="min-w-full divide-y divide-border-medium">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">排名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">用户</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-text-secondary">总消耗</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-text-secondary">请求数</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-text-secondary">搜索次数</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-text-secondary">深度搜索</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-medium">
                  {ranking.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    ranking.map((u) => (
                      <tr key={u.userId}>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                            u.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                            u.rank === 2 ? 'bg-gray-100 text-gray-800' :
                            u.rank === 3 ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            #{u.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-primary">{u.userEmail || u.userId}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-text-primary">{u.totalCredits.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-sm text-text-secondary">{u.totalRequests}</td>
                        <td className="px-4 py-3 text-right text-sm text-text-secondary">{u.searchRequests}</td>
                        <td className="px-4 py-3 text-right text-sm text-text-secondary">{u.deepSearchRequests}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div>
            {/* Sub Tab Navigation */}
            <div className="mb-4 flex gap-4 border-b border-border-medium">
              <button
                onClick={() => { setLogsSubTab('request'); setLogsPage(1); }}
                className={`border-b-2 px-4 py-2 text-sm font-medium ${
                  logsSubTab === 'request'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                请求日志
              </button>
              <button
                onClick={() => { setLogsSubTab('admin'); setLogsPage(1); }}
                className={`border-b-2 px-4 py-2 text-sm font-medium ${
                  logsSubTab === 'admin'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                管理日志
              </button>
            </div>

            {/* Request Logs */}
            {logsSubTab === 'request' && (
              <div className="overflow-x-auto rounded-lg border border-border-medium bg-white">
                <table className="min-w-full divide-y divide-border-medium">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">时间</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">用户</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">模型</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">搜索模式</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-text-secondary">消耗</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-medium">
                    {requestLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                          暂无数据
                        </td>
                      </tr>
                    ) : (
                      requestLogs.map((log) => (
                        <tr key={log._id}>
                          <td className="px-4 py-3 text-sm text-text-secondary">
                            {new Date(log.createdAt).toLocaleString('zh-CN')}
                          </td>
                          <td className="px-4 py-3 text-sm text-text-primary">{log.userEmail || log.userId}</td>
                          <td className="px-4 py-3 text-sm text-text-secondary">{log.model}</td>
                          <td className="px-4 py-3 text-sm">
                            {log.searchMode === 'auto' && <span className="text-blue-600">自动</span>}
                            {log.searchMode === 'deep' && <span className="text-purple-600">深度</span>}
                            {log.searchMode === 'off' && <span className="text-gray-500">关闭</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-text-primary">{log.deductedCredits}</td>
                          <td className="px-4 py-3 text-sm">
                            {log.success
                              ? <span className="text-green-600">成功</span>
                              : <span className="text-red-600">{log.error || '失败'}</span>
                            }
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Admin Logs */}
            {logsSubTab === 'admin' && (
              <div className="overflow-x-auto rounded-lg border border-border-medium bg-white">
                <table className="min-w-full divide-y divide-border-medium">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">时间</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">管理员</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">操作</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">目标用户</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">详情</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-medium">
                    {adminLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                          暂无数据
                        </td>
                      </tr>
                    ) : (
                      adminLogs.map((log) => (
                        <tr key={log._id}>
                          <td className="px-4 py-3 text-sm text-text-secondary">
                            {new Date(log.createdAt).toLocaleString('zh-CN')}
                          </td>
                          <td className="px-4 py-3 text-sm text-text-primary">{log.adminEmail || log.adminUserId}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-text-secondary">{log.targetEmail || log.targetUserId || '-'}</td>
                          <td className="px-4 py-3 text-sm text-text-secondary">{log.reason || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {logsTotalPages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                  disabled={logsPage === 1}
                  className="rounded-md border border-border-medium px-3 py-1 text-sm disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="px-3 py-1 text-sm text-text-secondary">
                  第 {logsPage} / {logsTotalPages} 页
                </span>
                <button
                  onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))}
                  disabled={logsPage === logsTotalPages}
                  className="rounded-md border border-border-medium px-3 py-1 text-sm disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-xl">
            <div className="sticky top-0 border-b border-border-medium bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">用户管理</h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-4 rounded-lg border border-border-medium bg-gray-50 p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-text-secondary">邮箱</div>
                    <div className="font-medium">{selectedUser.email}</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">名称</div>
                    <div className="font-medium">{selectedUser.name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">注册时间</div>
                    <div className="font-medium">{formatDate(selectedUser.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">角色</div>
                    <div className="font-medium">{selectedUser.role === SystemRoles.ADMIN ? '管理员' : '用户'}</div>
                  </div>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-border-medium bg-gray-50 p-4">
                <h3 className="mb-3 font-medium">Link-AI 订阅信息</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-text-secondary">当前套餐</div>
                    <div className="font-medium">{PLAN_LABELS[selectedUser.linkai?.plan || 'free']}</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">当前点数</div>
                    <div className="font-medium">{selectedUser.linkai?.credits?.toLocaleString() || 0}</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">累计点数</div>
                    <div className="font-medium">{selectedUser.linkai?.creditsTotal?.toLocaleString() || 0}</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">到期时间</div>
                    <div className="font-medium">{formatDate(selectedUser.linkai?.expiresAt)}</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">今日自动搜索</div>
                    <div className="font-medium">{selectedUser.linkai?.dailyUsage?.autoSearchCount || 0} 次</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">今日深度搜索</div>
                    <div className="font-medium">{selectedUser.linkai?.dailyUsage?.deepSearchCount || 0} 次</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">总对话次数</div>
                    <div className="font-medium">{selectedUser.linkai?.totalUsage?.chatCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">总搜索次数</div>
                    <div className="font-medium">{selectedUser.linkai?.totalUsage?.searchCount || 0}</div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="mb-3 font-medium">快捷开通套餐</h3>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_PACKAGES.map((pkg) => (
                    <button
                      key={pkg.plan}
                      onClick={() => handleSetPlan(selectedUser._id, pkg.plan)}
                      className="rounded-md border border-green-600 px-3 py-2 text-sm text-green-600 hover:bg-green-50"
                    >
                      {pkg.label} ({pkg.credits} 点 / {pkg.days} 天)
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="mb-3 font-medium">点数操作</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    id="credits-input"
                    placeholder="输入点数数量"
                    className="flex-1 rounded-md border border-border-medium px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('credits-input') as HTMLInputElement;
                      const amount = parseInt(input.value);
                      if (amount > 0) {
                        handleUserAction('credits', selectedUser._id, { amount, reason: '管理员加点数' });
                        input.value = '';
                      }
                    }}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    加点
                  </button>
                  <button
                    onClick={() => {
                      const input = document.getElementById('credits-input') as HTMLInputElement;
                      const amount = parseInt(input.value);
                      if (amount > 0) {
                        handleUserAction('credits', selectedUser._id, { amount, reason: '管理员扣点数' });
                        input.value = '';
                      }
                    }}
                    className="rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    扣点
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="mb-3 font-medium">搜索额度</h3>
                <button
                  onClick={() => handleUserAction('reset-usage', selectedUser._id, { reason: '管理员重置' })}
                  className="rounded-md border border-border-medium px-4 py-2 text-sm hover:bg-gray-50"
                >
                  重置今日搜索次数
                </button>
              </div>

              <div>
                <h3 className="mb-3 font-medium">账户状态</h3>
                {selectedUser.status === 'banned' ? (
                  <button
                    onClick={() => handleUserAction('unban', selectedUser._id, { reason: '解除封禁' })}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    解除封禁
                  </button>
                ) : (
                  <button
                    onClick={() => handleUserAction('ban', selectedUser._id, { reason: '封禁用户' })}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    封禁用户
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
