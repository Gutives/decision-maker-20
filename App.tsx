
import React, { useState } from 'react';
import { AppStage, Question } from './types';
import { generateQuestions, analyzeDecision, AnalysisResult } from './geminiService';

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
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startDecisionProcess = async () => {
    if (!topic.trim()) return;
    setError(null);

    const currentKey = process.env.API_KEY;
    const isMissing = !currentKey || currentKey === 'undefined' || currentKey.trim() === '';

    if (isMissing && window.aistudio) {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
        }
      } catch (e) {
        console.error("Environment setup failed", e);
      }
    }

    setStage(AppStage.GENERATING_QUESTIONS);
    setLoadingMessage('고민을 분석하여 20가지 맞춤 질문을 생성하고 있습니다...');
    
    try {
      const generated = await generateQuestions(topic);
      setQuestions(generated);
      setStage(AppStage.ANSWERING);
      setCurrentIndex(0);
    } catch (err: any) {
      if (err.message && err.message.includes("Requested entity was not found.")) {
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
          setError("시스템 구성을 업데이트했습니다. 다시 한번 시작을 눌러주세요.");
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
    setLoadingMessage('당신의 모든 답변을 종합하여 최적의 솔루션을 설계 중입니다...');
    try {
      const result = await analyzeDecision(topic, questions, answers);
      setAnalysis(result);
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
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-slate-50 text-slate-900">
      <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-500 border border-slate-100">
        
        {/* Top Header */}
        <header className="bg-indigo-600 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl -mr-12 -mt-12">
            <i className="fas fa-brain"></i>
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <i className="fas fa-compass-drafting animate-pulse"></i>
              결정 어드바이저 20
            </h1>
            <p className="opacity-80 mt-2 text-sm md:text-base font-medium">당신의 답변을 데이터로 변환하여 최적의 선택을 제안합니다.</p>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-800 flex items-start gap-3 animate-shake">
            <i className="fas fa-circle-exclamation mt-1"></i>
            <div className="flex-1">
              <p className="text-sm font-semibold">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        <main className="p-6 md:p-10">
          
          {/* STAGE: START */}
          {stage === AppStage.START && (
            <div className="space-y-8 animate-fadeIn">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-lightbulb"></i>
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">어떤 고민이 있으신가요?</h2>
                </div>
                <textarea 
                  className="w-full p-6 border-2 border-slate-100 bg-slate-50 rounded-3xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50/50 transition-all text-lg h-44 resize-none outline-none shadow-inner"
                  placeholder="예: '나에게 가장 적합한 다음 여행지는?', '새로운 취미로 무엇을 시작할까?', '현재 직장에 남을지 이직할지 고민이야' 등"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <button 
                onClick={startDecisionProcess}
                disabled={!topic.trim()}
                className="group w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xl rounded-3xl shadow-xl transform transition active:scale-[0.98] flex items-center justify-center gap-3"
              >
                질문 리스트 생성 <i className="fas fa-wand-sparkles group-hover:rotate-12 transition-transform"></i>
              </button>
            </div>
          )}

          {/* STAGE: LOADING */}
          {(stage === AppStage.GENERATING_QUESTIONS || stage === AppStage.ANALYZING) && (
            <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-fadeIn">
              <div className="relative">
                <div className="w-28 h-28 border-[10px] border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                  <i className="fas fa-gears text-4xl animate-bounce"></i>
                </div>
              </div>
              <div className="text-center space-y-3">
                <p className="text-2xl font-black text-slate-800 tracking-tight">{loadingMessage}</p>
                <p className="text-slate-400">Gemini AI가 고도의 추론 엔진을 가동 중입니다.</p>
              </div>
            </div>
          )}

          {/* STAGE: ANSWERING */}
          {stage === AppStage.ANSWERING && questions.length > 0 && (
            <div className="space-y-8 animate-fadeIn">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-xs font-black text-indigo-500 uppercase tracking-widest">Question {currentIndex + 1} / 20</span>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">
                    {questions[currentIndex].text}
                  </h2>
                </div>
              </div>

              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-1 gap-4 mt-6">
                {questions[currentIndex].options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(option)}
                    className={`p-6 text-left rounded-3xl border-2 transition-all duration-300 flex items-center gap-5 group hover:shadow-lg ${
                      answers[questions[currentIndex].id] === option
                        ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-50/50'
                        : 'border-slate-100 hover:border-indigo-200 bg-white'
                    }`}
                  >
                    <span className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg transition-all ${
                      answers[questions[currentIndex].id] === option
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className={`font-bold text-lg md:text-xl ${
                      answers[questions[currentIndex].id] === option ? 'text-indigo-900' : 'text-slate-600'
                    }`}>{option}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-8 border-t border-slate-100 mt-10">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="px-6 py-4 rounded-2xl font-bold text-slate-400 disabled:opacity-0 hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <i className="fas fa-chevron-left"></i> 이전
                </button>
                <button
                  onClick={handleNext}
                  disabled={!answers[questions[currentIndex].id]}
                  className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all flex items-center gap-2 transform active:scale-95"
                >
                  {currentIndex === questions.length - 1 ? '데이터 분석 실행' : '다음 질문'} 
                  <i className={`fas ${currentIndex === questions.length - 1 ? 'fa-chart-pie' : 'fa-chevron-right'}`}></i>
                </button>
              </div>
            </div>
          )}

          {/* STAGE: RESULT (Beautified HTML) */}
          {stage === AppStage.RESULT && analysis && (
            <div className="space-y-10 animate-fadeIn">
              
              {/* Final Choice Hero Card */}
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-center">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                   <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
                   <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
                </div>
                <div className="relative z-10 space-y-4">
                  <span className="inline-block px-4 py-1.5 bg-indigo-400/30 rounded-full text-xs font-black uppercase tracking-[0.2em] border border-indigo-300/30">Final Recommendation</span>
                  <h2 className="text-3xl md:text-4xl font-black leading-tight">
                    {analysis.finalRecommendation}
                  </h2>
                  <p className="text-indigo-100 text-lg font-medium opacity-90 max-w-lg mx-auto leading-relaxed">
                    {analysis.summary}
                  </p>
                </div>
              </div>

              {/* Reasoning & Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Reasoning Card */}
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <i className="fas fa-brain text-indigo-500"></i> 분석 결과 (Why?)
                  </h3>
                  <ul className="space-y-3">
                    {analysis.reasoning.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-600 leading-relaxed font-medium">
                        <i className="fas fa-circle-check mt-1.5 text-indigo-400 text-[10px]"></i>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pros & Cons Card */}
                <div className="space-y-4">
                  <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 space-y-3">
                    <h3 className="text-sm font-black text-emerald-700 uppercase tracking-tighter flex items-center gap-2">
                      <i className="fas fa-plus-circle"></i> 강점 및 장점
                    </h3>
                    <ul className="space-y-2">
                      {analysis.pros.map((item, i) => (
                        <li key={i} className="text-emerald-800 text-sm font-semibold flex items-center gap-2">
                           <span className="w-1 h-1 bg-emerald-400 rounded-full"></span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 space-y-3">
                    <h3 className="text-sm font-black text-rose-700 uppercase tracking-tighter flex items-center gap-2">
                      <i className="fas fa-minus-circle"></i> 고려해야 할 리스크
                    </h3>
                    <ul className="space-y-2">
                      {analysis.cons.map((item, i) => (
                        <li key={i} className="text-rose-800 text-sm font-semibold flex items-center gap-2">
                           <span className="w-1 h-1 bg-rose-400 rounded-full"></span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Plan Section */}
              <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    <i className="fas fa-rocket text-indigo-400"></i> 실행 가이드 (Action Plan)
                  </h3>
                  <div className="h-px flex-1 bg-slate-800 mx-6 hidden md:block"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.nextSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700 hover:border-indigo-500 transition-colors group">
                      <span className="text-2xl font-black text-slate-700 group-hover:text-indigo-400 transition-colors">0{i+1}</span>
                      <p className="font-semibold text-slate-300 leading-snug">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
                <button 
                  onClick={() => window.print()}
                  className="py-5 bg-white border-2 border-slate-100 text-slate-600 font-bold rounded-3xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm"
                >
                  <i className="fas fa-file-pdf"></i> 리포트 PDF 저장
                </button>
                <button 
                  onClick={resetApp}
                  className="py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-3xl shadow-xl transition-all flex items-center justify-center gap-3 transform active:scale-95"
                >
                  <i className="fas fa-rotate-left"></i> 새로운 결정 분석
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
      
      {/* Enhanced Footer */}
      <footer className="mt-12 text-slate-400 text-xs font-bold uppercase tracking-[0.2em] flex flex-col items-center gap-4 no-print">
        <div className="flex items-center gap-6 opacity-60">
          <span className="flex items-center gap-2"><i className="fas fa-fingerprint"></i> End-to-End Privacy</span>
          <span className="flex items-center gap-2"><i className="fas fa-bolt-lightning"></i> Real-time Analysis</span>
        </div>
        <p className="opacity-40">© 2024 AI DECISION SYSTEM. POWERED BY GEMINI 3 FLASH & PRO.</p>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        .no-print { display: flex; }
        @media print {
          body { background: white; padding: 0; }
          .min-h-screen { display: block; height: auto; padding: 0; }
          .max-w-2xl { max-width: 100%; border: none; shadow: none; }
          .no-print { display: none !important; }
          .rounded-[2.5rem] { border-radius: 0; }
        }
      `}</style>
    </div>
  );
};

export default App;
