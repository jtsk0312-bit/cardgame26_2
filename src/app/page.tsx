"use client";

import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  Play,
  Pause,
  RotateCcw,
  Home as HomeIcon,
  Timer,
  Trophy,
  Sparkles,
  ArrowRight,
  Smile,
  CheckCircle2,
  Sun,
  Moon,
  Cloud,
  Check,
  Loader2,
  AlertCircle,
  Database,
  Medal,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// 8가지 과일 데이터
const FRUITS = [
  { id: "apple", emoji: "🍎", name: "사과", glow: "hover:shadow-rose-300/40" },
  { id: "banana", emoji: "🍌", name: "바나나", glow: "hover:shadow-amber-300/40" },
  { id: "grape", emoji: "🍇", name: "포도", glow: "hover:shadow-purple-300/40" },
  { id: "watermelon", emoji: "🍉", name: "수박", glow: "hover:shadow-emerald-300/40" },
  { id: "strawberry", emoji: "🍓", name: "딸기", glow: "hover:shadow-red-300/40" },
  { id: "orange", emoji: "🍊", name: "오렌지", glow: "hover:shadow-orange-300/40" },
  { id: "pineapple", emoji: "🍍", name: "파인애플", glow: "hover:shadow-yellow-300/40" },
  { id: "kiwi", emoji: "🥝", name: "키위", glow: "hover:shadow-lime-300/40" },
];

