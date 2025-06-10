const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;
function Panel({ title, children }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setIsOpen(!isOpen)}>
        <span>{title}</span>
        <span>{isOpen ? '▼' : '▶'}</span>
      </div>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  );
}
function Popover({ isOpen, onClose, children, x, y }) {
  if (!isOpen) return null;
  return (
    <div className="mxt-popover" style={{ top: y, left: x }}>
      <div className="mxt-popover-content">
        <button className="mxt-btn" onClick={onClose}>Close</button>
        {children}
      </div>
    </div>
  );
}
function DeckDesigner() {
  console.log('Rendering DeckDesigner');
  const [points, setPoints] = useState(createDefaultDeck());
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [deckColor, setDeckColor] = useState('Driftwood');
  const [hasRailings, setHasRailings] = useState(false);
  const [joistSpacing, setJoistSpacing] = useState(0.3048);
  const [beamSpacing, setBeamSpacing] = useState(2.4384);
  const [postSpacing, setPostSpacing] = useState(2.4384);
  const [widthFt, setWidthFt] = useState('12');
  const [lengthFt, setLengthFt] = useState('12');
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const canvas2DRef = useRef(null);
  const canvas3DRef = useRef(null);
  const sceneRef = useRef(null);
  const deckMeshRef = useRef(null);
  const joistMeshesRef = useRef([]);
  const beamMeshesRef = useRef([]);
  const postMeshesRef = useRef([]);
  const railingMeshesRef = useRef([]);
  const cameraRef = useRef(null);
  useEffect(() => {
    try {
      console.log('Initializing 2D canvas');
      const canvas = canvas2DRef.current;
      if (!canvas) throw new Error('2D canvas not found');
      canvas.width = canvas.offsetWidth || 600;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      const drawGrid = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += 50) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += 50) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
      };
      const drawDeck = () => {
        drawGrid();
        if (points.length > 0) {
          ctx.fillStyle = 'blue';
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 2;
          ctx.beginPath();
          points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
            ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
          });
          if (points.length > 2) ctx.closePath();
          ctx.stroke();
        }
      };
      const handleClick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / 50) * 50;
        const y = Math.round((e.clientY - rect.top) / 50) * 50;
        setPoints([...points, { x, y }]);
        setWidthFt('');
        setLengthFt('');
      };
      const handleMouseDown = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const clickedPoint = points.findIndex(p => Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10);
        if (clickedPoint !== -1) setSelectedPoint(clickedPoint);
      };
      const handleMouseMove = (e) => {
        if (selectedPoint !== null) {
          const rect = canvas.getBoundingClientRect();
          const x = Math.round((e.clientX - rect.left) / 50) * 50;
          const y = Math.round((e.clientY - rect.top) / 50) * 50;
          const newPoints = [...points];
          newPoints[selectedPoint] = { x, y };
          setPoints(newPoints);
          setWidthFt('');
          setLengthFt('');
        }
      };
      const handleMouseUp = () => {
        setSelectedPoint(null);
      };
      canvas.addEventListener('click', handleClick);
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseup', handleMouseUp);
      drawDeck();
      return () => {
        canvas.removeEventListener('click', handleClick);
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseup', handleMouseUp);
      };
    } catch (err) {
      console.error('2D canvas error:', err);
      setError('2D canvas initialization failed: ' + err.message);
    }
  }, [points]);
  useEffect(() => {
    try {
      console.log('Initializing Babylon.js');
      const canvas = canvas3DRef.current;
      if (!canvas) throw new Error('3D canvas not found');
      canvas.width = canvas.offsetWidth || 600;
      canvas.height = 400;
      if (!window.BABYLON || !BABYLON.Engine.isSupported()) throw new Error('WebGL or Babylon.js not supported');
      const engine = new BABYLON.Engine(canvas, true);
      const scene = new BABYLON.Scene(engine);
      sceneRef.current = scene;
      const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 3, Math.PI / 4, 30, new BABYLON.Vector3(0, 0, 0), scene);
      camera.attachControl(canvas, true);
      camera.minZ = 0.1;
      cameraRef.current = camera;
      const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 1), scene);
      light.intensity = 0.8;
      const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
      ground.material = new BABYLON.StandardMaterial("groundMat", scene);
      ground.material.diffuseColor = new BABYLON.Color3(0.1, 0.5, 0.1);
      scene.debugLayer.show({ embedMode: false });
      engine.runRenderLoop(() => {
        try {
          scene.render();
        } catch (err) {
          console.error('Render loop error:', err);
        }
      });
      const handleResize = () => {
        try {
          engine.resize();
        } catch (err) {
          console.error('Resize error:', err);
        }
      };
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        engine.dispose();
      };
    } catch (err) {
      console.error('Babylon.js error:', err);
      setError('3D scene initialization failed: ' + err.message);
    }
  }, []);
  useEffect(() => {
    try {
      console.log('Updating 3D deck with points:', points);
      const scene = sceneRef.current;
      if (!scene) return;
      if (deckMeshRef.current) deckMeshRef.current.dispose();
      joistMeshesRef.current.forEach(mesh => mesh.dispose());
      beamMeshesRef.current.forEach(mesh => mesh.dispose());
      postMeshesRef.current.forEach(mesh => mesh.dispose());
      railingMeshesRef.current.forEach(mesh => mesh.dispose());
      joistMeshesRef.current = [];
      beamMeshesRef.current = [];
      postMeshesRef.current = [];
      railingMeshesRef.current = [];
      if (points.length >= 3) {
        const vertices = points.map(p => new BABYLON.Vector3(p.x / 50, 0.0254, p.y / 50));
        const deck = BABYLON.MeshBuilder.CreatePolygon("deck", { shape: vertices, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
        const deckMat = new BABYLON.StandardMaterial("deckMat", scene);
        deckMat.diffuseColor = deckColor === 'Driftwood' ? new BABYLON.Color3(0.6, 0.6, 0.6) :
                              deckColor === 'Khaki' ? new BABYLON.Color3(0.76, 0.7, 0.5) :
                              new BABYLON.Color3(0.54, 0.33, 0.2);
        deck.material = deckMat;
        deckMeshRef.current = deck;
        console.log('Deck mesh created with vertices:', vertices);
        const bounds = {
          minX: Math.min(...points.map(p => p.x / 50)),
          maxX: Math.max(...points.map(p => p.x / 50)),
          minZ: Math.min(...points.map(p => p.y / 50)),
          maxZ: Math.max(...points.map(p => p.y / 50)),
        };
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerZ = (bounds.minZ + bounds.maxZ) / 2;
        cameraRef.current.target = new BABYLON.Vector3(centerX, 0, centerZ);
        cameraRef.current.radius = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 1.5;
        const joistWidth = 0.0381;
        const joistHeight = 0.18415;
        for (let x = bounds.minX + joistSpacing; x < bounds.maxX; x += joistSpacing) {
          const joist = BABYLON.MeshBuilder.CreateBox("joist", { width: joistWidth, height: joistHeight, depth: bounds.maxZ - bounds.minZ }, scene);
          joist.position = new BABYLON.Vector3(x, 0.0254 - joistHeight / 2, (bounds.minZ + bounds.maxZ) / 2);
          joist.material = new BABYLON.StandardMaterial("joistMat", scene);
          joist.material.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
          joistMeshesRef.current.push(joist);
        }
        const beamWidth = 0.0889;
