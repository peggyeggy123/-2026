/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  Ruler, 
  Settings2, 
  Info, 
  AlertCircle, 
  ArrowRightLeft,
  Columns2,
  Download,
  Maximize2,
  Box,
  Layers,
  Layout,
  ChevronRight,
  ChevronDown,
  Check
} from 'lucide-react';
import FenceModelViewer from './components/FenceModel';
import { Toaster, toast } from 'sonner';

// --- Types ---

interface CalculationResult {
  count: number;
  actualCTC: number;
  actualGap: number;
  effectiveLength: number;
  totalWidthOfRails: number;
  totalWidthOfGaps: number;
  recommendation?: string;
}

// --- Components ---

export default function App() {
  // Inputs
  const [totalLength, setTotalLength] = useState<number>(3000);
  const [sideOffset, setSideOffset] = useState<number>(0);
  const [railWidth, setRailWidth] = useState<number>(40);
  const [railHeight, setRailHeight] = useState<number>(850);
  const [targetCTC, setTargetCTC] = useState<number>(150);
  const [upperRailOffset, setUpperRailOffset] = useState<number>(100);
  const [lowerRailOffset, setLowerRailOffset] = useState<number>(100);
  const [hRailWidth, setHRailWidth] = useState<number>(60);
  const [hRailThickness, setHRailThickness] = useState<number>(40);
  const [picketThickness, setPicketThickness] = useState<number>(20);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Defer heavy values to keep inputs responsive
  const deferredTotalLength = useDeferredValue(totalLength);
  const deferredSideOffset = useDeferredValue(sideOffset);
  const deferredRailWidth = useDeferredValue(railWidth);
  const deferredRailHeight = useDeferredValue(railHeight);
  const deferredTargetCTC = useDeferredValue(targetCTC);
  const deferredUpperRailOffset = useDeferredValue(upperRailOffset);
  const deferredLowerRailOffset = useDeferredValue(lowerRailOffset);
  const deferredHRailWidth = useDeferredValue(hRailWidth);
  const deferredHRailThickness = useDeferredValue(hRailThickness);
  const deferredPicketThickness = useDeferredValue(picketThickness);

  const railingRef = React.useRef<SVGSVGElement>(null);

  const copyToClipboard = (text: string, description: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success(`${description} 已複製到剪貼簿`, {
        description: "您可以直接在 AutoCAD 指令行貼上執行。",
        duration: 2000,
      });
    }).catch(() => {
      toast.error("複製失敗", {
        description: "請手動選取文字進行複製。",
      });
    });
  };

  const downloadSvgAsPng = (svgRef: React.RefObject<SVGSVGElement | null>, fileName: string) => {
    const svg = svgRef.current;
    if (!svg) return;

    // Ensure xmlns is present for standalone SVG rendering
    if (!svg.getAttribute('xmlns')) {
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    // Clone the SVG to avoid modifying the live DOM
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    
    // Inline some critical styles that might be lost
    clonedSvg.style.fontFamily = 'Inter, sans-serif';

    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use the actual SVG dimensions
    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 160;
    
    const scale = 3; // Higher scale for better quality
    canvas.width = width * scale;
    canvas.height = height * scale;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `${fileName}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.onerror = (err) => {
      console.error("Image load error:", err);
      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  // Calculation Logic
  const result = useMemo((): CalculationResult => {
    // L_eff is the distance from the outer edge of the first rail to the outer edge of the last rail
    const L_eff = totalLength - 2 * sideOffset;
    const W = railWidth;
    const T = targetCTC;

    if (L_eff <= W) {
      return { count: 1, actualCTC: 0, actualGap: 0, effectiveLength: L_eff, totalWidthOfRails: W, totalWidthOfGaps: 0 };
    }

    let k_minus_1 = Math.round((L_eff - W) / T);
    if (k_minus_1 < 1) k_minus_1 = 1;
    
    const k = k_minus_1 + 1;
    const actualCTC = (L_eff - W) / k_minus_1;
    const actualGap = actualCTC - W;

    let recommendation = "";
    if (actualGap < 50) {
      recommendation = "內部間距過窄（小於 50mm），建議減少支數。";
    } else if (actualGap > 200) {
      recommendation = "內部間距過寬（大於 200mm），建議增加支數。";
    }

    return {
      count: k,
      actualCTC,
      actualGap,
      effectiveLength: L_eff,
      totalWidthOfRails: k * W,
      totalWidthOfGaps: k_minus_1 * actualGap,
      recommendation
    };
  }, [totalLength, sideOffset, railWidth, targetCTC]);

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#F5F5F0]">
      <Toaster position="top-center" richColors />
      {/* Header */}
      <header className="border-b border-[#141414]/10 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#141414] rounded-sm flex items-center justify-center">
              <Calculator className="text-white w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight uppercase italic font-serif">
              格柵神算版
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-xs font-mono opacity-50">
              <span>精度: 0.1mm</span>
              <div className="w-1 h-1 bg-[#141414] rounded-full" />
              <span>對稱性: 完美</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white border border-[#141414]/10 rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-8">
              <Settings2 className="w-5 h-5 opacity-70" />
              <h2 className="text-lg font-bold uppercase tracking-widest">參數設定</h2>
            </div>

            <div className="space-y-6">
              <InputField 
                label="總長度" 
                value={totalLength} 
                onChange={setTotalLength} 
                unit="mm" 
                icon={<Maximize2 className="w-4 h-4" />}
              />
              <InputField 
                label="格柵寬度" 
                value={railWidth} 
                onChange={setRailWidth} 
                unit="mm" 
                icon={<Columns2 className="w-4 h-4" />}
              />
              <InputField 
                label="目標中心距" 
                value={targetCTC} 
                onChange={setTargetCTC} 
                unit="mm" 
                icon={<Ruler className="w-4 h-4" />}
              />
              <InputField 
                label="單邊預留位 (預設值0)" 
                value={sideOffset} 
                onChange={setSideOffset} 
                unit="mm" 
                icon={<ArrowRightLeft className="w-4 h-4" />}
              />
              <InputField 
                label="上橫樑位置 (預設值100)" 
                value={upperRailOffset} 
                onChange={setUpperRailOffset} 
                unit="mm" 
                icon={<Layers className="w-4 h-4" />}
                description="由頂部向下偏移"
              />
              <InputField 
                label="下橫樑位置 (預設值100)" 
                value={lowerRailOffset} 
                onChange={setLowerRailOffset} 
                unit="mm" 
                icon={<Layers className="w-4 h-4" />}
                description="由底部向上偏移"
              />
              <InputField 
                label="格柵高度 (預設值850)" 
                value={railHeight} 
                onChange={setRailHeight} 
                unit="mm" 
                icon={<Maximize2 className="w-4 h-4" />}
              />
              <InputField 
                label="上下橫樑高度 (預設值60)" 
                value={hRailWidth} 
                onChange={setHRailWidth} 
                unit="mm" 
                icon={<Maximize2 className="w-4 h-4" />}
              />
            </div>
          </section>
        </div>

        {/* Right Column: Visualization */}
        <div className="lg:col-span-8 space-y-8 flex flex-col">
          <section className="bg-white border border-[#141414]/10 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Columns2 className="w-5 h-5 opacity-50" />
                <h2 className="text-lg font-bold uppercase tracking-widest">排列示意圖</h2>
              </div>
              <button 
                onClick={() => downloadSvgAsPng(railingRef, 'fence-arrangement')}
                className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity bg-[#141414]/5 px-3 py-1.5 rounded-lg"
              >
                <Download className="w-4 h-4" />
                導出圖面 (PNG)
              </button>
            </div>

            <div className="flex items-center justify-center min-h-[200px] bg-[#F9F9F7] rounded-xl border border-dashed border-[#141414]/10 p-2 overflow-x-auto">
              <RailingVisualizer 
                ref={railingRef}
                totalLength={deferredTotalLength}
                sideOffset={deferredSideOffset}
                railWidth={deferredRailWidth}
                count={result.count}
                actualCTC={result.actualCTC}
                actualGap={result.actualGap}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <LegendItem color="bg-gray-300" label="邊界/牆" />
              <LegendItem color="bg-blue-500" label="預留位" />
              <LegendItem color="bg-[#141414]" label="格柵" />
              <LegendItem color="bg-amber-500" label="淨間距" />
            </div>
          </section>

          {/* 3D Preview Section */}
          <section className="bg-white border border-[#141414]/10 rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 opacity-50" />
                <h2 className="text-lg font-bold uppercase tracking-widest">3D 即時預覽</h2>
              </div>
              <div className="text-[10px] font-mono opacity-30">REAL-TIME RENDER</div>
            </div>
            <div className="flex-1 min-h-0">
              <FenceModelViewer 
                totalLength={deferredTotalLength}
                postSize={deferredSideOffset}
                lowerRailHeight={deferredLowerRailOffset}
                upperRailTopOffset={deferredUpperRailOffset}
                picketWidth={deferredRailWidth}
                picketThickness={deferredPicketThickness}
                picketHeight={deferredRailHeight}
                picketGroundClearance={0}
                picketSpacing={result.actualGap}
                mode="calculator"
                count={result.count}
                hRailWidth={deferredHRailWidth}
                hRailThickness={deferredHRailThickness}
              />
            </div>
          </section>

          {/* Stats Summary */}
          <section className="bg-[#141414] text-white rounded-2xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2 opacity-70">
                <Info className="w-5 h-5" />
                <h2 className="text-lg font-bold uppercase tracking-widest">計算詳解</h2>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-white/10 rounded-xl space-y-2">
                  <p className="text-base text-white/60 uppercase tracking-wider">算式推導</p>
                  <p className="text-lg font-mono text-white/90">
                    (有效長度 - 格柵寬) ÷ 目標中心距<br/>
                    ({result.effectiveLength} - {railWidth}) ÷ {targetCTC} = {((result.effectiveLength - railWidth) / targetCTC).toFixed(1)}
                  </p>
                  <p className="text-base text-white/60 italic">
                    取最接近整數為內部間距數：{result.count - 1}
                  </p>
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div className="grid grid-cols-1 gap-6">
                <StatItem label="最終支數" value={result.count} unit="支" highlight />
                <StatItem label="實際中心距" value={result.actualCTC.toFixed(1)} unit="mm" />
                <StatItem label="實際淨間距" value={result.actualGap.toFixed(1)} unit="mm" />
              </div>
            </div>

            {result.recommendation && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-start"
              >
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-base text-amber-200 leading-relaxed">
                  {result.recommendation}
                </p>
              </motion.div>
            )}
          </section>

          {/* CAD Code Generation Section */}
          <section className="bg-white border border-[#141414]/10 rounded-2xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 opacity-70" />
                <h2 className="text-lg font-bold uppercase tracking-widest leading-tight">
                  程式碼生成<br/>
                  (正視圖)
                </h2>
              </div>
              <button 
                onClick={() => {
                  const script = generateCADScript(totalLength, sideOffset, result.count, result.actualCTC, railWidth, railHeight, upperRailOffset, lowerRailOffset, hRailWidth);
                  copyToClipboard(script, "正視圖程式碼", "front");
                }}
                className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 bg-[#141414] text-white px-5 py-2.5 rounded-lg hover:bg-[#141414]/90 hover:border-orange-400 transition-all active:scale-95 shadow-md border-[3px] border-orange-500 hover:shadow-orange-500/20"
              >
                {copiedId === "front" ? <Check className="w-5 h-5 text-green-400" /> : <Download className="w-5 h-5" />}
                {copiedId === "front" ? "已複製" : "複製程式碼"}
              </button>
            </div>
            
            <div className="bg-[#F9F9F7] rounded-xl p-6 border border-[#141414]/10 mb-6">
              <p className="text-base text-[#141414]/80 mb-4 leading-relaxed">
                將下方 AutoLISP 程式碼複製，並貼上到 AutoCAD 的指令行中。這會自動繪製所有格柵。
              </p>
              <textarea 
                readOnly
                onFocus={(e) => e.target.select()}
                className="w-full text-sm font-mono bg-white p-4 rounded-lg border border-[#141414]/10 overflow-x-auto h-64 whitespace-pre resize-none focus:outline-none focus:ring-2 focus:ring-[#141414]/5"
                value={generateCADScript(totalLength, sideOffset, result.count, result.actualCTC, railWidth, railHeight, upperRailOffset, lowerRailOffset, hRailWidth)}
              />
            </div>

            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`w-full text-sm font-black uppercase tracking-[0.2em] px-6 py-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl ${
                showAdvanced 
                  ? 'bg-[#141414] text-white hover:bg-[#141414]/90' 
                  : 'bg-amber-500 text-[#141414] hover:bg-amber-400 shadow-amber-500/30'
              }`}
            >
              {showAdvanced ? '隱藏進階選項' : '延伸看更多 (進階視圖)'}
              <ChevronRight className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
            </button>
          </section>

          {/* Advanced View Section */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-8"
              >
                <section className="bg-white border border-[#141414]/10 rounded-2xl p-8 shadow-sm space-y-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      <Maximize2 className="w-5 h-5 opacity-70" />
                      <h2 className="text-lg font-bold uppercase tracking-widest leading-tight">
                        進階視圖生成<br/>
                        (上視圖與側視圖)
                      </h2>
                    </div>
                    <div className="hidden md:block">
                      <span className="px-5 py-2 bg-[#141414] text-white text-xs font-black uppercase tracking-[0.25em] rounded-full shadow-md">
                        進階視圖模式
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField 
                      label="格柵厚度" 
                      value={picketThickness} 
                      onChange={setPicketThickness} 
                      unit="mm" 
                      icon={<Box className="w-4 h-4" />}
                      description="用於上視圖與側視圖繪製"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <InputField 
                        label="橫樑高度" 
                        value={hRailWidth} 
                        onChange={setHRailWidth} 
                        unit="mm" 
                        icon={<Maximize2 className="w-4 h-4" />}
                      />
                      <InputField 
                        label="橫樑寬度" 
                        value={hRailThickness} 
                        onChange={setHRailThickness} 
                        unit="mm" 
                        icon={<Layout className="w-4 h-4" />}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Top View Card */}
                    <div className="bg-[#F9F9F7] rounded-2xl p-6 border border-[#141414]/10 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold uppercase tracking-widest text-lg flex items-center gap-2">
                          <Layout className="w-4 h-4" />
                          上視圖
                        </h3>
                        <div className="flex gap-2">
                          <button 
                            className="bg-[#141414] text-white text-xs font-bold uppercase px-4 py-2 rounded-md hover:bg-[#141414]/80 hover:border-orange-400 transition-all active:scale-95 flex items-center gap-2 min-w-[110px] justify-center shadow-sm border-[3px] border-orange-500 hover:shadow-orange-500/20"
                            onClick={() => {
                              const script = generateTopViewScript(totalLength, sideOffset, result.count, result.actualCTC, railWidth, picketThickness, hRailThickness);
                              copyToClipboard(script, "上視圖程式碼", "top");
                            }}
                          >
                            {copiedId === "top" ? <Check className="w-4 h-4 text-green-400" /> : <Download className="w-4 h-4" />}
                            {copiedId === "top" ? "已複製" : "複製程式碼"}
                          </button>
                        </div>
                      </div>
                      <textarea 
                        readOnly
                        onFocus={(e) => e.target.select()}
                        className="w-full text-xs font-mono bg-white p-3 rounded-lg border border-[#141414]/10 overflow-x-auto h-24 whitespace-pre resize-none focus:outline-none focus:ring-2 focus:ring-[#141414]/5"
                        value={generateTopViewScript(totalLength, sideOffset, result.count, result.actualCTC, railWidth, picketThickness, hRailThickness)}
                      />
                    </div>

                    {/* Side View Card */}
                    <div className="bg-[#F9F9F7] rounded-2xl p-6 border border-[#141414]/10 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold uppercase tracking-widest text-lg flex items-center gap-2">
                          <Columns2 className="w-4 h-4" />
                          側視圖
                        </h3>
                        <div className="flex gap-2">
                          <button 
                            className="bg-[#141414] text-white text-xs font-bold uppercase px-4 py-2 rounded-md hover:bg-[#141414]/80 hover:border-orange-400 transition-all active:scale-95 flex items-center gap-2 min-w-[110px] justify-center shadow-sm border-[3px] border-orange-500 hover:shadow-orange-500/20"
                            onClick={() => {
                              const script = generateSideViewScript(railHeight, upperRailOffset, lowerRailOffset, hRailWidth, picketThickness, hRailThickness);
                              copyToClipboard(script, "側視圖程式碼", "side");
                            }}
                          >
                            {copiedId === "side" ? <Check className="w-4 h-4 text-green-400" /> : <Download className="w-4 h-4" />}
                            {copiedId === "side" ? "已複製" : "複製程式碼"}
                          </button>
                        </div>
                      </div>
                      <textarea 
                        readOnly
                        onFocus={(e) => e.target.select()}
                        className="w-full text-xs font-mono bg-white p-3 rounded-lg border border-[#141414]/10 overflow-x-auto h-24 whitespace-pre resize-none focus:outline-none focus:ring-2 focus:ring-[#141414]/5"
                        value={generateSideViewScript(railHeight, upperRailOffset, lowerRailOffset, hRailWidth, picketThickness, hRailThickness)}
                      />
                    </div>
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-[#141414]/20 flex flex-col md:flex-row justify-between items-center gap-6 opacity-70 text-xs uppercase tracking-[0.2em] font-bold">
        <p>© 2026 格柵神算版 - 結構精度</p>
        <div className="flex gap-8">
          <span>對稱演算法 v2.4</span>
        </div>
      </footer>
    </div>
  );
}

// --- Sub-components ---

const InputField = React.memo(function InputField({ label, value, onChange, unit, icon, description }: { 
  label: string, 
  value: number, 
  onChange: (v: number) => void, 
  unit: string,
  icon: React.ReactNode,
  description?: string
}) {
  const [localValue, setLocalValue] = useState<string>(value.toString());
  const labelParts = label.split(/(\(.*\))/);

  // Sync local value with prop value when it changes externally
  useEffect(() => {
    if (Number(localValue) !== value) {
      setLocalValue(value.toString());
    }
  }, [value]);
  
  return (
    <div className="group">
      <label className="text-base font-bold uppercase tracking-widest opacity-90 mb-2 block flex items-center gap-2 group-focus-within:opacity-100 transition-opacity">
        {icon}
        <span className="flex items-baseline gap-1.5">
          {labelParts.map((part, i) => 
            part.startsWith('(') && part.endsWith(')') 
              ? <span key={i} className="text-[11px] font-bold opacity-100 text-amber-700 tracking-normal">{part}</span>
              : part
          )}
        </span>
      </label>
      <div className="relative">
        <input 
          type="number" 
          value={localValue} 
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const val = e.target.value;
            setLocalValue(val);
            if (val !== "") {
              onChange(Number(val));
            }
          }}
          onBlur={() => {
            // If empty on blur, reset to 0 or current value
            if (localValue === "") {
              setLocalValue("0");
              onChange(0);
            }
          }}
          className="w-full bg-[#F9F9F7] border border-[#141414]/10 rounded-xl px-4 py-3 text-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#141414]/10 focus:border-[#141414] transition-all"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-bold opacity-50 uppercase">{unit}</span>
      </div>
      {description && (
        <p className="mt-1.5 text-[12px] font-bold uppercase tracking-widest opacity-50">
          {description}
        </p>
      )}
    </div>
  );
});

const StatItem = React.memo(function StatItem({ label, value, unit, highlight = false }: { label: string, value: string | number, unit: string, highlight?: boolean }) {
  return (
    <div className="flex justify-between items-end">
      <span className="text-base font-bold uppercase tracking-widest opacity-70">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-serif italic ${highlight ? 'text-5xl text-white' : 'text-3xl text-white'}`}>{value}</span>
        <span className="text-base font-bold uppercase opacity-50">{unit}</span>
      </div>
    </div>
  );
});