interface CardItem {
  instanceId: number;
  fruitId: string;
  emoji: string;
  name: string;
  glow: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export default function CardMatchingGame() {
  // 테마 모드: 'light' | 'dark'
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // 화면 단계: 'intro' | 'playing' | 'completed'
  const [stage, setStage] = useState<"intro" | "playing" | "completed">("intro");
  const [userName, setUserName] = useState("");
  const [nameInput, setNameInput] = useState("");

  // 게임 카드 상태
  const [cards, setCards] = useState<CardItem[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 진행 상태
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moveCount, setMoveCount] = useState(0);

  // 구글 시트 웹앱 URL 및 저장 상태
  const [gasUrl, setGasUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  // TOP 3 랭킹 데이터 상태
  interface RankRecord {
    rank: number;
    name: string;
    score: number;
    finishtime: string;
    timestamp?: string;
  }
  const [topRankings, setTopRankings] = useState<RankRecord[]>([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 로컬스토리지에서 gasUrl 불러오기
  useEffect(() => {
    const savedUrl = localStorage.getItem("gas_webapp_url");
    if (savedUrl) setGasUrl(savedUrl);
  }, []);

  // 로컬스토리지 또는 시스템 테마 감지
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else {
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(isSystemDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", isSystemDark);
    }
  }, []);

  // 테마 토글 함수
  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  // 구글 시트에서 반환된 시간 문자열 정제 ("00:23" 형태로 변환)
  const cleanDisplayTime = (timeStr: any) => {
    if (!timeStr) return "00:00";
    const str = String(timeStr).trim();
    if (str.includes("GMT") || str.includes("1899")) {
      const match = str.match(/(\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        return `${match[1]}:${match[2]}`;
      }
    }
    if (str.includes(":")) {
      const parts = str.split(":");
      if (parts.length >= 2) {
        const m = parts[parts.length - 2].padStart(2, "0");
        const s = parts[parts.length - 1].padStart(2, "0");
        return `${m}:${s}`;
      }
    }
    return str;
  };

  // 구글 시트에서 TOP 3 랭킹 가져오기
  const fetchTop3Rankings = async () => {
    const targetUrl =
      process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL ||
      gasUrl ||
      localStorage.getItem("gas_webapp_url");

    if (!targetUrl || targetUrl.trim() === "") return;

    setIsLoadingRankings(true);
    try {
      // 캐시 방지용 타임스탬프 쿼리 파라미터 추가
      const urlWithCacheBuster = targetUrl.includes("?")
        ? `${targetUrl}&_t=${Date.now()}`
        : `${targetUrl}?_t=${Date.now()}`;

      const res = await fetch(urlWithCacheBuster, {
        method: "GET",
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.top3 && Array.isArray(json.top3)) {
          const cleaned = json.top3.map((item: any) => ({
            ...item,
            finishtime: cleanDisplayTime(item.finishtime),
          }));
          setTopRankings(cleaned);
        }
      }
    } catch (e) {
      console.error("랭킹 조회 실패:", e);
    } finally {
      setIsLoadingRankings(false);
    }
  };

  // 구글 시트에 데이터 저장 함수 (게임 성공 시에만 호출됨)
  const saveRecordToGoogleSheet = async (player: string, timeSec: number, moves: number) => {
    // 1순위: .env.local 환경변수 (NEXT_PUBLIC_GOOGLE_SCRIPT_URL)
    // 2순위: 런타임 상태값 또는 localStorage
    const targetUrl =
      process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL ||
      gasUrl ||
      localStorage.getItem("gas_webapp_url");

    if (!targetUrl || targetUrl.trim() === "") {
      console.warn("NEXT_PUBLIC_GOOGLE_SCRIPT_URL 환경변수 또는 웹앱 URL이 설정되지 않았습니다.");
      setSaveStatus("idle");
      return;
    }

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      const payload = {
        name: player,
        score: moves,
        finishtime: formatTime(timeSec),
      };

      await fetch(targetUrl, {
        method: "POST",
        mode: "no-cors", // Google Apps Script Web App의 CORS 리디렉션 대응
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });

      setSaveStatus("success");
      setSaveMessage("구글 시트에 성공적으로 기록되었습니다!");

      // 저장 완료 후 구글 시트에서 최신 TOP 3 랭킹 재조회 (잠시 딜레이 후 최신 반영)
      setTimeout(() => {
        fetchTop3Rankings();
      }, 1000);
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
      setSaveMessage("시트 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 카드 덱 생성 및 셔플 (8쌍 = 16장)
  const initializeCards = () => {
    const deck: CardItem[] = [];
    let counter = 0;

    FRUITS.forEach((fruit) => {
      for (let i = 0; i < 2; i++) {
        deck.push({
          instanceId: counter++,
          fruitId: fruit.id,
          emoji: fruit.emoji,
          name: fruit.name,
          glow: fruit.glow,
          isFlipped: false,
          isMatched: false,
        });
      }
    });

    // Fisher-Yates 셔플
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    setCards(deck);
    setSelectedIndices([]);
    setIsProcessing(false);
    setMatchedPairs(0);
    setMoveCount(0);
    setElapsedSeconds(0);
    setIsPaused(false);
  };

  // 타이머 작동
  useEffect(() => {
    if (stage === "playing" && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage, isPaused]);

  // 게임 완료 조건 확인 (성공 시에만 구글 시트에 저장)
  useEffect(() => {
    if (stage === "playing" && matchedPairs === 8) {
      setStage("completed");
      if (timerRef.current) clearInterval(timerRef.current);

      // 1) 즉시 현재 구글 시트의 랭킹을 불러옴
      fetchTop3Rankings();

      // 2) 이번 게임 기록 저장 (저장 완료 후 다시 랭킹 갱신)
      saveRecordToGoogleSheet(userName, elapsedSeconds, moveCount);

      try {
        confetti({
          particleCount: 130,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#38bdf8", "#818cf8", "#f472b6", "#fbbf24", "#34d399"],
        });
      } catch (err) {
        console.error(err);
      }
    }
  }, [matchedPairs, stage]);

  // 게임 시작
  const handleStartGame = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nameInput.trim()) return;

    setUserName(nameInput.trim());
    initializeCards();
    setStage("playing");
  };

  // 처음으로 (이름 입력 화면으로 복귀)
  const handleResetToHome = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStage("intro");
    setSelectedIndices([]);
    setCards([]);
    setElapsedSeconds(0);
    setIsPaused(false);
  };

  // 다시 시작 (현재 사용자 유지하고 재배치)
  const handleRestart = () => {
    initializeCards();
    setStage("playing");
  };

  // 일시정지 토글
  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // 카드 클릭 인터랙션
  const handleCardClick = (index: number) => {
    if (isPaused || isProcessing || cards[index].isFlipped || cards[index].isMatched) {
      return;
    }

    const newCards = [...cards];
    newCards[index] = { ...newCards[index], isFlipped: true };
    setCards(newCards);

    const newSelected = [...selectedIndices, index];
    setSelectedIndices(newSelected);

    // 2장의 카드가 열렸을 때 일치 판정
    if (newSelected.length === 2) {
      setIsProcessing(true);
      setMoveCount((prev) => prev + 1);

      const [firstIdx, secondIdx] = newSelected;
      const firstCard = newCards[firstIdx];
      const secondCard = newCards[secondIdx];

      if (firstCard.fruitId === secondCard.fruitId) {
        // 일치한 경우
        setTimeout(() => {
          setCards((prev) => {
            const updated = [...prev];
            updated[firstIdx] = { ...updated[firstIdx], isMatched: true };
            updated[secondIdx] = { ...updated[secondIdx], isMatched: true };
            return updated;
          });
          setMatchedPairs((p) => p + 1);
          setSelectedIndices([]);
          setIsProcessing(false);
        }, 450);
      } else {
        // 불일치 시 다시 뒤집기
        setTimeout(() => {
          setCards((prev) => {
            const updated = [...prev];
            updated[firstIdx] = { ...updated[firstIdx], isFlipped: false };
            updated[secondIdx] = { ...updated[secondIdx], isFlipped: false };
            return updated;
          });
          setSelectedIndices([]);
          setIsProcessing(false);
        }, 850);
      }
    }
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between p-4 sm:p-6 transition-colors duration-500 overflow-x-hidden bg-slate-50 text-slate-800 dark:bg-[#0c1222] dark:text-slate-100">
      {/* 부드러운 배경 앰비언트 글로우 오브젝트 */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-36 -left-36 size-96 rounded-full bg-blue-200/45 dark:bg-indigo-900/25 blur-3xl" />
        <div className="absolute top-1/3 -right-28 size-96 rounded-full bg-teal-200/40 dark:bg-cyan-900/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 size-96 rounded-full bg-rose-200/35 dark:bg-purple-950/20 blur-3xl" />
      </div>

      {/* 상단 네비게이션: 테마 토글 버튼 */}
      <header className="relative z-10 flex w-full max-w-md items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-white/70 dark:bg-white/10 shadow-xs border border-white/60 dark:border-white/10 backdrop-blur-md">
            <span className="text-base">🎴</span>
          </div>
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
            Memory Game
          </span>
        </div>

        {/* 라이트/다크모드 토글 버튼 */}
        <button
          onClick={toggleTheme}
          aria-label="테마 전환"
          className="flex size-10 items-center justify-center rounded-2xl bg-white/75 dark:bg-slate-800/80 border border-white/60 dark:border-slate-700 shadow-sm backdrop-blur-md transition-all hover:scale-105 active:scale-95 text-slate-700 dark:text-amber-400 cursor-pointer"
        >
          {theme === "light" ? (
            <Moon className="size-4.5 text-slate-700 transition-transform duration-300" />
          ) : (
            <Sun className="size-4.5 text-amber-400 transition-transform duration-300" />
          )}
        </button>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="relative z-10 my-auto flex w-full max-w-md flex-col items-center py-4">
        {/* 타이틀 헤더 */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white drop-shadow-xs">
            카드 맞추기 게임
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-400">
            숨겨진 과일 카드를 뒤집어 같은 짝을 모두 찾아보세요.
          </p>
        </div>

        {/* 1. 이름 입력 화면 (Intro) */}
        {stage === "intro" && (
          <div className="w-full rounded-3xl border border-white/70 dark:border-white/10 bg-white/65 dark:bg-slate-900/50 p-6 sm:p-8 shadow-2xl shadow-slate-200/60 dark:shadow-black/50 backdrop-blur-xl transition-all">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-400/20 to-indigo-400/20 dark:from-sky-500/10 dark:to-indigo-500/10 border border-white/50 dark:border-white/10 shadow-inner mb-3 text-3xl">
                ✨
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                플레이어 등록
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                기록 측정을 위한 이름을 입력해 주세요.
              </p>
            </div>

            <form onSubmit={handleStartGame} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  사용자 이름
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="이름을 입력하세요 (예: 홍길동)"
                    className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition outline-none focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-200/50 dark:focus:ring-indigo-900/30 backdrop-blur-md"
                    autoFocus
                  />
                  <Smile className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-slate-400" />
                </div>
              </div>

              <Button
                type="submit"
                disabled={!nameInput.trim()}
                className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] cursor-pointer"
              >
                게임 시작하기
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </form>

            <div className="mt-6 rounded-2xl border border-white/60 dark:border-white/5 bg-slate-100/60 dark:bg-slate-800/40 p-4 backdrop-blur-md">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-indigo-500" /> 게임 팁
              </h3>
              <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
                <li>총 16장의 카드가 4x4로 무작위 배치됩니다.</li>
                <li>카드를 2장씩 뒤집어 같은 과일 8쌍을 맞춰보세요.</li>
                <li>최단 시간 내에 모든 카드를 맞추면 최고 기록 달성!</li>
              </ul>
            </div>
          </div>
        )}

        {/* 2. 게임 진행 화면 (Playing) */}
        {stage === "playing" && (
          <div className="w-full space-y-3.5 sm:space-y-4">
            {/* 상단 반투명 대시보드 */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 rounded-2xl border border-white/70 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 p-2.5 sm:p-3 shadow-lg shadow-slate-200/50 dark:shadow-black/40 backdrop-blur-xl">
              <div className="flex flex-col items-center justify-center rounded-xl bg-white/60 dark:bg-slate-800/60 p-2 text-center border border-white/60 dark:border-white/5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">플레이어</span>
                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[85px]">
                  {userName}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 p-2 text-center border border-indigo-100/60 dark:border-indigo-900/40">
                <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Timer className="size-3" /> 시간
                </span>
                <span className="text-sm sm:text-base font-extrabold font-mono text-indigo-700 dark:text-indigo-300 tracking-wider">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 p-2 text-center border border-emerald-100/60 dark:border-emerald-900/40">
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">매칭</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                  {matchedPairs} <span className="text-[10px] font-normal opacity-70">/ 8</span>
                </span>
              </div>
            </div>

            {/* 컨트롤 바: 일시정지, 다시 시작, 처음으로 */}
            <div className="flex items-center gap-2">
              <Button
                variant={isPaused ? "default" : "outline"}
                onClick={togglePause}
                className={`flex-1 h-9.5 rounded-xl text-xs font-semibold transition-all backdrop-blur-md cursor-pointer ${
                  isPaused
                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20"
                    : "border-white/70 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 hover:bg-white/80 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200"
                }`}
              >
                {isPaused ? (
                  <>
                    <Play className="mr-1.5 size-3.5 fill-current" /> 계속하기
                  </>
                ) : (
                  <>
                    <Pause className="mr-1.5 size-3.5" /> 잠시 멈춤
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleRestart}
                className="flex-1 h-9.5 rounded-xl border-white/70 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 hover:bg-white/80 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-xs font-semibold backdrop-blur-md cursor-pointer"
              >
                <RotateCcw className="mr-1.5 size-3.5" /> 다시 시작
              </Button>

              <Button
                variant="outline"
                onClick={handleResetToHome}
                className="flex-1 h-9.5 rounded-xl border-white/70 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 hover:bg-white/80 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-xs font-semibold backdrop-blur-md cursor-pointer"
              >
                <HomeIcon className="mr-1.5 size-3.5" /> 처음으로
              </Button>
            </div>

            {/* 4x4 반투명 글래스 보드 & 카드 그리드 */}
            <div className="relative rounded-3xl border border-white/80 dark:border-white/10 bg-white/45 dark:bg-slate-900/40 p-3 sm:p-4 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 backdrop-blur-2xl">
              {/* 일시정지 오버레이 */}
              {isPaused && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-3xl bg-slate-900/60 backdrop-blur-md transition-all">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-white/20 border border-white/30 text-amber-300 shadow-xl mb-3 animate-pulse">
                    <Pause className="size-7" />
                  </div>
                  <h3 className="text-base font-bold text-white">게임이 일시정지 되었습니다</h3>
                  <p className="text-xs text-slate-300 mt-1 mb-4">계속 진행하려면 버튼을 눌러주세요</p>
                  <Button
                    onClick={togglePause}
                    className="h-10 px-5 rounded-xl bg-indigo-500 hover:bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-500/30 cursor-pointer"
                  >
                    <Play className="mr-1.5 size-4 fill-current" /> 계속하기
                  </Button>
                </div>
              )}

              {/* 4x4 카드 그리드 (모바일 완벽 반응형) */}
              <div className="grid grid-cols-4 gap-2 sm:gap-3 aspect-square w-full">
                {cards.map((card, idx) => {
                  const isOpen = card.isFlipped || card.isMatched;

                  return (
                    <button
                      key={card.instanceId}
                      onClick={() => handleCardClick(idx)}
                      disabled={isPaused || card.isMatched || card.isFlipped}
                      aria-label={isOpen ? card.name : "카드 뒤집기"}
                      className={`group relative flex flex-col items-center justify-center rounded-2xl transition-all duration-300 select-none cursor-pointer ${
                        isOpen
                          ? "bg-white/80 dark:bg-slate-800/80 border-2 border-indigo-200/80 dark:border-indigo-500/40 shadow-md backdrop-blur-xl scale-98"
                          : "bg-white/40 dark:bg-white/5 border border-white/70 dark:border-white/10 shadow-sm backdrop-blur-md hover:bg-white/60 dark:hover:bg-white/10 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                      } ${
                        card.isMatched
                          ? "!border-emerald-400/80 !bg-emerald-50/80 dark:!bg-emerald-950/40 shadow-emerald-200/40 opacity-90"
                          : ""
                      }`}
                    >
                      {isOpen ? (
                        <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-200">
                          <span className="text-2xl sm:text-4xl filter drop-shadow-sm select-none">
                            {card.emoji}
                          </span>
                          <span className="text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 mt-0.5 sm:mt-1">
                            {card.name}
                          </span>
                        </div>
                      ) : (
                        <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 shadow-2xs group-hover:scale-110 transition-transform">
                          <span className="text-xs sm:text-sm font-black text-slate-400 dark:text-slate-500">
                            ?
                          </span>
                        </div>
                      )}

                      {/* 매칭 완료 표시 */}
                      {card.isMatched && (
                        <div className="absolute top-1.5 right-1.5">
                          <CheckCircle2 className="size-3.5 sm:size-4 text-emerald-500 fill-emerald-100 dark:fill-emerald-900" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 시도 횟수 통계 */}
            <div className="text-center text-xs text-slate-400 dark:text-slate-500">
              뒤집기 시도: <span className="font-semibold text-slate-600 dark:text-slate-300">{moveCount}회</span>
            </div>
          </div>
        )}

        {/* 3. 게임 완료 화면 (Completed) */}
        {stage === "completed" && (
          <div className="w-full rounded-3xl border border-white/70 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-amber-100/80 dark:bg-amber-900/30 text-amber-500 border border-amber-200/60 dark:border-amber-700/40 shadow-inner mb-4 ring-8 ring-amber-50/50 dark:ring-amber-950/30">
              <Trophy className="size-10" />
            </div>

            <span className="inline-block rounded-full bg-emerald-100/90 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">
              🎉 축하합니다! 모든 짝을 맞췄습니다!
            </span>

            <h2 className="text-2xl font-black text-slate-800 dark:text-white">
              <span className="text-indigo-600 dark:text-indigo-400">{userName}</span> 님의 완료 기록
            </h2>

            {/* 결과 통계 카드 */}
            <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-white/60 dark:bg-slate-800/50 p-4 border border-white/60 dark:border-white/5">
              <div className="flex flex-col items-center justify-center rounded-xl bg-white/80 dark:bg-slate-800/80 p-3 shadow-2xs border border-white/50 dark:border-white/5">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <Timer className="size-3.5 text-indigo-500" /> 총 완료 시간
                </span>
                <span className="mt-1 text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                  {formatTime(elapsedSeconds)}
                </span>
                <span className="text-[11px] text-slate-400">({elapsedSeconds}초)</span>
              </div>

              <div className="flex flex-col items-center justify-center rounded-xl bg-white/80 dark:bg-slate-800/80 p-3 shadow-2xs border border-white/50 dark:border-white/5">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <Sparkles className="size-3.5 text-amber-500" /> 시도 횟수
                </span>
                <span className="mt-1 text-2xl font-black font-mono text-slate-800 dark:text-slate-100">
                  {moveCount}
                </span>
                <span className="text-[11px] text-slate-400">회 시도함</span>
              </div>
            </div>

            {/* 구글 시트 저장 상태 표시 */}
            <div className="mt-4 rounded-xl border border-white/60 dark:border-white/5 bg-slate-100/50 dark:bg-slate-800/40 p-3 text-xs">
              {saveStatus === "saving" && (
                <div className="flex items-center justify-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>구글 시트에 기록을 저장하는 중입니다...</span>
                </div>
              )}
              {saveStatus === "success" && (
                <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="size-3.5" />
                  <span>구글 시트에 게임 결과가 성공적으로 저장되었습니다!</span>
                </div>
              )}
              {saveStatus === "error" && (
                <div className="flex items-center justify-center gap-1.5 text-rose-500 font-medium">
                  <AlertCircle className="size-3.5" />
                  <span>구글 시트 저장 실패 (URL 설정을 확인해 주세요)</span>
                </div>
              )}
              {saveStatus === "idle" && (
                <div className="flex items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500">
                  <Database className="size-3.5" />
                  <span>구글 시트 웹앱 URL 연동 시 자동 저장됩니다</span>
                </div>
              )}
            </div>

            {/* 🏆 TOP 3 명예의 전당 랭킹 보드 */}
            <div className="mt-4 rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-b from-amber-50/70 to-white/70 dark:from-amber-950/20 dark:to-slate-900/60 p-4 text-left backdrop-blur-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Trophy className="size-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    실시간 명예의 전당 TOP 3
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  종료시간 오름차순 기준
                </span>
              </div>

              {isLoadingRankings && topRankings.length === 0 ? (
                <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-1.5">
                  <Loader2 className="size-3.5 animate-spin text-amber-500" />
                  <span>구글 시트에서 랭킹을 불러오는 중...</span>
                </div>
              ) : topRankings.length > 0 ? (
                <div className="space-y-2">
                  {topRankings.map((item) => {
                    const isFirst = item.rank === 1;
                    const isSecond = item.rank === 2;
                    const isThird = item.rank === 3;
                    const isCurrentPlayer = item.name === userName;

                    return (
                      <div
                        key={item.rank}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all border ${
                          isFirst
                            ? "bg-amber-100/70 dark:bg-amber-950/40 border-amber-300/80 dark:border-amber-700/60 font-semibold"
                            : isSecond
                            ? "bg-slate-100/70 dark:bg-slate-800/60 border-slate-300/80 dark:border-slate-700 font-medium"
                            : "bg-orange-50/70 dark:bg-orange-950/30 border-orange-200/70 dark:border-orange-800/50"
                        } ${isCurrentPlayer ? "ring-2 ring-indigo-500/80" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex size-5 items-center justify-center rounded-full text-[11px] font-black ${
                              isFirst
                                ? "bg-amber-400 text-amber-950"
                                : isSecond
                                ? "bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-slate-100"
                                : "bg-amber-700 text-white"
                            }`}
                          >
                            {item.rank}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[100px]">
                            {item.name}
                          </span>
                          {isCurrentPlayer && (
                            <span className="text-[10px] rounded-md bg-indigo-500 text-white px-1 py-0.2">
                              나
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {item.score}회
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-amber-300">
                            ⏱ {item.finishtime}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-3 text-xs text-slate-400">
                  아직 등록된 랭킹 기록이 없습니다.
                </div>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <Button
                onClick={handleRestart}
                className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <RotateCcw className="mr-2 size-4" /> 다시 시작
              </Button>

              <Button
                variant="outline"
                onClick={handleResetToHome}
                className="flex-1 h-12 rounded-xl border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-800/60 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <HomeIcon className="mr-2 size-4" /> 처음으로
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* 하단 카피라이트 푸터 */}
      <footer className="relative z-10 w-full text-center py-4">
        <p className="text-xs text-slate-400 dark:text-slate-500 tracking-wide font-medium">
          Copyright INU 카드 맞추기 게임 by 정채린
        </p>
      </footer>
    </div>
  );
}
