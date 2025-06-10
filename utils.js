function calculateDeckArea(points) {
  if (points.length < 3) return 0;
  return Math.abs(points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length];
    return sum + (p.x * next.y - next.x * p.y);
  }, 0) / 2 / 50 / 50); // Area in m²
}

function calculateBOM(points, joistSpacing, beamSpacing, postSpacing, hasRailings) {
  const deckArea = calculateDeckArea(points);
  const boardWidth = 0.1397; // 5.5"
  const boardLengths = [3.6576, 4.8768, 6.096]; // 12', 16', 20' in meters
  const boardsNeeded = [];
  let remainingArea = deckArea;
  for (const length of boardLengths.sort((a, b) => b - a)) {
    const boards = Math.ceil(remainingArea / (length * boardWidth));
    if (boards > 0) {
      boardsNeeded.push({ length, count: boards });
      remainingArea -= boards * length * boardWidth;
    }
  }

  const bounds = points.length > 0 ? {
    minX: Math.min(...points.map(p => p.x / 50)),
    maxX: Math.max(...points.map(p => p.x / 50)),
    minZ: Math.min(...points.map(p => p.y / 50)),
    maxZ: Math.max(...points.map(p => p.y / 50)),
  } : { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

  const joistCount = Math.floor((bounds.maxX - bounds.minX) / joistSpacing) + 1;
  const joistLength = bounds.maxZ - bounds.minZ;
  const beamCount = Math.floor((bounds.maxZ - bounds.minZ) / beamSpacing) + 1;
  const beamLength = bounds.maxX - bounds.minX;
  const postCount = Math.floor((bounds.maxX - bounds.minX) / postSpacing + 1) * Math.floor((bounds.maxZ - bounds.minZ) / postSpacing + 1);
  const railingLength = hasRailings ? points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length];
    return sum + Math.sqrt((next.x - p.x) ** 2 + (next.y - p.y) ** 2) / 50;
  }, 0) : 0;
  const fastenersPerBoard = 2;
  const totalFasteners = boardsNeeded.reduce((sum, b) => sum + b.count * fastenersPerBoard, 0);

  return { boardsNeeded, joistCount, joistLength, beamCount, beamLength, postCount, railingLength, totalFasteners };
}

function exportBlueprint(canvas, points) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.stroke();
  points.forEach((p, i) => {
    const next = points[(i + 1) % points.length];
    const length = Math.sqrt((next.x - p.x) ** 2 + (next.y - p.y) ** 2) / 50 * 3.28084;
    ctx.fillStyle = 'black';
    ctx.font = '12px bold Arial';
    ctx.fillText(`${length.toFixed(2)} ft`, (p.x + next.x) / 2, (p.y + next.y) / 2);
  });
  const link = document.createElement('a');
  link.download = 'deck_blueprint.png';
  link.href = canvas.toDataURL();
  link.click();
}

function exportSvg(points, width, height) {
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += '<rect width="100%" height="100%" fill="white"/>';
  if (points.length > 2) {
    svg += '<polygon points="' + points.map(p => `${p.x},${p.y}`).join(' ') + '" fill="none" stroke="black" stroke-width="2"/>';
    points.forEach((p, i) => {
      const next = points[(i + 1) % points.length];
      const length = Math.sqrt((next.x - p.x) ** 2 + (next.y - p.y) ** 2) / 50 * 3.28084;
      const midX = (p.x + next.x) / 2;
      const midY = (p.y + next.y) / 2;
      svg += `<text x="${midX}" y="${midY}" font-family="Arial" font-size="12" font-weight="bold">${length.toFixed(2)} ft</text>`;
    });
  }
  svg += '</svg>';
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = 'deck_blueprint.svg';
  link.href = URL.createObjectURL(blob);
  link.click();
}

function exportBOM(bom, deckColor) {
  let csv = 'Item,Quantity,Unit,Details\n';
  bom.boardsNeeded.forEach(b => {
    csv += `Deck Board,${b.count},Each,American Pro PVC 1" x 5.5" x ${(b.length * 3.28084).toFixed(0)} ft (${deckColor})\n`;
  });
  csv += `Joists,${bom.joistCount},Each,2x8 x ${bom.joistLength.toFixed(1)} m\n`;
  csv += `Beams,${bom.beamCount},Each,4x8 x ${bom.beamLength.toFixed(1)} m\n`;
  csv += `Posts,${bom.postCount},Each,4x4 x 2.4384 m\n`;
  if (bom.railingLength) csv += `Railing,${bom.railingLength.toFixed(1)},Meters,Standard Railing\n`;
  csv += `Fasteners,${bom.totalFasteners},Each,Hidden Fasteners\n`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.download = 'deck_bom.csv';
  link.href = URL.createObjectURL(blob);
  link.click();
}

function exportJSON(points, deckColor, joistSpacing, beamSpacing, postSpacing, hasRailings) {
  const project = {
    points,
    deckColor,
    joistSpacing,
    beamSpacing,
    postSpacing,
    hasRailings,
    version: '1.0',
  };
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = 'deck_project.json';
  link.href = URL.createObjectURL(blob);
  link.click();
}
