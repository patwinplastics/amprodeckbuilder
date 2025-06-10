const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;

// Collapsible Panel Component
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

// DeckDesigner Component
function DeckDesigner() {
  const [points, setPoints] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [deckColor, setDeckColor] = useState('Driftwood');
  const [hasRailings, setHasRailings] = useState(false);
  const [joistSpacing, setJoistSpacing] = useState(0.3048); // 1 ft
  const [beamSpacing, setBeamSpacing] = useState(2.4384); // 8 ft
  const [postSpacing, setPostSpacing] = useState(2.4384); // 8 ft
  const [error, setError] = useState(null);
  const canvas2DRef = useRef(null);
  const canvas3DRef = useRef(null);
  const sceneRef = useRef(null);
  const deckMeshRef = useRef(null);
  const joistMeshesRef = useRef([]);
  const beamMeshesRef = useRef([]);
  const postMeshesRef = useRef([]);
  const railingMeshesRef = useRef([]);

  // Initialize 2D canvas
  useEffect(() => {
    try {
      const canvas = canvas2DRef.current;
      if (!canvas) throw new Error('2D canvas not found');
      console.log('Initializing 2D canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = canvas.offsetWidth || 600;
      canvas.height = canvas.offsetHeight || 400;

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
            ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
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
  }, [points, selectedPoint]);

  // Initialize Babylon.js scene
  useEffect(() => {
    try {
      console.log('Initializing Babylon.js');
      const canvas = canvas3DRef.current;
      if (!canvas) throw new Error('3D canvas not found');
      canvas.width = canvas.offsetWidth || 600;
      canvas.height = canvas.offsetHeight || 400;

      if (!BABYLON.Engine.isSupported()) throw new Error('WebGL not supported');
      const engine = new BABYLON.Engine(canvas, true);
      const scene = new BABYLON.Scene(engine);
      sceneRef.current = scene;

      const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 4, Math.PI / 4, 20, new BABYLON.Vector3(0, 0, 0), scene);
      camera.attachControl(canvas, true);

      const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
      light.intensity = 0.7;

      const ground = BABYLON.MeshBuilder.CreatePlane("ground", { size: 100 }, scene);
      ground.rotation.x = Math.PI / 2;
      ground.material = new BABYLON.StandardMaterial("groundMat", scene);
      ground.material.diffuseColor = new BABYLON.Color3(0.13, 0.55, 0.13);

      scene.debugLayer.show({ embedMode: true });

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

  // Update 3D deck
  useEffect(() => {
    try {
      console.log('Updating 3D deck with points:', points);
      const scene = sceneRef.current;
      if (!scene || points.length < 3) return;

      if (deckMeshRef.current) deckMeshRef.current.dispose();
      joistMeshesRef.current.forEach(mesh => mesh.dispose());
      beamMeshesRef.current.forEach(mesh => mesh.dispose());
      postMeshesRef.current.forEach(mesh => mesh.dispose());
      railingMeshesRef.current.forEach(mesh => mesh.dispose());
      joistMeshesRef.current = [];
      beamMeshesRef.current = [];
      postMeshesRef.current = [];
      railingMeshesRef.current = [];

      const vertices = points.map(p => new BABYLON.Vector3(p.x / 50, 0.0254, p.y / 50)); // 1" height
      const deck = BABYLON.MeshBuilder.CreatePolygon("deck", { shape: vertices, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
      const deckMat = new BABYLON.StandardMaterial("deckMat", scene);
      deckMat.diffuseColor = deckColor === 'Driftwood' ? new BABYLON.Color3(0.6, 0.6, 0.6) :
                            deckColor === 'Khaki' ? new BABYLON.Color3(0.76, 0.70, 0.50) :
                            new BABYLON.Color3(0.54, 0.33, 0.20); // Hazelnut
      deck.material = deckMat;
      deckMeshRef.current = deck;

      const bounds = {
        minX: Math.min(...points.map(p => p.x / 50)),
        maxX: Math.max(...points.map(p => p.x / 50)),
        minZ: Math.min(...points.map(p => p.y / 50)),
        maxZ: Math.max(...points.map(p => p.y / 50)),
      };

      const joistWidth = 0.0381; // 1.5"
      const joistHeight = 0.18415; // 7.25"
      for (let x = bounds.minX + joistSpacing; x < bounds.maxX; x += joistSpacing) {
        const joist = BABYLON.MeshBuilder.CreateBox("joist", { width: joistWidth, height: joistHeight, depth: bounds.maxZ - bounds.minZ }, scene);
        joist.position = new BABYLON.Vector3(x, 0.0254 - joistHeight / 2, (bounds.minZ + bounds.maxZ) / 2);
        joist.material = new BABYLON.StandardMaterial("joistMat", scene);
        joist.material.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        joistMeshesRef.current.push(joist);
      }

      const beamWidth = 0.0889; // 3.5"
      const beamHeight = 0.18415; // 7.25"
      for (let z = bounds.minZ + beamSpacing; z < bounds.maxZ; z += beamSpacing) {
        const beam = BABYLON.MeshBuilder.CreateBox("beam", { width: bounds.maxX - bounds.minX, height: beamHeight, depth: beamWidth }, scene);
        beam.position = new BABYLON.Vector3((bounds.minX + bounds.maxX) / 2, 0.0254 - beamHeight - joistHeight / 2, z);
        beam.material = new BABYLON.StandardMaterial("beamMat", scene);
        beam.material.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        beamMeshesRef.current.push(beam);
      }

      const postWidth = 0.0889; // 3.5"
      const postHeight = 2.4384; // 8'
      for (let z = bounds.minZ; z <= bounds.maxZ; z += postSpacing) {
        for (let x = bounds.minX; x <= bounds.maxX; x += postSpacing) {
          const post = BABYLON.MeshBuilder.CreateBox("post", { width: postWidth, height: postHeight, depth: postWidth }, scene);
          post.position = new BABYLON.Vector3(x, -postHeight / 2, z);
          post.material = new BABYLON.StandardMaterial("postMat", scene);
          post.material.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
          postMeshesRef.current.push(post);
        }
      }

      if (hasRailings) {
        for (let i = 0; i < points.length; i++) {
          const start = points[i];
          const end = points[(i + 1) % points.length];
          const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2) / 50;
          const railing = BABYLON.MeshBuilder.CreateBox("railing", { width: length, height: 0.9144, depth: 0.05 }, scene);
          const midX = (start.x + end.x) / 100;
          const midZ = (start.y + end.y) / 100;
          railing.position = new BABYLON.Vector3(midX, 0.9144 / 2, midZ);
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          railing.rotation.y = angle;
          railing.material = new BABYLON.StandardMaterial("railingMat", scene);
          railing.material.diffuseColor = new BABYLON.Color3(0.29, 0.18, 0.10);
          railingMeshesRef.current.push(railing);
        }
      }
    } catch (err) {
      console.error('3D deck update error:', err);
      setError('Failed to update 3D deck: ' + err.message);
    }
  }, [points, deckColor, hasRailings, joistSpacing, beamSpacing, postSpacing]);

  const bom = calculateBOM(points, joistSpacing, beamSpacing, postSpacing, hasRailings);

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <div className="flex items-center">
          <img src="https://via.placeholder.com/150x50?text=American+Pro+Logo" alt="American Pro Logo" className="h-10 mr-4" />
          <h1 className="text-2xl font-bold">American Pro PVC Deck Designer</h1>
        </div>
        <p className="text-sm">Design with American Pro PVC Decking (1" x 5.5", 25-Year Warranty)</p>
      </div>
      <div className="flex flex-1">
        <div className="w-1/3 p-4 bg-gray-100 overflow-y-auto">
          <Panel title="Design Controls">
            <div className="tooltip">
              <label className="block text-sm font-medium">Deck Color:</label>
              <select
                value={deckColor}
                onChange={(e) => setDeckColor(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="Driftwood">Driftwood</option>
                <option value="Khaki">Khaki</option>
                <option value="Hazelnut">Hazelnut</option>
              </select>
              <span className="tooltiptext">Choose from American Pro's premium PVC decking colors.</span>
            </div>
            <div className="tooltip mt-4">
              <label className="block text-sm font-medium">Joist Spacing (ft):</label>
              <input
                type="number"
                value={(joistSpacing * 3.28084).toFixed(2)}
                onChange={(e) => setJoistSpacing(Number(e.target.value) / 3.28084)}
                className="w-full p-2 border rounded"
                min="0.5"
                step="0.0625"
              />
              <span className="tooltiptext">Set spacing for 2x8 joists (recommended: 1 ft).</span>
            </div>
            <div className="tooltip mt-4">
              <label className="block text-sm font-medium">Beam Spacing (ft):</label>
              <input
                type="number"
                value={(beamSpacing * 3.28084).toFixed(2)}
                onChange={(e) => setBeamSpacing(Number(e.target.value) / 3.28084)}
                className="w-full p-2 border rounded"
                min="4"
                step="1"
              />
              <span className="tooltiptext">Set spacing for 4x8 beams (recommended: 8 ft).</span>
            </div>
            <div className="tooltip mt-4">
              <label className="block text-sm font-medium">Post Spacing (ft):</label>
              <input
                type="number"
                value={(postSpacing * 3.28084).toFixed(2)}
                onChange={(e) => setPostSpacing(Number(e.target.value) / 3.28084)}
                className="w-full p-2 border rounded"
                min="4"
                step="1"
              />
              <span className="tooltiptext">Set spacing for 4x4 posts (recommended: 8 ft).</span>
            </div>
            <div className="tooltip mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={hasRailings}
                  onChange={(e) => setHasRailings(e.target.checked)}
                  className="mr-2"
                />
                Add Railings
              </label>
              <span className="tooltiptext">Add standard railings to deck edges.</span>
            </div>
            <div className="tooltip mt-4">
              <button
                onClick={() => setPoints([])}
                className="w-full p-2 bg-red-500 text-white rounded"
              >
                Clear Deck
              </button>
              <span className="tooltiptext">Reset the deck design to start over.</span>
            </div>
          </Panel>
          <Panel title="Export Options">
            <div className="tooltip">
              <button
                onClick={() => exportBlueprint(canvas2DRef.current, points)}
                className="w-full p-2 bg-blue-500 text-white rounded mb-2"
              >
                Export 2D Blueprint (PNG)
              </button>
              <span className="tooltiptext">Download a dimensioned 2D blueprint as PNG.</span>
            </div>
            <div className="tooltip">
              <button
                onClick={() => exportSvg(points, canvas2DRef.current.width, canvas2DRef.current.height)}
                className="w-full p-2 bg-blue-500 text-white rounded mb-2"
              >
                Export 2D Blueprint (SVG)
              </button>
              <span className="tooltiptext">Download a vector blueprint as SVG.</span>
            </div>
            <div className="tooltip">
              <button
                onClick={() => BABYLON.Tools.CreateScreenshot(sceneRef.current.getEngine(), sceneRef.current.activeCamera, { width: 800, height: 600 }, (data) => {
                  const link = document.createElement('a');
                  link.download = 'deck_3d_screenshot.png';
                  link.href = data;
                  link.click();
                })}
                className="w-full p-2 bg-blue-500 text-white rounded mb-2"
              >
                Export 3D Screenshot
              </button>
              <span className="tooltiptext">Download a 3D view screenshot as PNG.</span>
            </div>
            <div className="tooltip">
              <button
                onClick={() => exportBOM(bom, deckColor)}
                className="w-full p-2 bg-blue-500 text-white rounded mb-2"
              >
                Export BOM (CSV)
              </button>
              <span className="tooltiptext">Download a detailed bill of materials as CSV.</span>
            </div>
            <div className="tooltip">
              <button
                onClick={() => exportJSON(points, deckColor, joistSpacing, beamSpacing, postSpacing, hasRailings)}
                className="w-full p-2 bg-blue-500 text-white rounded"
              >
                Export Project (JSON)
              </button>
              <span className="tooltiptext">Download the project data as JSON.</span>
            </div>
          </Panel>
          <Panel title="Bill of Materials">
            {bom.boardsNeeded.map((b, i) => (
              <p key={i}>Deck Boards: {b.count} x {(b.length * 3.28084).toFixed(0)} ft ({deckColor})</p>
            ))}
            <p>Joists: {bom.joistCount} x {bom.joistLength.toFixed(1)} m (2x8)</p>
            <p>Beams: {bom.beamCount} x {bom.beamLength.toFixed(1)} m (4x8)</p>
            <p>Posts: {bom.postCount} x 2.4384 m (4x4)</p>
            {bom.railingLength > 0 && <p>Railing: {bom.railingLength.toFixed(1)} m</p>}
            <p>Fasteners: {bom.totalFasteners} (Hidden)</p>
          </Panel>
        </div>
        <div className="w-2/3 flex flex-col">
          <div className="h-1/2">
            <h2 className="text-lg font-semibold p-2 bg-gray-300">2D Blueprint (Click to add points, drag to adjust)</h2>
            <canvas ref={canvas2DRef} className="w-full h-[calc(100%-40px)] border" style={{ minHeight: '400px' }} />
          </div>
          <div className="h-1/2">
            <h2 className="text-lg font-semibold p-2 bg-gray-300">3D View (Drag to rotate)</h2>
            <canvas ref={canvas3DRef} className="w-full h-[calc(100%-40px)] border" style={{ minHeight: '400px' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Render the app
try {
  console.log('Rendering React app');
  const root = createRoot(document.getElementById('root'));
  root.render(<DeckDesigner />);
} catch (err) {
  console.error('React render error:', err);
  document.getElementById('root').innerHTML = '<div class="p-4 text-red-500">Failed to render app: ' + err.message + '</div>';
}
