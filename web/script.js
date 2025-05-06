// --- GLOBAL DEĞİŞKENLER VE DOM ELEMENTLERİ ---
const canvas = document.getElementById('drawingCanvas');
// ---- KONTROL KODU ----
if (!canvas) {
    console.error("!!!!!! HATA: HTML içinde 'drawingCanvas' ID'li element BULUNAMADI !!!!!!");
    throw new Error("Canvas elementi bulunamadı!");
} else {
     console.log(">>> Canvas elementi bulundu!");
}
// ---- KONTROL KODU BİTTİ ----

const ctx = canvas.getContext('2d');
const predictButton = document.getElementById('predictButton');
const clearButton = document.getElementById('clearButton');
const predictionArea = document.getElementById('predictionArea');
const normalizedImageContainer = document.getElementById('normalizedImageContainer');
const normalizedImage = document.getElementById('normalizedImage');

// Network Animasyon Elementleri
const inputLayer = document.querySelector('.input-layer');
const hiddenLayer1 = document.querySelector('.hidden-layer-1');
const hiddenLayer2 = document.querySelector('.hidden-layer-2');
const outputLayer = document.querySelector('.output-layer');
const svg = document.getElementById('connections');
const networkContainer = document.querySelector('.network-container');

let isDrawing = false;
let lastX = 0;
let lastY = 0;

const config = { inputNodes: 10, hiddenNodes1: 8, hiddenNodes2: 8, outputNodes: 10 };
let allNodes = { input: [], hidden1: [], hidden2: [], output: [] };
let allLines = [];
let animationTimeoutIds = [];

function initializeCanvas() {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    clearCanvas();
    console.log("Canvas başlatıldı.");
}

function clearCanvas() {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    predictionArea.innerText = 'Çizim Yapın veya Tahmin Edin';
    normalizedImage.style.display = 'none';
    normalizedImage.src = '';
    normalizedImage.classList.remove('visible');
    normalizedImageContainer?.classList.remove('updated');

    if (typeof clearHighlights === 'function') {
        clearHighlights();
    }
    if (allNodes && allNodes.hidden1 && allNodes.hidden2) {
        [...allNodes.hidden1, ...allNodes.hidden2].forEach(node => {
            node.textContent = "0.00";
            node.dataset.value = "0";
        });
    }
    console.log("Canvas temizlendi.");
}

function draw(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.touches ? e.touches[0].clientX - rect.left : e.offsetX;
    const currentY = e.touches ? e.touches[0].clientY - rect.top : e.offsetY;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
    [lastX, lastY] = [currentX, currentY];
}

function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    [lastX, lastY] = [e.touches ? e.touches[0].clientX - rect.left : e.offsetX,
                      e.touches ? e.touches[0].clientY - rect.top : e.offsetY];
    ctx.beginPath();
    ctx.arc(lastX, lastY, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
}

function stopDrawing() {
    if (isDrawing) {
       isDrawing = false;
       ctx.beginPath();
    }
}