const LegendItem = React.memo(function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-5 h-5 rounded-full ${color}`} />
      <span className="text-base font-bold uppercase tracking-widest opacity-70">{label}</span>
    </div>
  );
});

const RailingVisualizer = React.memo(function RailingVisualizer({ 
  totalLength, 
  sideOffset, 
  railWidth, 
  count, 
  actualCTC, 
  actualGap,
  ref
}: { 
  totalLength: number, 
  sideOffset: number, 
  railWidth: number, 
  count: number, 
  actualCTC: number, 
  actualGap: number,
  ref: React.RefObject<SVGSVGElement | null>
}) {
  // Scaling logic
  const padding = 20;
  const svgWidth = 800;
  const svgHeight = 160;
  const viewWidth = svgWidth - 2 * padding;
  // Guard against division by zero or negative values
  const safeTotalLength = Math.max(1, totalLength);
  const scale = viewWidth / safeTotalLength;

  const h = 40;  // Rail height
  const y = 50;  // Rail y pos

  const rails = [];
  for (let i = 0; i < count; i++) {
    // First rail starts exactly at sideOffset
    const x = sideOffset + i * actualCTC;
    rails.push(x);
  }

  return (
    <svg 
      ref={ref} 
      width={svgWidth} 
      height={svgHeight} 
      viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
      className="w-full h-auto drop-shadow-sm bg-white"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background Line */}
      <line 
        x1={padding} 
        y1={y + h + 20} 
        x2={padding + totalLength * scale} 
        y2={y + h + 20} 
        stroke="#141414" 
        strokeWidth="1" 
        strokeDasharray="4 4" 
        opacity="0.2"
      />

      {/* Total Length Label */}
      <text 
        x={padding + (totalLength * scale) / 2} 
        y={15} 
        textAnchor="middle" 
        style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', fill: 'rgba(20, 20, 20, 0.6)' }}
      >
        總長度: {totalLength}mm
      </text>
      <line 
        x1={padding} 
        y1={20} 
        x2={padding + totalLength * scale} 
        y2={20} 
        stroke="#141414" 
        strokeWidth="0.5" 
        opacity="0.2"
      />

      {/* Left Wall */}
      <rect 
        x={padding - 8} 
        y={y - 10} 
        width={8} 
        height={h + 20} 
        fill="#141414"
        fillOpacity="0.1"
        rx="1"
      />
      <line x1={padding} y1={y - 10} x2={padding} y2={y + h + 10} stroke="#141414" strokeWidth="2" opacity="0.3" />

      {/* Right Wall */}
      <rect 
        x={padding + totalLength * scale} 
        y={y - 10} 
        width={8} 
        height={h + 20} 
        fill="#141414"
        fillOpacity="0.1"
        rx="1"
      />
      <line x1={padding + totalLength * scale} y1={y - 10} x2={padding + totalLength * scale} y2={y + h + 10} stroke="#141414" strokeWidth="2" opacity="0.3" />

      {/* Left Offset */}
      <rect 
        x={padding} 
        y={y} 
        width={sideOffset * scale} 
        height={h} 
        fill="url(#offsetGradient)" 
        fillOpacity="0.2"
      />
      <line x1={padding + sideOffset * scale} y1={y - 10} x2={padding + sideOffset * scale} y2={y + h + 10} stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" />
      
      {/* Left Offset Label */}
      {sideOffset > 0 && (
        <g>
          {/* Extension lines */}
          <line x1={padding} y1={y + h + 5} x2={padding} y2={y + h + 45} stroke="#3b82f6" strokeWidth="0.5" opacity="0.4" />
          <line x1={padding + sideOffset * scale} y1={y + h + 5} x2={padding + sideOffset * scale} y2={y + h + 45} stroke="#3b82f6" strokeWidth="0.5" opacity="0.4" />
          
          <line 
            x1={padding} 
            y1={y + h + 35} 
            x2={padding + sideOffset * scale} 
            y2={y + h + 35} 
            stroke="#3b82f6" 
            strokeWidth="1" 
            markerStart="url(#arrowStartBlue)"
            markerEnd="url(#arrowEndBlue)"
          />
          <text 
            x={padding + (sideOffset * scale) / 2} 
            y={y + h + 30} 
            textAnchor="middle" 
            stroke="white"
            strokeWidth="3"
            strokeLinejoin="round"
            style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', opacity: 0.5 }}
          >
            {sideOffset * scale > 40 ? `預留 ${sideOffset}` : sideOffset}
          </text>
          <text 
            x={padding + (sideOffset * scale) / 2} 
            y={y + h + 30} 
            textAnchor="middle" 
            style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', fill: '#3b82f6' }}
          >
            {sideOffset * scale > 40 ? `預留 ${sideOffset}` : sideOffset}
          </text>
        </g>
      )}

      {/* Right Offset */}
      <rect 
        x={padding + (totalLength - sideOffset) * scale} 
        y={y} 
        width={sideOffset * scale} 
        height={h} 
        fill="url(#offsetGradient)" 
        fillOpacity="0.2"
      />
      <line x1={padding + (totalLength - sideOffset) * scale} y1={y - 10} x2={padding + (totalLength - sideOffset) * scale} y2={y + h + 10} stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" />

      {/* Right Offset Label */}
      {sideOffset > 0 && (
        <g>
          {/* Extension lines */}
          <line x1={padding + (totalLength - sideOffset) * scale} y1={y + h + 5} x2={padding + (totalLength - sideOffset) * scale} y2={y + h + 45} stroke="#3b82f6" strokeWidth="0.5" opacity="0.4" />
          <line x1={padding + totalLength * scale} y1={y + h + 5} x2={padding + totalLength * scale} y2={y + h + 45} stroke="#3b82f6" strokeWidth="0.5" opacity="0.4" />

          <line 
            x1={padding + (totalLength - sideOffset) * scale} 
            y1={y + h + 35} 
            x2={padding + totalLength * scale} 
            y2={y + h + 35} 
            stroke="#3b82f6" 
            strokeWidth="1" 
            markerStart="url(#arrowStartBlue)"
            markerEnd="url(#arrowEndBlue)"
          />
          <text 
            x={padding + (totalLength - sideOffset / 2) * scale} 
            y={y + h + 30} 
            textAnchor="middle" 
            stroke="white"
            strokeWidth="3"
            strokeLinejoin="round"
            style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', opacity: 0.5 }}
          >
            {sideOffset * scale > 40 ? `預留 ${sideOffset}` : sideOffset}
          </text>
          <text 
            x={padding + (totalLength - sideOffset / 2) * scale} 
            y={y + h + 30} 
            textAnchor="middle" 
            style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', fill: '#3b82f6' }}
          >
            {sideOffset * scale > 40 ? `預留 ${sideOffset}` : sideOffset}
          </text>
        </g>
      )}

      {/* Rails */}
      {rails.map((x, i) => (
        <g key={i}>
          <motion.rect 
            initial={{ height: 0, y: y + h }}
            animate={{ height: h, y: y }}
            transition={{ delay: i * 0.05, duration: 0.5, ease: "circOut" }}
            x={padding + x * scale} 
            y={y} 
            width={railWidth * scale} 
            height={h} 
            fill="#141414"
            rx="1"
          />
          {/* CTC Label (only for first two) */}
          {i === 0 && count > 1 && (
             <g>
                <path 
                  d={`M ${padding + (x + railWidth/2) * scale} ${y - 12} L ${padding + (x + actualCTC + railWidth/2) * scale} ${y - 12}`} 
                  stroke="#141414" 
                  strokeWidth="0.5" 
                  fill="none" 
                  markerStart="url(#dot)" 
                  markerEnd="url(#dot)" 
                />
                <text 
                  x={padding + (x + actualCTC/2 + railWidth/2) * scale} 
                  y={y - 18} 
                  textAnchor="middle" 
                  style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', fill: '#141414' }}
                >
                  實際中心距: {actualCTC.toFixed(1)}
                </text>
             </g>
          )}
          {/* Gap Label (only for first internal gap) */}
          {i === 0 && count > 1 && (
            <g>
              <path 
                d={`M ${padding + (x + railWidth) * scale} ${y + h/2} L ${padding + (x + actualCTC) * scale} ${y + h/2}`} 
                stroke="#f59e0b" 
                strokeWidth="1" 
                opacity="0.5"
              />
              <text 
                x={padding + (x + railWidth + actualGap/2) * scale} 
                y={y + h/2 - 5} 
                textAnchor="middle" 
                style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', fill: '#f59e0b' }}
              >
                {actualGap.toFixed(1)}
              </text>
            </g>
          )}
        </g>
      ))}

      {/* Definitions */}
      <defs>
        <linearGradient id="offsetGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3">
          <circle cx="5" cy="5" r="5" fill="#141414" />
        </marker>
        <marker id="arrowStartBlue" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="10 0, 0 3.5, 10 7" fill="#3b82f6" />
        </marker>
        <marker id="arrowEndBlue" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
        </marker>
      </defs>
    </svg>
  );
});

/**
 * Generates an AutoLISP block to draw only the vertical pickets (rails).
 * This can be pasted directly into the AutoCAD command line.
 */
function generateCADScript(totalLength: number, sideOffset: number, count: number, actualCTC: number, railWidth: number, railHeight: number, upperRailOffset: number, lowerRailOffset: number, hRailWidth: number): string {
  let lisp = "(progn\n";
  lisp += "  (setq old_osmode (getvar \"OSMODE\"))\n";
  lisp += "  (setvar \"OSMODE\" 0)\n";
  lisp += "  (setq pt (getpoint \"\\n請在圖面中點選格柵的左下角插入點: \"))\n";
  lisp += "  (if pt (progn\n";
  lisp += "    (setq bx (car pt) by (cadr pt))\n";
  
  // --- Draw Horizontal Rails (Pink) ---
  lisp += "    (setvar \"CECOLOR\" \"6\")\n"; // Pink/Magenta
  
  // Upper Rail: Top edge is railHeight - upperRailOffset
  const ur_y2 = (railHeight - upperRailOffset).toFixed(2);
  const ur_y1 = (railHeight - upperRailOffset - hRailWidth).toFixed(2);
  lisp += `    (command \"_RECTANG\" (list bx (+ by ${ur_y1})) (list (+ bx ${totalLength.toFixed(2)}) (+ by ${ur_y2})))\n`;
  
  // Lower Rail: Bottom edge is lowerRailOffset
  const lr_y1 = (lowerRailOffset).toFixed(2);
  const lr_y2 = (lowerRailOffset + hRailWidth).toFixed(2);
  lisp += `    (command \"_RECTANG\" (list bx (+ by ${lr_y1})) (list (+ bx ${totalLength.toFixed(2)}) (+ by ${lr_y2})))\n`;

  // --- Draw Vertical Pickets (Orange-Brown) ---
  lisp += "    (setvar \"CECOLOR\" \"34\")\n"; // Orange-Brown
  for (let i = 0; i < count; i++) {
    const x1 = (sideOffset + i * actualCTC).toFixed(2);
    const y1 = "0.00";
    const x2 = (sideOffset + i * actualCTC + railWidth).toFixed(2);
    const y2 = railHeight.toFixed(2);
    lisp += `    (command \"_RECTANG\" (list (+ bx ${x1}) (+ by ${y1})) (list (+ bx ${x2}) (+ by ${y2})))\n`;
  }

  lisp += "    (setvar \"CECOLOR\" \"256\")\n"; // Reset to ByLayer
  lisp += "  ))\n"; // End of if pt
  lisp += "  (setvar \"OSMODE\" old_osmode)\n";
  lisp += "  (princ \"\\n格柵生成完畢。\")\n";
  lisp += "  (princ)\n)";
  return lisp;
}

function generateTopViewScript(totalLength: number, sideOffset: number, count: number, actualCTC: number, railWidth: number, picketThickness: number, hRailThickness: number): string {
  let lisp = "(progn\n";
  lisp += "  (setq old_osmode (getvar \"OSMODE\"))\n";
  lisp += "  (setvar \"OSMODE\" 0)\n";
  lisp += "  (setq pt (getpoint \"\\n請在圖面中點選上視圖左下角插入點: \"))\n";
  lisp += "  (if pt (progn\n";
  lisp += "    (setq bx (car pt) by (cadr pt))\n";
  
  // Draw Horizontal Rails (Pink)
  lisp += "    (setvar \"CECOLOR\" \"6\")\n";
  // The rail is drawn at the base (from by to by + hRailThickness)
  lisp += `    (command \"_RECTANG\" (list bx by) (list (+ bx ${totalLength.toFixed(2)}) (+ by ${hRailThickness.toFixed(2)})))\n`;
  
  // Draw Pickets (Orange-Brown)
  lisp += "    (setvar \"CECOLOR\" \"34\")\n";
  for (let i = 0; i < count; i++) {
    const x1 = (sideOffset + i * actualCTC).toFixed(2);
    const x2 = (sideOffset + i * actualCTC + railWidth).toFixed(2);
    // Pickets are placed flush against the rail (from by - picketThickness to by)
    const y1 = (-picketThickness).toFixed(2);
    const y2 = "0.00";
    lisp += `    (command \"_RECTANG\" (list (+ bx ${x1}) (+ by ${y1})) (list (+ bx ${x2}) (+ by ${y2})))\n`;
  }

  lisp += "    (setvar \"CECOLOR\" \"256\")\n";
  lisp += "  ))\n";
  lisp += "  (setvar \"OSMODE\" old_osmode)\n";
  lisp += "  (princ \"\\n上視圖生成完畢。\")\n";
  lisp += "  (princ)\n)";
  return lisp;
}

function generateSideViewScript(railHeight: number, upperRailOffset: number, lowerRailOffset: number, hRailHeight: number, picketThickness: number, hRailThickness: number): string {
  let lisp = "(progn\n";
  lisp += "  (setq old_osmode (getvar \"OSMODE\"))\n";
  lisp += "  (setvar \"OSMODE\" 0)\n";
  lisp += "  (setq pt (getpoint \"\\n請在圖面中點選側視圖左下角插入點: \"))\n";
  lisp += "  (if pt (progn\n";
  lisp += "    (setq bx (car pt) by (cadr pt))\n";
  
  // Draw Picket Side (Orange-Brown)
  lisp += "    (setvar \"CECOLOR\" \"34\")\n";
  lisp += `    (command \"_RECTANG\" (list bx by) (list (+ bx ${picketThickness.toFixed(2)}) (+ by ${railHeight.toFixed(2)})))\n`;
  
  // Draw Horizontal Rails Side (Pink) - Attached to the side of the picket
  lisp += "    (setvar \"CECOLOR\" \"6\")\n";
  const ur_y2 = (railHeight - upperRailOffset).toFixed(2);
  const ur_y1 = (railHeight - upperRailOffset - hRailHeight).toFixed(2);
  const lr_y1 = (lowerRailOffset).toFixed(2);
  const lr_y2 = (lowerRailOffset + hRailHeight).toFixed(2);
  
  // Rails are attached to the right side of the picket
  lisp += `    (command \"_RECTANG\" (list (+ bx ${picketThickness.toFixed(2)}) (+ by ${ur_y1})) (list (+ bx ${(picketThickness + hRailThickness).toFixed(2)}) (+ by ${ur_y2})))\n`;
  lisp += `    (command \"_RECTANG\" (list (+ bx ${picketThickness.toFixed(2)}) (+ by ${lr_y1})) (list (+ bx ${(picketThickness + hRailThickness).toFixed(2)}) (+ by ${lr_y2})))\n`;

  lisp += "    (setvar \"CECOLOR\" \"256\")\n";
  lisp += "  ))\n";
  lisp += "  (setvar \"OSMODE\" old_osmode)\n";
  lisp += "  (princ \"\\n側視圖生成完畢。\")\n";
  lisp += "  (princ)\n)";
  return lisp;
}
