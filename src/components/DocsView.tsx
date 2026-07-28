import React, { useState } from 'react';
import { BookOpen, Copy, CheckCircle2, Terminal, Code2, Cloud, ShieldCheck } from 'lucide-react';

export const DocsView: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'https://your-hermes-gateway.vercel.app/api/v1';

  const pythonSnippet = `from openai import OpenAI

# اتصال Hermes Agent به Hermes Cloud Router
client = OpenAI(
    base_url="${baseUrl}",
    api_key="hermes-tk-teacher-8821"  # یا توکن اختصاصی ایجنت
)

response = client.chat.completions.create(
    model="gemini-3.6-flash",
    messages=[
        {"role": "system", "content": "شما دستیار Hermes هستید."},
        {"role": "user", "content": "سلام! روتر چطور کلیدها را چرخشی عوض میکند؟"}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)
`;

  const curlSnippet = `curl -X POST "${baseUrl}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer hermes-tk-teacher-8821" \\
  -d '{
    "model": "gemini-3.6-flash",
    "messages": [
      {"role": "user", "content": "تست درگاه Hermes"}
    ]
  }'
`;

  const nodeSnippet = `import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: '${baseUrl}',
  apiKey: 'hermes-tk-teacher-8821',
});

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: 'سلام Hermes!' }],
    model: 'gemini-3.6-flash',
  });

  console.log(completion.choices[0].message.content);
}

main();
`;

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  return (
    <div className="p-2 sm:p-6 space-y-6 dir-rtl text-gray-900">
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-gray-900">راهنمای اتصال Hermes Agent و راهنمای Deploy روی Vercel</h2>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          آموزش نحوه اتصال کلاینت Hermes به این Gateway و نحوه استقرار پروژه روی Vercel و GitHub.
        </p>
      </div>

      {/* Endpoint Url Banner */}
      <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-2">
        <span className="text-xs text-gray-600 font-semibold block">آدرس Base URL اختصاصی این Gateway:</span>
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200 font-mono text-xs text-blue-700">
          <span>{baseUrl}</span>
          <button
            onClick={() => handleCopy(baseUrl, 'url')}
            className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 font-sans"
          >
            {copiedIndex === 'url' ? (
              <span className="text-blue-600 font-semibold">کپی شد!</span>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>کپی URL</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Integration Cards */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Code2 className="w-4 h-4 text-blue-600" />
          <span>کدهای نمونه اتصال Hermes Agent</span>
        </h3>

        {/* Python Snippet */}
        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-xs font-bold text-gray-900 font-mono">Python (OpenAI Package)</span>
            <button
              onClick={() => handleCopy(pythonSnippet, 'python')}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
            >
              {copiedIndex === 'python' ? 'کپی شد!' : 'کپی کد Python'}
            </button>
          </div>
          <pre className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-800 font-mono overflow-x-auto leading-relaxed dir-ltr">
            {pythonSnippet}
          </pre>
        </div>

        {/* cURL Snippet */}
        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-xs font-bold text-gray-900 font-mono">cURL Command</span>
            <button
              onClick={() => handleCopy(curlSnippet, 'curl')}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
            >
              {copiedIndex === 'curl' ? 'کپی شد!' : 'کپی cURL'}
            </button>
          </div>
          <pre className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-800 font-mono overflow-x-auto leading-relaxed dir-ltr">
            {curlSnippet}
          </pre>
        </div>

        {/* Node.js Snippet */}
        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-xs font-bold text-gray-900 font-mono">Node.js / TypeScript</span>
            <button
              onClick={() => handleCopy(nodeSnippet, 'node')}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
            >
              {copiedIndex === 'node' ? 'کپی شد!' : 'کپی کد Node.js'}
            </button>
          </div>
          <pre className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-800 font-mono overflow-x-auto leading-relaxed dir-ltr">
            {nodeSnippet}
          </pre>
        </div>
      </div>

      {/* Vercel Deployment Instructions */}
      <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <Cloud className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold text-gray-900">راهنمای استقرار (Deploy) روی Vercel</h3>
        </div>

        <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              این پروژه را به مخزن <strong>GitHub</strong> خود Push کنید.
            </li>
            <li>
              وارد پنل <strong>Vercel</strong> شده و پروژه جدید از روی ریپازیتوری ایجاد کنید.
            </li>
            <li>
              در بخش <strong>Environment Variables</strong> کلیدهای زیر را وارد کنید:
              <ul className="list-disc list-inside mr-4 my-2 text-blue-700 font-mono">
                <li>GEMINI_API_KEY = کلید اصلی گوگل</li>
                <li>GEMINI_KEY_1 = کلید پشتیبان اول</li>
                <li>GEMINI_KEY_2 = کلید پشتیبان دوم</li>
                <li>ADMIN_SECRET = رمز عبور مدیریت پنل</li>
              </ul>
            </li>
            <li>
              روی دکمه <strong>Deploy</strong> کلیک کنید. فایل <code className="text-blue-600">vercel.json</code> به صورت خودکار توابع Serverless را پیکربندی خواهد نمود.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
