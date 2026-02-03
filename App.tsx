
import React, { useState } from 'react';
import { AppStage, Question } from './types';
import { generateQuestions, analyzeDecision } from './geminiService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.START);
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 결정 프로세스를 시작하기 전 환경을 점검하고 질문 생성을 요청합니다.
   */
  const startDecisionProcess = async () => {
    if (!topic.trim()) return;
    setError(null);

    // 1. API 키 존재 여부 확인 및 자동 환경 구성 시도
    const currentKey = process.env.API_KEY;
    const isMissing = !currentKey || currentKey === 'undefined' || currentKey.trim() === '';

    if (isMissing && window.aistudio) {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
          // 선택 후 레이스가 발생할 수 있으므로 바로 진행
        }
      } catch (e) {
        console.error("Environment setup failed", e);
      }
    }

    // 2. 프로세스 진행
    setStage(AppStage.GENERATING_QUESTIONS);
    setLoadingMessage('당신의 고민에 딱 맞는 20가지 질문을 구성하고 있습니다...');
    
    try {
      const generated = await generateQuestions(topic);
      setQuestions(generated);
      setStage(AppStage.ANSWERING);
      setCurrentIndex(0);
    } catch (err: any) {
      // 404 에러 등 특정 상황에서도 사용자에게는 "연결 실패" 정도로만 안내
      if (err.message && err.message.includes("Requested entity was not found.")) {
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
          setError("시스템 연결을 재시도합니다. 다시 한번 시작 버튼을 눌러주세요.");
        } else {
          setError("서비스 연결이 원활하지 않습니다. 잠시 후 다시 시도해주세요.");
        }
      } else {
        setError(err.message || '요청을 처리하는 중 문제가 발생했습니다.');
      }
      setStage(AppStage.START);
    }
  };

  const handleAnswer = (option: string) => {
    setAnswers(prev => ({ ...prev, [questions[currentIndex].id]: option }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      finishAnswering();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const finishAnswering = async () => {
    setStage(AppStage.ANALYZING);
    setLoadingMessage('작성해주신 20개의 답변을 분석하여 최선의 결론을 도출하고 있습니다...');
    try {
      const finalResult = await analyzeDecision(topic, questions, answers);
      setResult(finalResult);
      setStage(AppStage.RESULT);
    } catch (err: any) {
      setError('결과를 분석하는 과정에서 문제가 발생했습니다. 다시 시도해주세요.');
      setStage(AppStage.START);
    }
  };

  const resetApp = () => {
    setStage(AppStage.START);
    setTopic('');
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-slate-50 text-slate-900">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-500 border border-slate-100">
        
        {/* Top Header */}
        <header className="bg-indigo-600 p-8 text-white">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <i className="fas fa-compass animate-spin-slow"></i>
            스마트 결정 어드바이저
          </h1>
          <p className="opacity-80 mt-2 text-sm md:text-base font-medium">당신의 고민을 해결할 20가지 질문과 명쾌한 해답</p>
        </header>

        {/* Error Alert - 전문적인 룩으로 개선 */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-3">
            <i className="fas fa-circle-info mt-1"></i>
            <div className="flex-1">
              <p className="text-sm font-semibold">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-amber-400 hover:text-amber-600">
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        <main className="p-6 md:p-10">
          
          {/* STAGE: START */}
          {stage === AppStage.START && (
            <div className="space-y-8 animate-fadeIn">
              <div className="space-y-3">
                <label className="text-lg font-bold text-slate-700 flex items-center gap-2">
                  <i className="fas fa-edit text-indigo-500"></i>
                  고민하고 있는 분야를 입력해주세요
                </label>
                <textarea 
                  className="w-full p-5 border-2 border-slate-100 bg-slate-50 rounded-2xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50/50 transition-all text-lg h-40 resize-none outline-none"
                  placeholder="예: '이번 여름 휴가 목적지 정하기', '노트북 구매 고민', '커리어 전환 시기 결정' 등"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <p className="text-xs text-slate-400 text-right">구체적으로 적을수록 더 정교한 질문이 생성됩니다.</p>
              </div>
              <button 
                onClick={startDecisionProcess}
                disabled={!topic.trim()}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xl rounded-2xl shadow-xl transform transition active:scale-[0.98] flex items-center justify-center gap-3"
              >
                결정 가이드 시작하기 <i className="fas fa-sparkles"></i>
              </button>
            </div>
          )}

          {/* STAGE: LOADING */}
          {(stage === AppStage.GENERATING_QUESTIONS || stage === AppStage.ANALYZING) && (
            <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-fadeIn">
              <div className="relative">
                <div className="w-24 h-24 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                  <i className="fas fa-brain text-3xl animate-pulse"></i>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-bold text-slate-800">{loadingMessage}</p>
                <p className="text-sm text-slate-400">AI가 당신의 답변을 신중하게 검토하고 있습니다.</p>
              </div>
            </div>
          )}

          {/* STAGE: ANSWERING */}
          {stage === AppStage.ANSWERING && questions.length > 0 && (
            <div className="space-y-8 animate-fadeIn">
              {/* Header Info */}
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Step {currentIndex + 1} of {questions.length}</span>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-snug">
                    {questions[currentIndex].text}
                  </h2>
                </div>
                <div className="hidden md:block text-right">
                  <span className="text-2xl font-black text-slate-200">{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-700 ease-out"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                ></div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-4 mt-6">
                {questions[currentIndex].options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(option)}
                    className={`p-5 text-left rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 group hover:shadow-md ${
                      answers[questions[currentIndex].id] === option
                        ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50'
                        : 'border-slate-100 hover:border-indigo-200 bg-white'
                    }`}
                  >
                    <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${
                      answers[questions[currentIndex].id] === option
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className={`font-semibold text-lg ${
                      answers[questions[currentIndex].id] === option ? 'text-indigo-900' : 'text-slate-600'
                    }`}>{option}</span>
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-8 border-t border-slate-100 mt-8">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="px-6 py-3 rounded-xl font-bold text-slate-400 disabled:opacity-0 hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <i className="fas fa-arrow-left"></i> 이전
                </button>
                <button
                  onClick={handleNext}
                  disabled={!answers[questions[currentIndex].id]}
                  className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all flex items-center gap-2 transform active:scale-95"
                >
                  {currentIndex === questions.length - 1 ? '최종 분석 결과 보기' : '다음 질문'} 
                  <i className={`fas ${currentIndex === questions.length - 1 ? 'fa-check' : 'fa-arrow-right'}`}></i>
                </button>
              </div>
            </div>
          )}

          {/* STAGE: RESULT */}
          {stage === AppStage.RESULT && result && (
            <div className="space-y-8 animate-fadeIn">
              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-2xl border border-green-100">
                <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-xl shadow-lg">
                  <i className="fas fa-check"></i>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-green-900">최적의 결정을 도출했습니다</h2>
                  <p className="text-sm text-green-700">당신의 답변을 바탕으로 한 AI의 개인화된 권장 사항입니다.</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl border border-slate-200 p-8 shadow-inner overflow-auto max-h-[500px] custom-scrollbar">
                <div className="prose prose-indigo max-w-none">
                  <div className="whitespace-pre-wrap text-slate-700 leading-relaxed text-lg font-medium">
                    {result}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => window.print()}
                  className="py-4 border-2 border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-print"></i> 결과 저장/출력
                </button>
                <button 
                  onClick={resetApp}
                  className="py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-95"
                >
                  <i className="fas fa-redo"></i> 새로운 결정 시작
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
      
      {/* Footer Branding */}
      <footer className="mt-10 text-slate-400 text-sm flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><i className="fas fa-lock text-xs"></i> 보안 유지</span>
          <span className="flex items-center gap-1"><i className="fas fa-bolt text-xs"></i> 초고속 분석</span>
          <span className="flex items-center gap-1"><i className="fas fa-shield-halved text-xs"></i> 256-bit 암호화</span>
        </div>
        <p className="mt-2 opacity-60">© 2024 Decision Advisor AI. All rights reserved.</p>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        @media print {
          body { background: white; }
          .no-print { display: none; }
          button { display: none; }
        }
      `}</style>
    </div>
  );
};

export default App;
