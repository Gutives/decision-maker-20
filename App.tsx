
import React, { useState, useEffect } from 'react';
import { AppStage, Question } from './types';
import { generateQuestions, analyzeDecision } from './geminiService';

// 전역 윈도우 객체 확장 - AIStudio 타입이 이미 정의되어 있는 경우 이를 따르도록 수정
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
  const [needsKey, setNeedsKey] = useState(false);

  // 초기 로드 시 API 키 상태 확인
  useEffect(() => {
    const checkApiKey = async () => {
      const envKey = process.env.API_KEY;
      const isKeyMissing = !envKey || envKey === "undefined" || envKey.trim() === "";
      
      if (isKeyMissing && window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setNeedsKey(true);
        }
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio) {
      // 키 선택 대화상자를 엽니다.
      await window.aistudio.openSelectKey();
      // 가이드라인에 따라 선택 성공으로 가정하고 앱을 진행합니다.
      setNeedsKey(false);
    }
  };

  const startDecisionProcess = async () => {
    if (!topic.trim()) return;
    setError(null);
    setStage(AppStage.GENERATING_QUESTIONS);
    setLoadingMessage('결정을 위한 20가지 맞춤 질문을 생성하고 있습니다...');
    
    try {
      const generated = await generateQuestions(topic);
      setQuestions(generated);
      setStage(AppStage.ANSWERING);
      setCurrentIndex(0);
    } catch (err: any) {
      // 404 Requested entity was not found 에러 시 키 선택창 다시 띄우기
      if (err.message && err.message.includes("Requested entity was not found.")) {
        setError("API 키를 찾을 수 없거나 결제 설정이 필요합니다. 다시 선택해주세요.");
        setNeedsKey(true);
      } else {
        setError(err.message || '오류가 발생했습니다.');
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
    setLoadingMessage('답변을 분석하여 최적의 결론을 도출하는 중입니다...');
    try {
      const finalResult = await analyzeDecision(topic, questions, answers);
      setResult(finalResult);
      setStage(AppStage.RESULT);
    } catch (err: any) {
      // 404 Requested entity was not found 에러 시 키 선택창 다시 띄우기
      if (err.message && err.message.includes("Requested entity was not found.")) {
        setError("API 키를 찾을 수 없거나 결제 설정이 필요합니다. 다시 선택해주세요.");
        setNeedsKey(true);
      } else {
        setError(err.message || '분석 중 오류가 발생했습니다.');
      }
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

  // API 키가 필요한 경우의 화면
  if (needsKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-100">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-3xl">
            <i className="fas fa-key"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">API 키 연결 필요</h1>
          <p className="text-slate-600 leading-relaxed">
            Gemini AI를 사용하기 위해 API 키 설정이 필요합니다.<br/>
            아래 버튼을 눌러 유효한 API 키를 선택해주세요.
          </p>
          <button 
            onClick={handleOpenKeyDialog}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3"
          >
            <i className="fas fa-external-link-alt"></i> API 키 선택하기
          </button>
          <p className="text-xs text-slate-400">
            결제 정보가 등록된 프로젝트의 키가 필요할 수 있습니다.<br/>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline">과금 정책 확인하기</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-slate-50">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden transition-all duration-500">
        
        {/* Header Section */}
        <div className="bg-indigo-600 p-6 md:p-8 text-white">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <i className="fas fa-brain"></i>
            스마트 결정 도우미 20
          </h1>
          <p className="opacity-80 mt-2">당신의 고민을 20가지 질문으로 명쾌하게 해결해드립니다.</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="m-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-3 animate-pulse">
            <i className="fas fa-exclamation-circle text-xl"></i>
            <div className="flex-1">
              <p className="font-bold">시스템 오류</p>
              <p className="text-sm opacity-90">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        <div className="p-6 md:p-10">
          
          {/* Stage: START */}
          {stage === AppStage.START && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-lg font-semibold text-gray-700 block">어떤 결정을 내리고 싶으신가요?</label>
                <textarea 
                  className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-colors text-lg h-32 resize-none"
                  placeholder="예: '이번 여름 휴가 어디로 갈까?', '어떤 노트북을 살까?', '이직을 하는게 좋을까?'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <button 
                onClick={startDecisionProcess}
                disabled={!topic.trim()}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-xl rounded-2xl shadow-lg transform transition active:scale-95 flex items-center justify-center gap-3"
              >
                질문 생성하기 <i className="fas fa-arrow-right"></i>
              </button>
            </div>
          )}

          {/* Stage: LOADING (Generating or Analyzing) */}
          {(stage === AppStage.GENERATING_QUESTIONS || stage === AppStage.ANALYZING) && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                  <i className="fas fa-magic text-2xl animate-pulse"></i>
                </div>
              </div>
              <p className="text-xl font-medium text-gray-600 text-center animate-pulse">{loadingMessage}</p>
            </div>
          )}

          {/* Stage: ANSWERING */}
          {stage === AppStage.ANSWERING && questions.length > 0 && (
            <div className="space-y-8">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-semibold text-indigo-600">
                  <span>질문 {currentIndex + 1} / {questions.length}</span>
                  <span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Question Card */}
              <div className="animate-fadeIn">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 min-h-[4rem]">
                  {questions[currentIndex].text}
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {questions[currentIndex].options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(option)}
                      className={`p-4 text-left rounded-xl border-2 transition-all duration-200 flex items-center gap-3 group ${
                        answers[questions[currentIndex].id] === option
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${
                        answers[questions[currentIndex].id] === option
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span className="font-medium">{option}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-8">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-chevron-left"></i> 이전
                </button>
                <button
                  onClick={handleNext}
                  disabled={!answers[questions[currentIndex].id]}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center gap-2"
                >
                  {currentIndex === questions.length - 1 ? '최종 결과 보기' : '다음'} <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            </div>
          )}

          {/* Stage: RESULT */}
          {stage === AppStage.RESULT && result && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-green-600 mb-2">
                <i className="fas fa-check-circle text-3xl"></i>
                <h2 className="text-2xl font-bold">결정이 완료되었습니다!</h2>
              </div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 prose prose-indigo max-w-none">
                <div className="whitespace-pre-wrap text-slate-700 leading-relaxed text-lg">
                  {result}
                </div>
              </div>
              <button 
                onClick={resetApp}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-2xl shadow-lg transform transition active:scale-95 flex items-center justify-center gap-3 mt-8"
              >
                <i className="fas fa-redo"></i> 처음부터 다시 시작
              </button>
            </div>
          )}

        </div>
      </div>
      
      {/* Footer Info */}
      <div className="mt-8 text-slate-400 text-sm flex items-center gap-2">
        <i className="fas fa-shield-alt"></i>
        Powered by Gemini AI • 당신의 현명한 선택을 응원합니다
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
