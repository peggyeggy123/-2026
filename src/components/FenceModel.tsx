import { OrbitControls, PerspectiveCamera, Stage, Grid } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";

interface FenceProps {
  totalLength: number;
  postSize: number;
  lowerRailHeight: number;
  upperRailTopOffset: number;
  picketWidth: number;
  picketThickness: number;
  picketHeight: number;
  picketGroundClearance: number;
  picketSpacing: number;
  mode?: 'designer' | 'calculator';
  count?: number;
  hRailWidth?: number;
  hRailThickness?: number;
}

function Fence({
  totalLength,
  postSize,
  lowerRailHeight,
  upperRailTopOffset,
  picketWidth,
  picketThickness,
  picketHeight,
  picketGroundClearance,
  picketSpacing,
  mode = 'designer',
  count,
  hRailWidth = 80,
  hRailThickness = 40,
}: FenceProps) {
  // Convert mm to meters for Three.js (1000mm = 1m)
  const scale = 0.001;
  const L = totalLength * scale;
  const PS = postSize * scale;
  const LRH = lowerRailHeight * scale;
  const URTO = upperRailTopOffset * scale;
  const PW = picketWidth * scale;
  const PT = picketThickness * scale;
  const PH = picketHeight * scale;
  const PGC = picketGroundClearance * scale;
  const PS_GAP = picketSpacing * scale;
  const HRW = hRailWidth * scale;
  const HRT = hRailThickness * scale;

  // Actual height of rails from ground
  // URTO is offset from top of picket to top of rail
  const URH_center = PGC + PH - URTO - HRW / 2;
  // LRH is offset from bottom of picket to bottom of rail
  const LRH_center = PGC + LRH + HRW / 2;

  // Rails
  const railThickness = HRT;
  const railWidth = HRW;
  
  // In calculator mode, rails go between walls. In designer mode, rails go between posts.
  const railLength = mode === 'calculator' ? L : L - PS;

  // Picket Calculations
  const availableWidth = L - PS * 2;
  const picketUnitWidth = PW + PS_GAP;
  
  // Use provided count or calculate it
  const numPickets = count !== undefined ? count : Math.max(0, Math.floor((availableWidth + PS_GAP) / picketUnitWidth));
  
  // If count is provided, we use the actual gap calculated by the calculator
  const actualGap = count !== undefined && count > 1 
    ? (availableWidth - (count * PW)) / (count - 1)
    : PS_GAP;
    
  const stepWidth = PW + actualGap;
  
  // startX is the center of the first picket
  const startX = -L / 2 + PS + PW / 2;

  return (
    <group>
      {/* End Structures */}
      {mode === 'designer' ? (
        <>
          {/* Left Post */}
          <mesh position={[-L / 2 + PS / 2, PH / 2, 0]}>
            <boxGeometry args={[PS, PH + PS * 0.2, PS]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>

          {/* Right Post */}
          <mesh position={[L / 2 - PS / 2, PH / 2, 0]}>
            <boxGeometry args={[PS, PH + PS * 0.2, PS]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
        </>
      ) : (
        <>
          {/* Left Wall (Black) */}
          <mesh position={[-L / 2 - 0.025, PH / 2, 0]}>
            <boxGeometry args={[0.05, PH * 1.2, 0.4]} />
            <meshStandardMaterial color="#000000" />
          </mesh>

          {/* Right Wall (Black) */}
          <mesh position={[L / 2 + 0.025, PH / 2, 0]}>
            <boxGeometry args={[0.05, PH * 1.2, 0.4]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </>
      )}

      {/* Lower Rail */}
      <mesh position={[0, LRH_center, 0]}>
        <boxGeometry args={[railLength, railWidth, railThickness]} />
        <meshStandardMaterial color="#795548" />
      </mesh>

      {/* Upper Rail */}
      <mesh position={[0, URH_center, 0]}>
        <boxGeometry args={[railLength, railWidth, railThickness]} />
        <meshStandardMaterial color="#795548" />
      </mesh>

      {/* Pickets */}
      {Array.from({ length: numPickets }).map((_, i) => (
        <mesh key={i} position={[startX + i * stepWidth, PGC + PH / 2, railThickness / 2 + PT / 2]}>
          <boxGeometry args={[PW, PH, PT]} />
          <meshStandardMaterial color="#a0522d" />
        </mesh>
      ))}

      {/* Ground Plane */}
      <Grid
        infiniteGrid
        fadeDistance={20}
        fadeStrength={5}
        cellSize={0.5}
        sectionSize={2.5}
        sectionThickness={1.5}
        sectionColor="#666"
      />
    </group>
  );
}

export default function FenceModelViewer(props: FenceProps) {
  return (
    <div className="w-full h-full bg-[#f5f5f5] rounded-xl overflow-hidden border border-gray-200 shadow-inner relative">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[3, 2, 5]} fov={50} />
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.6} shadows="contact">
            <Fence {...props} />
          </Stage>
        </Suspense>
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
      </Canvas>
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-gray-200 text-xs font-bold text-gray-800 shadow-lg min-w-[160px]">
        <div className="space-y-1.5">
          <div className="flex justify-between gap-4">
            <span className="opacity-50 uppercase tracking-wider">格柵數量</span>
            <span className="font-mono">{props.count !== undefined ? props.count : Math.max(0, Math.floor(((props.totalLength - props.postSize * 2) + props.picketSpacing) / (props.picketWidth + props.picketSpacing)))} 支</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="opacity-50 uppercase tracking-wider">實際中心距</span>
            <span className="font-mono">{(props.picketWidth + props.picketSpacing).toFixed(1)} mm</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="opacity-50 uppercase tracking-wider">單邊預留</span>
            <span className="font-mono">{props.postSize.toFixed(1)} mm</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="opacity-50 uppercase tracking-wider">格柵寬度</span>
            <span className="font-mono">{props.picketWidth} mm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
