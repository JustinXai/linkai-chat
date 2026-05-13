import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeSelector } from '@librechat/client';

const shortcuts = [
  { label: '写作润色', icon: '✍️' },
  { label: '联网搜索', icon: '🔍' },
  { label: '代码助手', icon: '💻' },
  { label: '资料总结', icon: '📋' },
];

const models = [
  {
    name: 'GPT',
    description: '复杂推理、写作和代码',
    color: 'bg-green-50 border-green-200',
    textColor: 'text-green-700',
  },
  {
    name: 'Gemini',
    description: '搜索增强、多模态和资料整理',
    color: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-700',
  },
  {
    name: 'Claude',
    description: '长文分析、代码和深度思考',
    color: 'bg-orange-50 border-orange-200',
    textColor: 'text-orange-700',
  },
];

const features = [
  {
    name: '自动搜索',
    description: '智能联网获取最新资料',
    icon: '🌐',
    badge: null,
  },
  {
    name: '深度搜索',
    description: '深度研究分析',
    icon: '🔎',
    badge: 'Beta',
  },
  {
    name: 'AI 绘图',
    description: 'AI 图像生成',
    icon: '🎨',
    badge: '即将上线',
  },
  {
    name: 'AI 视频',
    description: 'AI 视频生成',
    icon: '🎬',
    badge: '即将上线',
  },
];

const pricingPlans = [
  { name: '免费体验', points: '100 点', period: '7 天' },
  { name: '周卡', points: '1200 点', period: '7 天' },
  { name: '月卡 Lite', points: '3000 点', period: '30 天' },
  { name: '月卡 Pro', points: '9000 点', period: '30 天' },
];

const footerLinks = [
  { label: '用户协议', href: '#' },
  { label: '隐私政策', href: '#' },
  { label: '内容规范', href: '#' },
  { label: '联系我们', href: '#' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleShortcutClick = (label: string) => {
    setSearchQuery(label);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/login?redirect_to=/c/new&q=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate('/login');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <ThemeSelector />

      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="text-xl font-bold text-gray-900">Link-AI</div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              登录
            </button>
            <button
              onClick={() => navigate('/login?redirect_to=/c/new')}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              免费开始
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center md:py-24">
        <h1 className="mb-4 text-3xl font-bold leading-tight text-gray-900 md:text-5xl">
          一个账号，畅用 GPT、Gemini 和 Claude
        </h1>
        <p className="mb-8 text-base text-gray-500 md:text-lg">
          面向中文用户的 AI 工作台，支持对话、写作、翻译、代码、联网搜索和深度搜索。
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={() => navigate('/login?redirect_to=/c/new')}
            className="w-full rounded-full bg-gray-900 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800 sm:w-auto"
          >
            免费开始
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full rounded-full border border-gray-300 bg-white px-8 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
          >
            登录
          </button>
        </div>
      </section>

      {/* Search Input */}
      <section className="mx-auto max-w-3xl px-4 pb-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="问我任何问题，或开启自动搜索获取最新资料…"
              className="flex-1 bg-transparent text-base text-gray-900 placeholder-gray-400 outline-none"
            />
            <button
              onClick={handleSearch}
              className="rounded-full bg-gray-900 p-2 text-white transition-colors hover:bg-gray-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {shortcuts.map((item) => (
              <button
                key={item.label}
                onClick={() => handleShortcutClick(item.label)}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100"
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Model Cards */}
      <section className="mx-auto max-w-4xl px-4 pb-16">
        <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">模型能力</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {models.map((model) => (
            <div
              key={model.name}
              className={`rounded-2xl border p-5 ${model.color} transition-transform hover:scale-[1.02]`}
            >
              <h3 className={`mb-2 text-lg font-semibold ${model.textColor}`}>{model.name}</h3>
              <p className="text-sm text-gray-600">{model.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Cards */}
      <section className="bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">核心功能</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.name}
                className="rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 text-3xl">{feature.icon}</div>
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-base font-medium text-gray-900">{feature.name}</h3>
                  {feature.badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        feature.badge === 'Beta'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {feature.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">套餐预览</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className="rounded-2xl border border-gray-200 p-5 text-center transition-shadow hover:shadow-md"
            >
              <h3 className="mb-2 text-base font-medium text-gray-900">{plan.name}</h3>
              <div className="mb-1 text-2xl font-bold text-gray-900">{plan.points}</div>
              <div className="text-sm text-gray-500">{plan.period}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="transition-colors hover:text-gray-700"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-4 text-center text-sm text-gray-400">
            © {new Date().getFullYear()} Link-AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