async function requestPrediction() {
    if (isDrawing) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isCanvasBlank = !imageData.data.some((channel, i) => (i % 4 === 3 ? channel > 0 : channel !== 255));

    if (isCanvasBlank) {
        predictionArea.innerText = 'Lütfen önce bir rakam çizin!';
        return;
    }

    const imageDataURL = canvas.toDataURL('image/png');
    predictionArea.innerText = 'Tahmin ediliyor...';
    predictButton.disabled = true;
    clearButton.disabled = true;
    normalizedImage.style.display = 'none';
    normalizedImage.src = '';
    normalizedImage.classList.remove('visible');
    normalizedImageContainer?.classList.remove('updated');
    clearHighlights();

    console.log("JS: Python 'predict_digit' fonksiyonu çağrılıyor...");
    try {
        let result = await eel.predict_digit(imageDataURL)();
        console.log("JS: Python'dan sonuç alındı:", result);

        if (result && result.error) {
            predictionArea.innerText = `Hata: ${result.error}`;
        } else if (result && result.prediction !== undefined) {
            predictionArea.innerText = `Tahmin: ${result.prediction} (%${result.confidence.toFixed(1)})`;
            if (result.normalized_image) {
                normalizedImage.src = result.normalized_image;
                normalizedImage.style.display = 'block';
                setTimeout(() => normalizedImage.classList.add('visible'), 10);
                normalizedImageContainer?.classList.add('updated');
                setTimeout(() => normalizedImageContainer?.classList.remove('updated'), 600);
            }
            if (typeof generatePathsToOutput === 'function') {
                 randomizeHiddenNodeValues();
                 generatePathsToOutput(result.prediction);
            }
        } else {
            predictionArea.innerText = 'Python\'dan geçersiz sonuç alındı.';
        }
    } catch (error) {
        console.error("JS Hatası (Python ile iletişim):", error);
        predictionArea.innerText = 'Sunucu ile iletişim kurulamadı!';
    } finally {
        predictButton.disabled = false;
        clearButton.disabled = false;
    }
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createNode(layerType, index) {
    const node = document.createElement('div');
    node.classList.add('node');
    let nodeId = `${layerType.charAt(0)}${index}`;
    let nodeValueText = '';
    let nodeValueNumeric = 0;
    switch (layerType) {
        case 'input': nodeId = `i${index}`; nodeValueText = ''; nodeValueNumeric = 0; break;
        case 'hidden1': nodeId = `h1_${index}`; nodeValueNumeric = Math.random(); nodeValueText = nodeValueNumeric.toFixed(2); break;
        case 'hidden2': nodeId = `h2_${index}`; nodeValueNumeric = Math.random(); nodeValueText = nodeValueNumeric.toFixed(2); break;
        case 'output': nodeId = `o${index}`; node.classList.add('output'); nodeValueText = index; nodeValueNumeric = 0; break;
    }
    node.dataset.layer = layerType;
    node.dataset.id = nodeId;
    node.dataset.value = nodeValueNumeric;
    node.textContent = nodeValueText;
    return node;
}

function randomizeHiddenNodeValues() {
    ['hidden1', 'hidden2'].forEach(layerKey => {
        allNodes[layerKey]?.forEach(node => {
            const newValueNumeric = Math.random();
            node.dataset.value = newValueNumeric;
            node.textContent = newValueNumeric.toFixed(2);
        });
    });
    console.log("Animasyon için gizli katman değerleri (0.00-1.00) yenilendi.");
}

function initializeNetwork() {
    inputLayer.querySelectorAll('.node').forEach(n => n.remove());
    hiddenLayer1.querySelectorAll('.node').forEach(n => n.remove());
    hiddenLayer2.querySelectorAll('.node').forEach(n => n.remove());
    outputLayer.querySelectorAll('.node').forEach(n => n.remove());
    svg.innerHTML = '';
    allNodes = { input: [], hidden1: [], hidden2: [], output: [] };
    allLines = [];
    clearAnimationTimeouts();
    for (let i = 0; i < config.inputNodes; i++) { const node = createNode('input', i); inputLayer.appendChild(node); allNodes.input.push(node); }
    for (let i = 0; i < config.hiddenNodes1; i++) { const node = createNode('hidden1', i); hiddenLayer1.appendChild(node); allNodes.hidden1.push(node); }
    for (let i = 0; i < config.hiddenNodes2; i++) { const node = createNode('hidden2', i); hiddenLayer2.appendChild(node); allNodes.hidden2.push(node); }
    for (let i = 0; i < config.outputNodes; i++) { const node = createNode('output', i); outputLayer.appendChild(node); allNodes.output.push(node); }
    console.log("Network yapısı oluşturuldu.");
}

function getNodeCenter(nodeElement) {
    const containerRect = networkContainer?.getBoundingClientRect();
    if (!nodeElement || !nodeElement.offsetParent || !containerRect) return { x: 0, y: 0 };
    const nodeRect = nodeElement.getBoundingClientRect();
    const x = nodeRect.left + nodeRect.width / 2 - containerRect.left;
    const y = nodeRect.top + nodeRect.height / 2 - containerRect.top;
    return { x, y };
}

function drawConnections() {
    if (!networkContainer || !svg) return;
    svg.innerHTML = '';
    allLines = [];
    const drawLayerConnections = (fromLayerNodes, toLayerNodes) => {
        if (!fromLayerNodes || !toLayerNodes) return;
        fromLayerNodes.forEach(fromNode => {
            const start = getNodeCenter(fromNode);
            toLayerNodes.forEach(toNode => {
                const end = getNodeCenter(toNode);
                 if (isNaN(start.x) || isNaN(start.y) || isNaN(end.x) || isNaN(end.y) ||
                    (start.x === 0 && start.y === 0 && fromNode.offsetParent === null) ||
                    (end.x === 0 && end.y === 0 && toNode.offsetParent === null) ) return;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', start.x); line.setAttribute('y1', start.y);
                line.setAttribute('x2', end.x); line.setAttribute('y2', end.y);
                line.dataset.from = fromNode.dataset.id;
                line.dataset.to = toNode.dataset.id;
                svg.appendChild(line);
                allLines.push(line);
            });
        });
    };
    requestAnimationFrame(() => {
        if (svg.parentNode){
             drawLayerConnections(allNodes.input, allNodes.hidden1);
             drawLayerConnections(allNodes.hidden1, allNodes.hidden2);
             drawLayerConnections(allNodes.hidden2, allNodes.output);
             console.log(`Toplam ${allLines.length} bağlantı çizildi/güncellendi.`);
        }
    });
}

function clearAnimationTimeouts() {
    animationTimeoutIds.forEach(clearTimeout);
    animationTimeoutIds = [];
}

function clearHighlights() {
    clearAnimationTimeouts();
    document.querySelectorAll('.node.highlight, .node.winner').forEach(node => node.classList.remove('highlight', 'winner'));
    document.querySelectorAll('line.highlight').forEach(line => {
        line.classList.remove('highlight');
        line.style.strokeDasharray = '';
        line.style.strokeDashoffset = '';
        line.style.animation = '';
    });
}

function animateLine(lineElement, delay) {
    if (!lineElement) return;
    const timeoutId = setTimeout(() => {
        if (!lineElement) return;
        lineElement.classList.add('highlight'); 
    }, delay);
    animationTimeoutIds.push(timeoutId);
}

function selectNodeBasedOnValue(availableNodes, excludeIds = new Set(), topN = 3) {
    const candidates = availableNodes.filter(node => node && !excludeIds.has(node.dataset.id));
    if (candidates.length === 0) {
        const fallback = availableNodes.find(node => node && !excludeIds.has(node.dataset.id)) || availableNodes.find(node => node);
        return fallback || null;
    }
    candidates.sort((a, b) => parseFloat(b.dataset.value) - parseFloat(a.dataset.value));
    const numTopChoices = Math.min(candidates.length, topN);
    const topChoices = candidates.slice(0, numTopChoices);
    if (topChoices.length === 0) return candidates[0];
    return topChoices[Math.floor(Math.random() * topChoices.length)];
}


function generatePathsToOutput(targetOutputIndex) {
    clearHighlights();

    const targetOutputNode = allNodes.output?.[targetOutputIndex];
    if (!targetOutputNode) {
         console.error(`Animasyon için hedef çıktı düğümü bulunamadı: index ${targetOutputIndex}`);
         return;
    }

    const numPaths = getRandomInt(3, 5);
    const usedInputNodeIds = new Set();
    const usedHidden1NodeIds = new Set();
    const usedHidden2NodeIds = new Set();

    console.log(`Animasyon: Hedef ${targetOutputIndex} için ${numPaths} yol oluşturuluyor...`);
    let pathDelayOffset = 0;

    for (let i = 0; i < numPaths; i++) {
        const availableInputs = allNodes.input.filter(node => !usedInputNodeIds.has(node.dataset.id));
        const selectedInputNode = availableInputs.length > 0 ? availableInputs[Math.floor(Math.random() * availableInputs.length)] : allNodes.input[0];
        if (!selectedInputNode) continue;
        usedInputNodeIds.add(selectedInputNode.dataset.id);

        const selectedHidden1Node = selectNodeBasedOnValue(allNodes.hidden1, usedHidden1NodeIds, 3);
        if (!selectedHidden1Node) continue;
        usedHidden1NodeIds.add(selectedHidden1Node.dataset.id);

        const selectedHidden2Node = selectNodeBasedOnValue(allNodes.hidden2, usedHidden2NodeIds, 3);
        if (!selectedHidden2Node) continue;
        usedHidden2NodeIds.add(selectedHidden2Node.dataset.id);

        const line1 = allLines.find(l => l.dataset.from === selectedInputNode.dataset.id && l.dataset.to === selectedHidden1Node.dataset.id);
        const line2 = allLines.find(l => l.dataset.from === selectedHidden1Node.dataset.id && l.dataset.to === selectedHidden2Node.dataset.id);
        const line3 = allLines.find(l => l.dataset.from === selectedHidden2Node.dataset.id && l.dataset.to === targetOutputNode.dataset.id);

        if (!line1 || !line2 || !line3) {
            console.warn(`Yol ${i+1} için çizgiler bulunamadı, animasyon atlandı.`);
            continue;
        }

        // DEĞİŞİKLİK: Animasyon hızı yavaşlatıldı
        const segmentDelay = 700; // Önceki: 400
        const nodeHighlightDelay = 80; // Önceki: 50 (biraz arttırıldı orantılı olarak)

        const inputTimeoutId = setTimeout(() => selectedInputNode?.classList.add('highlight'), pathDelayOffset + nodeHighlightDelay);
        animationTimeoutIds.push(inputTimeoutId);
        animateLine(line1, pathDelayOffset + nodeHighlightDelay / 2);

        const h1TimeoutId = setTimeout(() => selectedHidden1Node?.classList.add('highlight'), pathDelayOffset + segmentDelay + nodeHighlightDelay);
        animationTimeoutIds.push(h1TimeoutId);
        animateLine(line2, pathDelayOffset + segmentDelay + nodeHighlightDelay / 2);

        const h2TimeoutId = setTimeout(() => selectedHidden2Node?.classList.add('highlight'), pathDelayOffset + segmentDelay * 2 + nodeHighlightDelay);
        animationTimeoutIds.push(h2TimeoutId);
        animateLine(line3, pathDelayOffset + segmentDelay * 2 + nodeHighlightDelay / 2);

        const outputTimeoutId = setTimeout(() => targetOutputNode?.classList.add('highlight', 'winner'), pathDelayOffset + segmentDelay * 3 + nodeHighlightDelay);
        animationTimeoutIds.push(outputTimeoutId);

        // DEĞİŞİKLİK: Farklı yollar arasındaki gecikme de arttırıldı
        pathDelayOffset += 250; // Önceki: 150
    }
    console.log("Animasyon zamanlamaları ayarlandı (yavaşlatılmış).");
}


// --- OLAY DİNLEYİCİLERİ VE BAŞLANGIÇ ---

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing);

clearButton.addEventListener('click', clearCanvas);
predictButton.addEventListener('click', requestPrediction);

window.addEventListener('load', () => {
    console.log("Sayfa yüklendi.");
    initializeCanvas();
    initializeNetwork();
    setTimeout(() => {
         if (typeof drawConnections === 'function') {
            requestAnimationFrame(drawConnections);
         } else {
             console.error("drawConnections fonksiyonu yüklenmedi!");
         }
    }, 200);

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        clearHighlights();
        resizeTimer = setTimeout(() => {
            if (typeof drawConnections === 'function') {
                requestAnimationFrame(drawConnections);
                console.log("Pencere boyutu değişti, bağlantılar güncellendi.");
            }
        }, 250);
    });
});

console.log("script.js yüklendi ve çalışmaya hazır (Metin ve Animasyon Hızı Güncellendi).");